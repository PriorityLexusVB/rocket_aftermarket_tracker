import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

// Helper to require an authenticated session and org before proceeding
async function ensureSessionAndOrg(page: Page) {
  await page.goto('/debug-auth')
  const hasSession = await page
    .getByTestId('session-user-id')
    .isVisible()
    .catch(() => false)
  const hasOrg = await page
    .getByTestId('profile-org-id')
    .isVisible()
    .catch(() => false)
  test.skip(!(hasSession && hasOrg), 'No authenticated session/org; skipping persistence test')
}

// Capture the current value of a native <select>
async function getSelectValue(select: ReturnType<Page['locator']>) {
  return (await select.locator('option:checked').getAttribute('value')) || ''
}

// Select first non-placeholder option (index 1) and return the value string
async function pickFirstRealOption(select: ReturnType<Page['locator']>) {
  await expect(select).toBeVisible()
  const optionCount = await select.locator('option').count()
  expect(optionCount).toBeGreaterThan(1)
  await select.selectOption({ index: 1 })
  return getSelectValue(select)
}

// This spec provides explicit persistence coverage for all primary dropdowns in DealForm
// (vendor, sales, finance, delivery, and first line item product) across save and reload.

test.describe('Deal dropdown persistence across save + reload', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('create -> edit: selected values persist exactly', async ({ page }) => {
    await ensureSessionAndOrg(page)

    // Start a new deal
    await page.goto('/deals/new')
    await expect(page.getByTestId('deal-form')).toBeVisible()

    // Primary dropdowns
    const vendor = page.getByTestId('vendor-select')
    const sales = page.getByTestId('sales-select')
    const finance = page.getByTestId('finance-select')
    const delivery = page.getByTestId('delivery-select')

    const vendorVal = await pickFirstRealOption(vendor)
    const salesVal = await pickFirstRealOption(sales)
    const financeVal = await pickFirstRealOption(finance)
    const deliveryVal = await pickFirstRealOption(delivery)

    // Line item product (ensure at least one product so save can succeed)
    const product = page.getByTestId('product-select-0')
    const productVal = await pickFirstRealOption(product)
    // Capture unit price after product auto-fill
    const unitPrice = page.getByTestId('unit-price-input-0')
    await expect(unitPrice).toBeVisible()
    const unitPriceVal = await unitPrice.inputValue()

    // Save the deal
    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    // Redirect to edit page
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 15000 })

    // Verify exact selections persisted on edit page
    await expect(page.getByTestId('vendor-select')).toHaveValue(vendorVal)
    await expect(page.getByTestId('sales-select')).toHaveValue(salesVal)
    await expect(page.getByTestId('finance-select')).toHaveValue(financeVal)
    await expect(page.getByTestId('delivery-select')).toHaveValue(deliveryVal)
    await expect(page.getByTestId('product-select-0')).toHaveValue(productVal)
    await expect(page.getByTestId('unit-price-input-0')).toHaveValue(unitPriceVal)

    // Reload and confirm still persisted
    await page.reload()
    await expect(page.getByTestId('vendor-select')).toHaveValue(vendorVal)
    await expect(page.getByTestId('sales-select')).toHaveValue(salesVal)
    await expect(page.getByTestId('finance-select')).toHaveValue(financeVal)
    await expect(page.getByTestId('delivery-select')).toHaveValue(deliveryVal)
    await expect(page.getByTestId('product-select-0')).toHaveValue(productVal)
    await expect(page.getByTestId('unit-price-input-0')).toHaveValue(unitPriceVal)
  })
})
