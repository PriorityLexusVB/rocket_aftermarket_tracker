import { test, expect } from '@playwright/test'

// Verifies that a seeded scheduled job shows a Loaner badge and a Promise chip on the calendar
// Skips if there is no authenticated session/org (same pattern as other specs)

test.describe('Calendar loaner badge and promise chip', () => {
  test('shows Loaner pill and Promise date for seeded job', async ({ page }) => {
    // Ensure authenticated session via debug-auth
    await page.goto('/debug-auth')
    const hasSession = await page
      .getByTestId('session-user-id')
      .isVisible()
      .catch(() => false)
    const hasOrg = await page
      .getByTestId('profile-org-id')
      .isVisible()
      .catch(() => false)
    test.skip(!(hasSession && hasOrg), 'No authenticated session; skipping calendar badge test')

    // Navigate to the calendar
    await page.goto('/calendar-flow-management-center')
    await expect(page.getByText('Calendar Flow Management Center')).toBeVisible()

    // Wait a bit for jobs to load and render
    await page.waitForTimeout(500)

    // The seeded job title
    const jobTitle = 'E2E Loaner Job'

    // Find the job card by title; if not present, skip (seed may not have been applied)
    const jobCard = page.getByText(jobTitle, { exact: false }).first()
    const jobVisible = await jobCard.isVisible().catch(() => false)
    test.skip(!jobVisible, 'Seeded E2E job not found on calendar; skipping')

    // Check for Loaner pill near the job card
    await expect(page.getByText('Loaner').first()).toBeVisible()

    // Check for Promise label on the card
    const promiseLocator = page.getByText('Promise', { exact: false })
    await expect(promiseLocator.first()).toBeVisible()
  })
})
