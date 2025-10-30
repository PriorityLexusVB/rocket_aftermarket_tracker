import { test, expect } from '@playwright/test'

// Validates that the DealForm sticky footer actions are visible and clickable on a small viewport
// and are not overlapped by the mobile bottom navbar.

test.describe('DealForm sticky footer - mobile', () => {
  test('save button is visible and clickable at 390x844', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })

    // Go to create page (assumes authenticated storageState is configured)
    await page.goto('/deals/new')

    // Wait for the form
    const form = page.getByTestId('deal-form')
    await expect(form).toBeVisible()

    // Ensure the sticky footer is present and the Save button visible
    const saveBtn = page.getByTestId('save-deal-btn')
    await saveBtn.scrollIntoViewIfNeeded()
    await expect(saveBtn).toBeVisible()

    // Click Save without adding products to trigger validation,
    // which also proves the click landed (not intercepted by navbar)
    await saveBtn.click()

    const error = page.getByTestId('save-error')
    await expect(error.or(page.getByText(/Please add at least one product/i))).toBeVisible()

    // Sticky actions are implemented as a section with sticky positioning; the Save button being
    // clickable suffices to assert it isn't obstructed by any mobile nav.
  })
})
