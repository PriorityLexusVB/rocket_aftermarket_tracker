import { test, expect } from '@playwright/test'

test('banner pills update URL query params', async ({ page, baseURL }) => {
  await page.goto((baseURL ?? 'http://127.0.0.1:5174') + '/calendar-flow-management-center', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000,
  })

  if (page.url().includes('/auth')) {
    throw new Error(
      'Not authenticated (redirected to /auth). Ensure e2e/storageState.json exists and is valid.'
    )
  }

  const overduePill = page.getByRole('button', { name: 'Show overdue' })
  const needsTimePill = page.getByRole('button', { name: 'Show items needing time' })

  const hasOverdue = (await overduePill.count()) > 0
  const hasNeedsTime = (await needsTimePill.count()) > 0

  if (!hasOverdue || !hasNeedsTime) {
    test.skip(true, 'Overdue/Needs Time banner pills are not visible in this dataset.')
  }

  await overduePill.first().click()
  await expect(page).toHaveURL(/(?:\?|&)banner=overdue(?:&|$)/)

  await needsTimePill.first().click()
  await expect(page).toHaveURL(/(?:\?|&)banner=needs_time(?:&|$)/)
})
