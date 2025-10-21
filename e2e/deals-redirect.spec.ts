import { test, expect } from '@playwright/test'

test.describe('Deal create redirect', () => {
  test('saving a new deal redirects to /deals/:id/edit', async ({ page }) => {
    await page.goto('/deals/new')

    // Title (required)
    const title = page.getByTestId('title-input')
    await expect(title).toBeVisible()
    await title.fill('E2E Deal ' + Date.now())

    // Vendor
    const vendor = page.getByTestId('vendor-select')
    await expect(vendor).toBeVisible()
    await vendor.selectOption({ index: 1 })

    // First product line
    const product = page.getByTestId('product-select-0')
    await expect(product).toBeVisible()
    await product.selectOption({ index: 1 })

    // Save
    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    await page.waitForURL(/\/deals\/\d+\/edit(\?.*)?$/, { timeout: 15_000 })
    await expect(page.getByText(/edit deal|deal details/i)).toBeVisible({ timeout: 5000 })
  })
})
