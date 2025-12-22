import { test, expect } from '@playwright/test'

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

// This spec validates that create-deal staff/vendor dropdowns populate, selections can be made,
// and that those selections persist on the edit page and across reloads.
// Requires an authenticated session. global.setup.ts will create one if
// E2E_EMAIL/E2E_PASSWORD are provided, or if e2e/storageState.json already exists.

test.describe('Deal staff/vendor dropdowns - create -> edit persistence', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('selects staff/vendor on create and persists on edit', async ({ page }) => {
    // Preflight: require an authenticated session (debug-auth markers)
    await page.goto('/debug-auth')
    const hasSession = await page
      .getByTestId('session-user-id')
      .isVisible()
      .catch(() => false)
    const hasOrg = await page
      .getByTestId('profile-org-id')
      .isVisible()
      .catch(() => false)
    test.skip(!(hasSession && hasOrg), 'No authenticated session/org; skipping staff dropdown test')

    // Start a new deal
    await page.goto('/deals/new')
    await expect(page.getByTestId('deal-form')).toBeVisible()

    // Ensure all main dropdowns have at least one real option beyond placeholder
    const vendor = page.getByTestId('vendor-select')
    const sales = page.getByTestId('sales-select')
    const finance = page.getByTestId('finance-select')
    const delivery = page.getByTestId('delivery-select')

    await expect(vendor).toBeVisible()
    await expect(sales).toBeVisible()
    await expect(finance).toBeVisible()
    await expect(delivery).toBeVisible()

    const vendorOptions = vendor.locator('option')
    const salesOptions = sales.locator('option')
    const financeOptions = finance.locator('option')
    const deliveryOptions = delivery.locator('option')

    expect(await vendorOptions.count()).toBeGreaterThan(1)
    expect(await salesOptions.count()).toBeGreaterThan(1)
    expect(await financeOptions.count()).toBeGreaterThan(1)
    expect(await deliveryOptions.count()).toBeGreaterThan(1)

    // Select first real option (index 1) for each
    await vendor.selectOption({ index: 1 })
    await sales.selectOption({ index: 1 })
    await finance.selectOption({ index: 1 })
    await delivery.selectOption({ index: 1 })

    // Also add first product so the save can succeed
    const product = page.getByTestId('product-select-0')
    await expect(product).toBeVisible()
    await product.selectOption({ index: 1 })

    // Save the deal
    const saveBtn = page.getByTestId('save-deal-btn')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Expect redirect to edit page
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 15000 })

    // On edit page, verify the selections are still set (native selects should reflect a non-empty value)
    await expect(page.getByTestId('vendor-select')).not.toHaveValue('')
    await expect(page.getByTestId('sales-select')).not.toHaveValue('')
    await expect(page.getByTestId('finance-select')).not.toHaveValue('')
    await expect(page.getByTestId('delivery-select')).not.toHaveValue('')

    // Reload and confirm persistence
    await page.reload()
    await expect(page.getByTestId('vendor-select')).not.toHaveValue('')
    await expect(page.getByTestId('sales-select')).not.toHaveValue('')
    await expect(page.getByTestId('finance-select')).not.toHaveValue('')
    await expect(page.getByTestId('delivery-select')).not.toHaveValue('')
  })
})
