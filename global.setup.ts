import { chromium } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'
// Ensure env vars (E2E_EMAIL/E2E_PASSWORD, PLAYWRIGHT_BASE_URL) load from .env.local/.env
import dotenv from 'dotenv'
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
  const storageDir = path.join(process.cwd(), 'e2e')
  const storagePath = path.join(storageDir, 'storageState.json')

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
      if (/(auth|supabase)\//i.test(url)) {
        console.log(`[setup:response] ${res.status()} ${url}`)
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
    const hasSession = await page
      .getByTestId('session-user-id')
      .isVisible()
      .catch(() => false)
    const hasOrg = await page
      .getByTestId('profile-org-id')
      .isVisible()
      .catch(() => false)
    hasValidState = !!(hasSession && hasOrg)
  } catch {}

  if (!hasValidState) {
    // Ensure auth flow (adjust selectors if needed)
    const email = process.env.E2E_EMAIL
    const password = process.env.E2E_PASSWORD
    if (!email || !password) {
      console.error(
        '[global.setup] Missing E2E_EMAIL/E2E_PASSWORD. Set env or pre-create e2e/storageState.json by logging in manually. Skipping login step.'
      )
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
        await page.getByTestId('session-user-id').waitFor({ state: 'visible', timeout: 15000 })
        await page.getByTestId('profile-org-id').waitFor({ state: 'visible', timeout: 15000 })
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

  await fs.mkdir(storageDir, { recursive: true })
  await context.storageState({ path: storagePath })
  await browser.close()
}
