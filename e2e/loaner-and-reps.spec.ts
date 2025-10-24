import { test, expect } from '@playwright/test'

// Helper: skip when not authenticated
async function ensureAuth(page) {
  await page.goto('/debug-auth')
  const hasSession = await page
    .getByTestId('session-user-id')
    .isVisible()
    .catch(() => false)
  test.skip(!hasSession, 'No authenticated session; skipping')
}

// New Deal: reps visible and loaner toggles on first click
test('new deal: reps dropdowns present and loaner checkbox toggles once', async ({ page }) => {
  await ensureAuth(page)

  await page.goto('/deals/new')

  // Reps selects visible (Step 1)
  await expect(page.getByTestId('sales-select')).toBeVisible()
  await expect(page.getByTestId('delivery-select')).toBeVisible()
  await expect(page.getByTestId('finance-select')).toBeVisible()

  // Loaner checkbox toggles reliably
  const loaner = page.getByTestId('loaner-checkbox')
  await expect(loaner).toBeVisible()
  const wasChecked = await loaner.isChecked()
  await loaner.click() // single click should toggle
  await expect(loaner).toHaveJSProperty('checked', !wasChecked)
  await loaner.click()
  await expect(loaner).toHaveJSProperty('checked', wasChecked)
})

// Edit Deal: open first deal, verify reps and loaner toggle
// Note: Relies on at least one deal existing in the list.
// If none exist, this test will be skipped gracefully.
test('edit deal: reps visible and loaner checkbox toggles once', async ({ page }) => {
  await ensureAuth(page)

  await page.goto('/deals')

  // Try to open the first Edit modal
  const editLinks = page.locator('text=Edit')
  const count = await editLinks.count()
  test.skip(count === 0, 'No deals available to edit')
  await editLinks.first().click()

  // The modal should appear; verify reps blocks exist
  await expect(page.getByTestId('sales-select')).toBeVisible()
  await expect(page.getByTestId('delivery-select')).toBeVisible()
  await expect(page.getByTestId('finance-select')).toBeVisible()

  // Loaner checkbox behavior
  const loaner = page.getByTestId('loaner-checkbox')
  await expect(loaner).toBeVisible()
  const wasChecked = await loaner.isChecked()
  await loaner.click()
  await expect(loaner).toHaveJSProperty('checked', !wasChecked)
  await loaner.click()
  await expect(loaner).toHaveJSProperty('checked', wasChecked)
})
