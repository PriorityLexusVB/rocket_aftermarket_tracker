import { test, expect } from '@playwright/test'

// This test intentionally does NOT require a working E2E login.
// It verifies that the app recovers from a corrupted/expired stored session
// without repeatedly spamming refresh-token errors.

test.use({ storageState: { cookies: [], origins: [] } })

test('boot does not spam invalid refresh token errors', async ({ page }) => {
  const consoleLines: string[] = []
  const tokenEndpointFailures: string[] = []

  const matchesRefreshTokenNoise = (text: string) =>
    /invalid refresh token|refresh token not found|token_refresh_failed/i.test(text)

  // Seed a bogus persisted session *before* any app JS runs.
  // The app's Supabase client uses storageKey: 'priority-automotive-auth'.
  await page.addInitScript(() => {
    try {
      const storageKey = 'priority-automotive-auth'
      const seededKey = 'e2e:seeded-bogus-supabase-session'

      // Only seed once per test run; reload should verify recovery behavior.
      if (localStorage.getItem(seededKey) === '1') return
      localStorage.setItem(seededKey, '1')

      const bogusSession = {
        access_token: 'e2e-bogus-access',
        refresh_token: 'e2e-bogus-refresh',
        token_type: 'bearer',
        expires_at: 0, // force refresh on boot
        user: {
          id: '00000000-0000-0000-0000-000000000000',
          email: 'e2e-bogus@example.com',
        },
      }
      localStorage.removeItem(storageKey)
      localStorage.setItem(storageKey, JSON.stringify(bogusSession))
    } catch {
      // ignore
    }
  })

  page.on('console', (msg) => {
    const text = msg.text()
    if (msg.type() === 'error' || matchesRefreshTokenNoise(text)) {
      consoleLines.push(`[${msg.type()}] ${text}`)
    }
  })

  page.on('response', (res) => {
    const url = res.url()
    if (!url.includes('/auth/v1/token')) return

    const status = res.status()
    if (status >= 400) {
      tokenEndpointFailures.push(`${status} ${url}`)
    }
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)

  const refreshTokenNoise = consoleLines.filter((l) => matchesRefreshTokenNoise(l))

  expect(
    refreshTokenNoise.length,
    `Unexpected repeated refresh-token noise:\n${refreshTokenNoise.join('\n')}`
  ).toBeLessThanOrEqual(1)

  expect(
    tokenEndpointFailures.length,
    `Unexpected repeated failing /auth/v1/token calls:\n${tokenEndpointFailures.join('\n')}`
  ).toBeLessThanOrEqual(1)
})
