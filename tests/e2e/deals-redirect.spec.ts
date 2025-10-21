import { test, expect } from '@playwright/test'

test.describe('Deal create redirect', () => {
  test.beforeEach(async ({ page }) => {
    // Safety: block Twilio/external
    await page.route('**/twilio/**', (route) =>
      route.fulfill({ status: 200, body: '{"sid":"fake-e2e"}' })
    )
  })

  test('saving a new deal redirects to /deals/:id/edit (stubbed insert)', async ({ page }) => {
    await page.goto('/deals/new')

    // Vendor
    const vendorSelect = page.getByTestId('vendor-select')
    await expect(vendorSelect).toBeVisible()
    await vendorSelect.selectOption({ index: 1 })

    // Product line 0
    const productSelect = page.getByTestId('product-select-0')
    await expect(productSelect).toBeVisible()
    await productSelect.selectOption({ index: 1 })

    // Ensure unit price non-zero if editable
    const unitPrice = page.getByTestId('unit-price-input-0')
    if (await unitPrice.isVisible()) {
      const value = await unitPrice.inputValue()
      if (!value || Number(value) === 0) {
        await unitPrice.fill('100')
      }
    }

    // Stub Supabase insert for deals (table may be jobs or deals; match both)
    let insertCalled = false
    await page.route('**/rest/v1/**', async (route) => {
      const req = route.request()
      const url = new URL(req.url())
      const isDeals = /\/rest\/v1\/(deals|jobs)/.test(url.pathname)
      if (isDeals && req.method() === 'POST') {
        insertCalled = true
        const fake = [{ id: 'e2e-redirect-123' }]
        return route.fulfill({
          status: 201,
          contentType: 'application/json',
          headers: { 'preference-applied': 'return=representation' },
          body: JSON.stringify(fake),
        })
      }
      return route.continue()
    })

    // Save
    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    await page.waitForURL(/\/deals\/[^/]+\/edit(\?.*)?$/, { timeout: 10_000 })
    expect(insertCalled).toBeTruthy()

    await expect(page.getByText(/edit deal|deal details/i)).toBeVisible({ timeout: 5000 })
  })
})
