import { test, expect } from '@playwright/test'
import dotenv from 'dotenv'
import path from 'path'
import { existsSync } from 'fs'

try {
  const root = __dirname
  for (const f of ['../.env.local', '../.env']) {
    const p = path.resolve(root, f)
    if (existsSync(p)) dotenv.config({ path: p })
  }
} catch {}

// Disable manual helper by default; enable with MANUAL_LOGIN=1
const manual = process.env.MANUAL_LOGIN === '1'

// Helper spec to capture an authenticated storage state via manual login.
// Steps:
// 1) This test opens the /auth page.
// 2) You type your credentials and sign in.
// 3) The test waits until you're redirected to /deals.
// 4) It then visits /debug-auth to confirm session/org and saves storageState.

test('manual login captures storage state', async ({ page, context }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'

  if (manual) {
    // Open the auth page for manual login
    await page.goto(base + '/auth')

    // Optional convenience: pre-fill email if provided via env
    const email = process.env.E2E_EMAIL
    if (email) {
      await page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).fill(email)
    }

    // Wait up to 2 minutes for the login to complete and redirect to /deals
    await page.waitForURL('**/deals', { timeout: 120_000 })
  } else {
    // In non-manual mode, validate that globalSetup/storageState already provides auth.
    await page.goto(base + '/debug-auth')
    await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 30_000 })
    await expect(page.getByTestId('profile-org-id')).toBeVisible({ timeout: 30_000 })
  }

  // Confirm session and org presence on debug page
  await page.goto(base + '/debug-auth')
  await page.getByTestId('session-user-id').waitFor({ state: 'visible', timeout: 60_000 })
  await page.getByTestId('profile-org-id').waitFor({ state: 'visible', timeout: 60_000 })

  // Persist authenticated state for subsequent tests
  await context.storageState({ path: 'e2e/storageState.json' })
})
