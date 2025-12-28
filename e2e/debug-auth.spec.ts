import { test, expect } from '@playwright/test'

import { requireAuthEnv } from './_authEnv'

test('debug-auth shows session + org counts', async ({ page }) => {
  requireAuthEnv()
  await page.goto('/debug-auth')

  await expect(page.getByTestId('session-user-id')).toBeVisible()
  await expect(page.getByTestId('profile-org-id')).toBeVisible()

  await expect(page.getByTestId('org-vendor-count')).toBeVisible()
  await expect(page.getByTestId('org-product-count')).toBeVisible()
  await expect(page.getByTestId('org-staff-count')).toBeVisible()
  await expect(page.getByTestId('org-sms-template-count')).toBeVisible()
})
