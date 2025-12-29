import { chromium } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'
// Ensure env vars (E2E_EMAIL/E2E_PASSWORD, PLAYWRIGHT_BASE_URL) load from .env.local/.env
import dotenv from 'dotenv'
import dns from 'dns/promises'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'

// ESM-compatible __dirname equivalent
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

try {
  for (const f of ['.env.local', '.env']) {
    const p = path.resolve(__dirname, f)
    if (existsSync(p)) dotenv.config({ path: p })
  }
} catch {}

export default async function globalSetup() {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'
  const allowProd = process.env.ALLOW_E2E_ON_PROD === '1'
  const isProdVercel = /^https:\/\/rocket-aftermarket-tracker\.vercel\.app\b/i.test(base)
  if (isProdVercel && !allowProd) {
    throw new Error(
      `[global.setup] Refusing to run E2E against production base URL (${base}). ` +
        `Set ALLOW_E2E_ON_PROD=1 only if you truly intend to run destructive E2E on prod.`
    )
  }

  const storageDir = path.join(process.cwd(), 'e2e')
  const storagePath = path.join(storageDir, 'storageState.json')

  const seen5xx = new Set<string>()

  const browser = await chromium.launch()
  const storageExists = await fs
    .stat(storagePath)
    .then(() => true)
    .catch(() => false)
  const context = await browser.newContext(
    storageExists ? { storageState: storagePath } : undefined
  )
  const page = await context.newPage()
  // Debug: surface browser console and key auth responses during setup
  page.on('console', (msg) => {
    try {
      // Trim noisy logs
      const text = msg.text()
      if (/vite\b|favicon|dev server/i.test(text)) return

      console.log(`[setup:console:${msg.type()}]`, text)
    } catch {}
  })
  page.on('response', (res) => {
    try {
      const url = res.url()
      const status = res.status()

      // Always surface 5xx so we can identify noisy failing endpoints.
      if (status >= 500) {
        const key = `${status} ${url}`
        if (!seen5xx.has(key)) {
          seen5xx.add(key)
          const req = res.request()
          const method = req.method()
          const rt = req.resourceType()
          console.warn(`[setup:response:5xx] ${status} ${method} ${rt} ${url}`)
        }
        return
      }

      if (/(auth|supabase)\//i.test(url)) {
        console.log(`[setup:response] ${status} ${url}`)
      }
    } catch {}
  })

  // Helper: wait for server to be reachable to reduce flakes on slow start
  const waitForServer = async (maxMs = 30000) => {
    const start = Date.now()
    let attempt = 0
    while (Date.now() - start < maxMs) {
      attempt += 1
      try {
        await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 5000 })
        return true
      } catch {
        // Small backoff then retry
        await new Promise((r) => setTimeout(r, Math.min(500 + attempt * 250, 2000)))
      }
    }
    return false
  }

  // If storage exists and debug-auth shows both testids, skip login
  let hasValidState = false
  try {
    const up = await waitForServer(30000)
    if (!up) {
      console.error('[global.setup] Server at %s did not become reachable within timeout.', base)
    }
    await page.goto(base + '/debug-auth', { waitUntil: 'load', timeout: 15000 })
    // Important: these elements are always visible. Validate actual values.
    const sessionText = await page
      .getByTestId('session-user-id')
      .textContent()
      .then((t) => (t ?? '').trim())
      .catch(() => '')

    const orgText = await page
      .getByTestId('profile-org-id')
      .textContent()
      .then((t) => (t ?? '').trim())
      .catch(() => '')

    const hasSession = sessionText !== '' && sessionText !== '—'
    const hasOrg = orgText !== '' && orgText !== 'undefined' && orgText !== 'null'
    hasValidState = hasSession && hasOrg
  } catch {}

  if (!hasValidState) {
    // Ensure auth flow (adjust selectors if needed)
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
      console.error(
        '[global.setup] Missing E2E_EMAIL/E2E_PASSWORD. Set env or pre-create e2e/storageState.json by logging in manually. Skipping login step.'
      )
      try {
        await fs.mkdir(storageDir, { recursive: true })
        await context.storageState({ path: storagePath })
      } catch {}
      await browser.close()
      return
    }
    await page.goto(base + '/auth', { waitUntil: 'domcontentloaded', timeout: 15000 })

    const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i))
    const passInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i))
    await emailInput.fill(email)
    await passInput.fill(password)

    await page
      .getByRole('button', { name: /continue|sign in|log in/i })
      .first()
      .click()

    // Wait for auth to settle: either navigation away from /auth or Supabase token response
    const postAuthSettled = await Promise.race([
      page
        .waitForURL((url) => !url.pathname.startsWith('/auth'), { timeout: 30000 })
        .then(() => true)
        .catch(() => false),
      page
        .waitForResponse((res) => res.url().includes('/auth/v1/token') && res.ok(), {
          timeout: 30000,
        })
        .then(() => true)
        .catch(() => false),
    ])
    if (!postAuthSettled) {
      console.warn('[global.setup] Post-auth did not settle; proceeding to debug-auth anyway.')
    }

    // Try a few attempts to reach debug-auth and see the session/org markers
    let verified = false
    for (let i = 0; i < 3 && !verified; i++) {
      await page.goto(base + '/debug-auth', { waitUntil: 'load', timeout: 30000 })
      try {
        // Only verify that the session is present here.
        // Org association can legitimately lag behind login and is handled below via DB upsert + retry.
        await page.waitForFunction(() => {
          const sid = document.querySelector('[data-testid="session-user-id"]')
          const s = (sid?.textContent ?? '').trim()
          return s !== '' && s !== '—'
        })
        verified = true
      } catch {
        // If still redirected to /auth, wait a bit and retry
        if (page.url().includes('/auth')) {
          await page.waitForTimeout(2000)
        } else {
          // Take a screenshot to help diagnose
          try {
            await page.screenshot({
              path: path.join(storageDir, `setup-debug-auth-fail-${i + 1}.png`),
            })
          } catch {}
          await page.waitForTimeout(1000)
        }
      }
    }
    if (!verified) {
      try {
        await page.screenshot({ path: path.join(storageDir, 'setup-final.png'), fullPage: true })
        const html = await page.content()
        await fs.writeFile(path.join(storageDir, 'setup-final.html'), html)
      } catch {}
      throw new Error('[global.setup] Unable to verify session on /debug-auth after login')
    }
  }

  // Ensure elevated role for admin-only flows in tests
  try {
    await page.evaluate(() => {
      localStorage.setItem('userRole', 'admin')
    })
  } catch {}

  // Give Supabase trigger a moment to write the profile row, then force org association
  await page.waitForTimeout(2000)
  try {
    await associateUserWithE2EOrg()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.warn('[global.setup] Warning: org association failed:', message)
  }

  // After org association attempt, verify /debug-auth reflects a real orgId.
  // Some app code reads orgId from the profile row, so it can lag behind login.
  try {
    await page.goto(base + '/debug-auth', { waitUntil: 'load', timeout: 30000 })
    await page.waitForFunction(
      () => {
        const oid = document.querySelector('[data-testid="profile-org-id"]')
        const o = (oid?.textContent ?? '').trim()
        return o !== '' && o !== 'undefined' && o !== 'null'
      },
      undefined,
      { timeout: 30000 }
    )
  } catch {
    try {
      await page.screenshot({
        path: path.join(storageDir, 'setup-orgid-missing.png'),
        fullPage: true,
      })
      const html = await page.content()
      await fs.writeFile(path.join(storageDir, 'setup-orgid-missing.html'), html)
    } catch {}
    throw new Error(
      '[global.setup] Logged in but orgId was still missing on /debug-auth after DB association'
    )
  }

  await fs.mkdir(storageDir, { recursive: true })
  await context.storageState({ path: storagePath })
  await browser.close()
}

async function associateUserWithE2EOrg() {
  const connStr =
    process.env.DATABASE_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.DIRECT_URL ||
    process.env.SUPABASE_DATABASE_URL ||
    process.env.SUPABASE_POSTGRES_URL
  const e2eEmail = process.env.E2E_EMAIL
  const configuredOrg = process.env.E2E_ORG_ID

  if (!connStr) {
    console.log(
      '[global.setup] No DB connection env var found (DATABASE_URL/SUPABASE_DB_URL/POSTGRES_URL/DIRECT_URL/etc); skipping org association'
    )
    return
  }
  if (!e2eEmail) {
    console.log('[global.setup] E2E_EMAIL missing; skipping org association')
    return
  }

  const { Client } = await import('pg')

  // Keep this in sync with scripts/sql/seed_e2e.sql
  const DEFAULT_E2E_ORG_ID = '00000000-0000-0000-0000-0000000000e2'

  const buildClientConfig = async (connectionString: string) => {
    const url = new URL(connectionString)

    const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
    const requiresSsl =
      sslmode === 'require' ||
      // Supabase Postgres typically requires SSL; default to SSL for supabase hosts.
      /\.supabase\.co$/i.test(url.hostname) ||
      /\.pooler\.supabase\.com$/i.test(url.hostname)

    // Note: do NOT log connectionString.
    return {
      connectionString,
      connectionTimeoutMillis: 7_500,
      ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
    } as const
  }

  const buildClientConfigWithIpv4Host = async (connectionString: string) => {
    const url = new URL(connectionString)
    let ipv4: string
    try {
      ipv4 = await dns.lookup(url.hostname, { family: 4 }).then((r) => r.address)
    } catch (err) {
      const code = (err as any)?.code as string | undefined
      const message = err instanceof Error ? err.message : String(err)
      if (code === 'ENOTFOUND') {
        throw new Error(
          `[global.setup] DB host has no IPv4 A record: ${url.hostname}. ` +
            `If your environment cannot reach IPv6, use a Supabase pooler connection string (IPv4) ` +
            `or enable IPv6 routing. Original error: ${message}`
        )
      }
      throw err
    }

    const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
    const requiresSsl =
      sslmode === 'require' ||
      /\.supabase\.co$/i.test(url.hostname) ||
      /\.pooler\.supabase\.com$/i.test(url.hostname)

    return {
      host: ipv4,
      port: url.port ? Number(url.port) : 5432,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database: url.pathname.replace(/^\//, ''),
      connectionTimeoutMillis: 7_500,
      ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
    } as const
  }

  const connectWithIpv4Fallback = async (connectionString: string) => {
    // First try normal connection string
    const primary = new Client(await buildClientConfig(connectionString))
    try {
      await primary.connect()
      return primary
    } catch (err) {
      try {
        await primary.end()
      } catch {}

      const message = err instanceof Error ? err.message : String(err)
      const code = (err as any)?.code as string | undefined

      // In WSL/CI, IPv6 routes may be unavailable; retry using an IPv4-resolved host.
      const looksLikeIpv6Unreach =
        code === 'ENETUNREACH' ||
        (typeof message === 'string' && /ENETUNREACH/i.test(message) && /:\d{2,5}\b/.test(message))

      if (!looksLikeIpv6Unreach) {
        const looksLikeAuthFailure =
          code === '28P01' ||
          (typeof message === 'string' && /password authentication failed/i.test(message))

        if (looksLikeAuthFailure) {
          // Provide actionable hints without logging credentials.
          let parsed: { host: string; port: string; db: string; user: string } | null = null
          try {
            const u = new URL(connectionString)
            parsed = {
              host: u.hostname,
              port: u.port || '5432',
              db: u.pathname.replace(/^\//, '') || 'postgres',
              user: decodeURIComponent(u.username),
            }
          } catch {}

          const isPooler = parsed ? /\.pooler\.supabase\.com$/i.test(parsed.host) : false
          const hint = isPooler
            ? 'If using Supabase connection pooling, the username should be like "postgres.<projectRef>" and the password must be your Supabase Database Password (URL-encoded if it contains special characters).'
            : 'Verify DATABASE_URL username/password and whether the database requires SSL.'

          const parsedText = parsed
            ? `Parsed: host=${parsed.host} port=${parsed.port} db=${parsed.db} user=${parsed.user}`
            : 'Could not parse DATABASE_URL for additional hints.'

          throw new Error(`[global.setup] DB authentication failed. ${hint} ${parsedText}`)
        }

        throw err
      }

      try {
        const fallback = new Client(await buildClientConfigWithIpv4Host(connectionString))
        await fallback.connect()
        return fallback
      } catch (fallbackErr) {
        // If IPv4 fallback isn’t possible, prefer surfacing the original IPv6 routing failure.
        const fbMessage = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr)
        throw new Error(`${message} (IPv4 fallback failed: ${fbMessage})`)
      }
    }
  }

  const maxAttempts = 5

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const client = await connectWithIpv4Fallback(connStr)
    try {
      const check = await client.query(
        'select id, org_id from public.user_profiles where email = $1',
        [e2eEmail]
      )

      if (check.rowCount === 0) {
        // Seed may run before the test user exists in auth.users.
        // After we log in during globalSetup, ensure the profile row exists by upserting from auth.users.
        const targetOrgForInsert = configuredOrg || DEFAULT_E2E_ORG_ID
        try {
          await client.query(
            `insert into public.organizations (id, name)
             values ($1::uuid, 'E2E Org')
             on conflict (id) do update set name = excluded.name`,
            [targetOrgForInsert]
          )

          const upsert = await client.query(
            `insert into public.user_profiles (id, email, full_name, role, org_id, is_active)
             select
               au.id,
               au.email,
               coalesce(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', au.email) as full_name,
               'staff'::public.user_role as role,
               $2::uuid as org_id,
               true as is_active
             from auth.users au
             where au.email = $1
             on conflict (id) do update
             set org_id = excluded.org_id,
                 is_active = excluded.is_active
             returning id`,
            [e2eEmail, targetOrgForInsert]
          )

          if (upsert.rowCount && upsert.rowCount > 0) {
            console.log(
              `[global.setup] Attempt ${attempt}/${maxAttempts}: created user_profiles row from auth.users (email=${e2eEmail}).`
            )
          } else {
            console.log(
              `[global.setup] Attempt ${attempt}/${maxAttempts}: auth.users row not found yet for ${e2eEmail}; retrying...`
            )
          }
        } catch (innerErr) {
          const msg = innerErr instanceof Error ? innerErr.message : String(innerErr)
          console.warn(
            `[global.setup] Attempt ${attempt}/${maxAttempts}: profile upsert attempt failed: ${msg}`
          )
        }

        await client.end()
        if (attempt < maxAttempts) {
          await new Promise((r) => setTimeout(r, 1000))
          continue
        }
        throw new Error('profile not found after retries')
      }

      const currentOrg = check.rows[0]?.org_id as string | null | undefined
      const targetOrg = configuredOrg || currentOrg

      if (!targetOrg) {
        console.log(
          `[global.setup] Attempt ${attempt}/${maxAttempts}: profile has no org_id and E2E_ORG_ID is not set; skipping org association.`
        )
        await client.end()
        return
      }

      // If the profile already has an org, keep it unless E2E_ORG_ID overrides.
      // This avoids foreign key violations when the hard-coded E2E org doesn't exist in the DB.
      const update = await client.query(
        `update public.user_profiles
         set org_id = $1, is_active = true, updated_at = CURRENT_TIMESTAMP
         where email = $2
         returning org_id`,
        [targetOrg, e2eEmail]
      )

      const newOrg = update.rows[0]?.org_id
      console.log(`[global.setup] org association attempt ${attempt}: org_id=${newOrg ?? 'null'}`)

      if (newOrg === targetOrg) {
        await client.end()
        return
      }

      await client.end()
      if (attempt < maxAttempts) {
        await new Promise((r) => setTimeout(r, 1000))
      }
    } catch (err) {
      try {
        await client.end()
      } catch {}
      if (attempt === maxAttempts) throw err
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
}
