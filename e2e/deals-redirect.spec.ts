import { test, expect } from '@playwright/test'

import { missingAuthEnv } from './_authEnv'
test.skip(missingAuthEnv, 'E2E auth env not set')

test.describe('Deal create redirect', () => {
  test('saving a new deal redirects to /deals/:id/edit', async ({ page }) => {
    await page.goto('/deals/new')

    // Description (required in current form)
    const description = page.getByTestId('description-input')
    await expect(description).toBeVisible()
    await description.fill('E2E Deal ' + Date.now())

    // First product line
    const product = page.getByTestId('product-select-0')
    await expect(product).toBeVisible()
    await page
      .waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="product-select-0"]')
          return !!el && el instanceof HTMLSelectElement && el.options.length > 1
        },
        { timeout: 30_000 }
      )
      .catch(() => {
        throw new Error(
          'No products available in test environment; seed E2E products or run admin-crud first.'
        )
      })
    await product.selectOption({ index: 1 })

    // Vendor jobs require a scheduled date
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const tomorrowDate = tomorrow.toISOString().slice(0, 10)
    const promisedDate = page.getByTestId('promised-date-0')
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill(tomorrowDate)

    // Save
    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    // Wait for navigation to edit (numeric or UUID IDs) with a slightly longer timeout
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 30_000 })
    await expect(page.getByText(/edit deal|deal details/i)).toBeVisible({ timeout: 5000 })
  })
})
