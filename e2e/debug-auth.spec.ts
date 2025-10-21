import { test, expect } from '@playwright/test'

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD
test.skip(missingAuthEnv, 'E2E auth env not set')

test('debug-auth shows session + org counts', async ({ page }) => {
  await page.goto('/debug-auth')

  await expect(page.getByTestId('session-user-id')).toBeVisible()
  await expect(page.getByTestId('profile-org-id')).toBeVisible()

  await expect(page.getByTestId('org-vendor-count')).toBeVisible()
  await expect(page.getByTestId('org-product-count')).toBeVisible()
  await expect(page.getByTestId('org-staff-count')).toBeVisible()
  await expect(page.getByTestId('org-sms-template-count')).toBeVisible()
})
