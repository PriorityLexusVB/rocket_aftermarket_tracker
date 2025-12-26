// Node-based seed runner for E2E data without relying on Supabase CLI `db query`.
// Requires a Postgres connection string in one of:
//   - DATABASE_URL
//   - SUPABASE_DB_URL (fallback)
// Reads SQL from ./scripts/sql/seed_e2e.sql and executes it as a single batch.

import dns from 'node:dns/promises'
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

import dotenv from 'dotenv'
import { Client } from 'pg'

// Best-effort: load local env files for scripts.
// Never log env values.
{
  const root = process.cwd()
  const envFiles = ['.env.local', '.env']
  for (const filename of envFiles) {
    const fullPath = path.join(root, filename)
    if (fs.existsSync(fullPath)) {
      dotenv.config({ path: fullPath, override: false })
    }
  }
}

const buildClientConfig = (connectionString) => {
  const url = new URL(connectionString)

  const sslmode = url.searchParams.get('sslmode')?.toLowerCase()
  const requiresSsl =
    sslmode === 'require' ||
    /\.supabase\.co$/i.test(url.hostname) ||
    /\.pooler\.supabase\.com$/i.test(url.hostname)

  return {
    connectionString,
    connectionTimeoutMillis: 7_500,
    ssl: requiresSsl ? { rejectUnauthorized: false } : undefined,
  }
}

const buildClientConfigWithIpv4Host = async (connectionString) => {
  const url = new URL(connectionString)
  const ipv4 = await dns.lookup(url.hostname, { family: 4 }).then((r) => r.address)

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
  }
}

const connectWithIpv4Fallback = async (connectionString) => {
  const primary = new Client(buildClientConfig(connectionString))
  try {
    await primary.connect()
    return primary
  } catch (err) {
    try {
      await primary.end()
    } catch {}

    const message = err instanceof Error ? err.message : String(err)
    const code = err?.code

    const looksLikeIpv6Unreach =
      code === 'ENETUNREACH' ||
      (typeof message === 'string' && /ENETUNREACH/i.test(message) && /:\d{2,5}\b/.test(message))

    if (!looksLikeIpv6Unreach) throw err

    const fallback = new Client(await buildClientConfigWithIpv4Host(connectionString))
    await fallback.connect()
    return fallback
  }
}

const main = async () => {
  const root = process.cwd()
  const sqlPath = path.join(root, 'scripts', 'sql', 'seed_e2e.sql')
  const sql = fs.readFileSync(sqlPath, 'utf8')

  const connStr = process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
  if (!connStr) {
    console.error('[seedE2E] Missing DATABASE_URL or SUPABASE_DB_URL environment variable.')
    console.error('Set a Postgres connection string, e.g. postgres://user:pass@host:5432/dbname')
    process.exit(1)
  }

  const e2eEmail = process.env.E2E_EMAIL
  if (!e2eEmail) {
    console.error('[seedE2E] Missing E2E_EMAIL environment variable.')
    console.error('Set E2E_EMAIL to associate the test user with the E2E organization.')
    process.exit(1)
  }

  // Replace $E2E_EMAIL$ placeholder with actual email.
  const sqlWithParams = sql.replace(/\$E2E_EMAIL\$/g, `'${e2eEmail.replace(/'/g, "''")}'`)

  const client = await connectWithIpv4Fallback(connStr)
  try {
    await client.query('BEGIN')
    await client.query(sqlWithParams)

    // Verify the user profile was created/updated
    const result = await client.query(
      `SELECT id, email, org_id, full_name FROM public.user_profiles WHERE email = $1`,
      [e2eEmail]
    )

    await client.query('COMMIT')

    if (result.rows.length > 0) {
      const profile = result.rows[0]
      console.log('[seedE2E] ✅ Seed applied successfully.')
      console.log('[seedE2E] Test user profile:')
      console.log(`[seedE2E]   Email: ${profile.email}`)
      console.log(`[seedE2E]   Name: ${profile.full_name}`)
      console.log(`[seedE2E]   Org ID: ${profile.org_id}`)
      console.log(`[seedE2E]   Profile ID: ${profile.id}`)
    } else {
      console.warn(
        `[seedE2E] ⚠️ Warning: User profile for ${e2eEmail} was not found after seeding.`
      )
      console.warn(
        '[seedE2E] The user may not exist in auth.users yet. Make sure E2E_EMAIL matches an existing authenticated user.'
      )
      process.exit(1)
    }
  } catch (err) {
    try {
      await client.query('ROLLBACK')
    } catch {}
    console.error('[seedE2E] ❌ Seed failed:', err?.message || err)
    process.exit(1)
  } finally {
    await client.end()
  }
}

await main()
