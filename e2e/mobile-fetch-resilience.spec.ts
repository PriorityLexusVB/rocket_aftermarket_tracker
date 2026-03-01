import { test, expect, type ConsoleMessage, type Page } from '@playwright/test'
import { requireAuthEnv } from './_authEnv'

async function login(page: Page) {
  await page.goto('/debug-auth')
  const sessionUserId = page.getByTestId('session-user-id')
  const alreadyAuthed = await sessionUserId
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(async () => {
      const text = (await sessionUserId.textContent())?.trim() || ''
      return text !== '' && text !== '—'
    })
    .catch(() => false)

  if (alreadyAuthed) return

  const { email, password } = requireAuthEnv()
  await page.goto('/auth')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button:has-text("Sign In")')

  await page.goto('/debug-auth')
  await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('session-user-id')).not.toHaveText('—', { timeout: 30_000 })
}

function isFailedFetchConsole(message: ConsoleMessage) {
  return /failed to fetch/i.test(message.text())
}

test.describe('Mobile fetch resilience', () => {
  test('fails only when repeated fetch errors coincide with visible load failure', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    const failedFetchMessages: string[] = []
    page.on('console', (message) => {
      if (isFailedFetchConsole(message)) {
        failedFetchMessages.push(`${message.type()}: ${message.text()}`)
      }
    })

    await login(page)

    await page.goto('/calendar/agenda')

    const headingVisible = await page
      .getByRole('heading', { level: 1, name: 'Calendar' })
      .waitFor({ state: 'visible', timeout: 20_000 })
      .then(() => true)
      .catch(() => false)

    if (!headingVisible) {
      await page.goto('/calendar')
    }

    const agendaReady = await page
      .getByTestId('agenda-ready')
      .waitFor({ state: 'visible', timeout: 15_000 })
      .then(() => true)
      .catch(() => false)

    const calendarHeadingReady = await page
      .getByRole('heading', { level: 1, name: 'Calendar' })
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true)
      .catch(() => false)

    const loadingStuck = await page
      .getByText('Loading agenda…')
      .isVisible()
      .catch(() => false)

    const repeatedFetchFailures = failedFetchMessages.length >= 3
    const uiLoadFailed = !agendaReady && !calendarHeadingReady

    if (repeatedFetchFailures && (uiLoadFailed || loadingStuck)) {
      expect(
        {
          repeatedFetchFailures,
          uiLoadFailed,
          loadingStuck,
          failedFetchSample: failedFetchMessages.slice(0, 5),
        },
        'Repeated fetch failures now correlate with visible mobile UI load failure.'
      ).toEqual({
        repeatedFetchFailures: false,
        uiLoadFailed: false,
        loadingStuck: false,
        failedFetchSample: [],
      })
    }

    expect(calendarHeadingReady || agendaReady).toBe(true)
  })
})
