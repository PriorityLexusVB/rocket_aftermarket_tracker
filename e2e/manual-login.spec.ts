import { test } from '@playwright/test'
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

// If env credentials are present, globalSetup performs automatic login and saves storage state.
// In that case, skip this manual helper test.
// Disable manual helper by default; enable with MANUAL_LOGIN=1
const manual = process.env.MANUAL_LOGIN === '1'
test.skip(!manual, 'Manual login helper disabled by default; set MANUAL_LOGIN=1 to use')

// Helper spec to capture an authenticated storage state via manual login.
// Steps:
// 1) This test opens the /auth page.
// 2) You type your credentials and sign in.
// 3) The test waits until you're redirected to /deals.
// 4) It then visits /debug-auth to confirm session/org and saves storageState.

test('manual login captures storage state', async ({ page, context }) => {
  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173'

  // Open the auth page for manual login
  await page.goto(base + '/auth')

  // Optional convenience: pre-fill email if provided via env
  const email = process.env.E2E_EMAIL
  if (email) {
    await page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i)).fill(email)
  }

  // Wait up to 2 minutes for the login to complete and redirect to /deals
  await page.waitForURL('**/deals', { timeout: 120_000 })

  // Confirm session and org presence on debug page
  await page.goto(base + '/debug-auth')
  await page.getByTestId('session-user-id').waitFor({ state: 'visible', timeout: 60_000 })
  await page.getByTestId('profile-org-id').waitFor({ state: 'visible', timeout: 60_000 })

  // Persist authenticated state for subsequent tests
  await context.storageState({ path: 'e2e/storageState.json' })
})
