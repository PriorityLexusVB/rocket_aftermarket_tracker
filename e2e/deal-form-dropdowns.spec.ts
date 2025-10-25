import { test, expect } from '@playwright/test'

test.describe('Deal Form dropdowns and line items', () => {
  test('dropdowns populate and product auto-fills unit price', async ({ page }) => {
    // Preflight: ensure we have an authenticated session (via storageState)
    await page.goto('/debug-auth')
    const hasSession = await page
      .getByTestId('session-user-id')
      .isVisible()
      .catch(() => false)
    const hasOrg = await page
      .getByTestId('profile-org-id')
      .isVisible()
      .catch(() => false)
    test.skip(!(hasSession && hasOrg), 'No authenticated session; skipping dropdown test')

    await page.goto('/deals/new')

    // Wait for the form to render
    await expect(page.getByTestId('deal-form')).toBeVisible()

    // Vendor dropdown should have options beyond the placeholder
    const vendorSelect = page.getByTestId('vendor-select')
    await expect(vendorSelect).toBeVisible()
    const vendorOptions = vendorSelect.locator('option')
    expect(await vendorOptions.count()).toBeGreaterThan(1)

    // Sales / Finance / Delivery dropdowns should populate
    expect(await page.getByTestId('sales-select').locator('option').count()).toBeGreaterThan(1)
    expect(await page.getByTestId('finance-select').locator('option').count()).toBeGreaterThan(1)
    expect(await page.getByTestId('delivery-select').locator('option').count()).toBeGreaterThan(1)

    // Product dropdown for first line item should populate
    const productSelect = page.getByTestId('product-select-0')
    await expect(productSelect).toBeVisible()
    const productOptions = productSelect.locator('option')
    expect(await productOptions.count()).toBeGreaterThan(1)

    // Select first real product (index 1 skips the placeholder)
    await productSelect.selectOption({ index: 1 })

    // Unit price should auto-fill to a number (>= 0)
    const unitPrice = page.getByTestId('unit-price-input-0')
    await expect(unitPrice).toBeVisible()
    const priceVal = await unitPrice.inputValue()
    expect(Number(priceVal)).toBeGreaterThanOrEqual(0)

    // Toggle scheduling off -> reason appears; then on -> reason disappears
    const requires = page.getByTestId('requires-scheduling-0')
    // Ensure initial state known
    await expect(requires).toBeChecked()
    // Toggle off via associated label to avoid styled-checkbox overlays
    await page.locator('label[for="requiresScheduling-0"]').click()
    await expect(requires).not.toBeChecked()
    const reason = page.getByTestId('no-schedule-reason-0')
    await expect(reason).toBeVisible()
    // Toggle back on
    await page.locator('label[for="requiresScheduling-0"]').click()
    await expect(reason).toHaveCount(0)
  })
})
