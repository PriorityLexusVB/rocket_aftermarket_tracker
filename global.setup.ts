import { chromium } from '@playwright/test'
import fs from 'fs/promises'
import path from 'path'
// Ensure env vars (E2E_EMAIL/E2E_PASSWORD, PLAYWRIGHT_BASE_URL) load from .env.local/.env
import dotenv from 'dotenv'
import { existsSync } from 'fs'

try {
  const root = __dirname
  for (const f of ['.env.local', '.env']) {
    const p = path.resolve(root, f)
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

  // If storage exists and debug-auth shows both testids, skip login
  let hasValidState = false
  try {
    await page.goto(base + '/debug-auth')
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
    await page.goto(base + '/auth')

    const emailInput = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i))
    const passInput = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i))
    await emailInput.fill(email)
    await passInput.fill(password)

    await page
      .getByRole('button', { name: /continue|sign in|log in/i })
      .first()
      .click()
    await page.waitForLoadState('networkidle')

    // Confirm session on debug-auth then persist state
    await page.goto(base + '/debug-auth')
    await page.getByTestId('session-user-id').waitFor({ state: 'visible', timeout: 15000 })
    await page.getByTestId('profile-org-id').waitFor({ state: 'visible', timeout: 15000 })
  }

  await fs.mkdir(storageDir, { recursive: true })
  await context.storageState({ path: storagePath })
  await browser.close()
}
