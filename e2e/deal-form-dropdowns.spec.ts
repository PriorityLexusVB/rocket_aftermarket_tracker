import { test, expect } from '@playwright/test'

import { missingAuthEnv } from './_authEnv'

test.describe('Deal Form dropdowns and line items', () => {
  test('dropdowns populate and product auto-fills unit price', async ({ page }) => {
    // Preflight: ensure we have an authenticated session (via storageState)
    await page.goto('/debug-auth')
    await expect(page.getByTestId('session-user-id')).not.toHaveText('—', { timeout: 15_000 })
    await expect(page.getByTestId('profile-org-id')).not.toHaveText(/^(undefined|null)$/, {
      timeout: 15_000,
    })

    await page.goto('/deals/new')

    // Wait for the form to render
    await expect(page.getByTestId('deal-form')).toBeVisible()

    // Vendor dropdown should either populate OR show the empty-state hint.
    const vendorSelect = page.getByTestId('vendor-select')
    await expect(vendorSelect).toBeVisible()
    await page
      .waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="vendor-select"]')
          if (!el || !(el instanceof HTMLSelectElement)) return false
          // 1 option = placeholder only; allow that if empty-state message is present.
          if (el.options.length > 1) return true
          return document.body.innerText.includes('No vendors found yet')
        },
        { timeout: 30_000 }
      )
      .catch(() => {
        throw new Error('Vendor dropdown did not populate and empty-state message did not render')
      })
    const vendorOptions = vendorSelect.locator('option')
    expect(await vendorOptions.count()).toBeGreaterThanOrEqual(1)

    // Sales / Finance / Delivery dropdowns should either populate OR show empty-state hints.
    const salesSelect = page.getByTestId('sales-select')
    const financeSelect = page.getByTestId('finance-select')
    const deliverySelect = page.getByTestId('delivery-select')
    await expect(salesSelect).toBeVisible()
    await expect(financeSelect).toBeVisible()
    await expect(deliverySelect).toBeVisible()

    await page
      .waitForFunction(
        () => {
          const sales = document.querySelector('[data-testid="sales-select"]')
          const finance = document.querySelector('[data-testid="finance-select"]')
          const delivery = document.querySelector('[data-testid="delivery-select"]')
          if (!(sales instanceof HTMLSelectElement)) return false
          if (!(finance instanceof HTMLSelectElement)) return false
          if (!(delivery instanceof HTMLSelectElement)) return false
          const ok = (el: HTMLSelectElement, emptyText: string) =>
            el.options.length > 1 || document.body.innerText.includes(emptyText)
          return (
            ok(sales, 'No sales staff found yet') &&
            ok(finance, 'No finance managers found yet') &&
            ok(delivery, 'No delivery coordinators found yet')
          )
        },
        { timeout: 30_000 }
      )
      .catch(() => {
        throw new Error('Staff dropdowns did not populate and empty-state messages did not render')
      })

    expect(await salesSelect.locator('option').count()).toBeGreaterThanOrEqual(1)
    expect(await financeSelect.locator('option').count()).toBeGreaterThanOrEqual(1)
    expect(await deliverySelect.locator('option').count()).toBeGreaterThanOrEqual(1)

    // Product dropdown for first line item should populate
    const productSelect = page.getByTestId('product-select-0')
    await expect(productSelect).toBeVisible()
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

    // Select first real product (index 1 skips the placeholder)
    await productSelect.selectOption({ index: 1 })

    // Unit price should auto-fill to a number (>= 0)
    const unitPrice = page.getByTestId('unit-price-input-0')
    await expect(unitPrice).toBeVisible()
    const priceVal = await unitPrice.inputValue()
    expect(Number(priceVal)).toBeGreaterThanOrEqual(0)

    // Toggle scheduling off -> reason appears; then on -> reason disappears
    const requires = page.getByTestId('requires-scheduling-0')
    // Ensure initial state known (default can vary by environment)
    if (!(await requires.isChecked().catch(() => false))) {
      await page.locator('label[for="requiresScheduling-0"]').click()
      await expect(requires).toBeChecked({ timeout: 5_000 })
    }
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
