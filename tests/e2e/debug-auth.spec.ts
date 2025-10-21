import { test, expect } from '@playwright/test'

test('debug-auth shows session + org counts', async ({ page }) => {
  await page.goto('/debug-auth')

  await expect(page.getByTestId('session-user-id')).toBeVisible()
  await expect(page.getByTestId('profile-org-id')).toBeVisible()

  await expect(page.getByTestId('org-vendor-count')).toHaveText(/\d+/)
  await expect(page.getByTestId('org-product-count')).toHaveText(/\d+/)
  await expect(page.getByTestId('org-staff-count')).toHaveText(/\d+/)
})
