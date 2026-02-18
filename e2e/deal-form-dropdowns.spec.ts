import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForDealForm(page: Page) {
  const v1 = page.getByTestId('deal-form')
  const v2 = page.getByTestId('deal-date-input')

  await Promise.race([
    v1.waitFor({ state: 'visible', timeout: 15_000 }),
    v2.waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function isDealFormV2(page: Page) {
  return page
    .getByTestId('deal-date-input')
    .isVisible()
    .catch(() => false)
}

async function goToLineItemsStepIfNeeded(page: Page) {
  if (!(await isDealFormV2(page))) return

  const customerName = page.getByTestId('customer-name-input')
  if ((await customerName.inputValue().catch(() => '')).trim() === '') {
    await customerName.fill(`E2E Customer ${Date.now()}`)
  }

  const dealNumber = page.getByTestId('deal-number-input')
  if ((await dealNumber.inputValue().catch(() => '')).trim() === '') {
    await dealNumber.fill(`E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  }

  const next = page.getByTestId('next-to-line-items-btn')
  if (await next.isVisible().catch(() => false)) {
    await next.click()
  }
}

async function ensureFirstLineItemVisible(page: Page) {
  const product = page.getByTestId('product-select-0')
  if (await product.isVisible().catch(() => false)) return

  const addItemButton = page.getByRole('button', { name: /add item/i })
  if (await addItemButton.isVisible().catch(() => false)) {
    await addItemButton.click()
  }
}

test.describe('Deal Form dropdowns and line items', () => {
  test('dropdowns populate and product auto-fills unit price', async ({ page }) => {
    // Preflight: ensure we have an authenticated session (via storageState)
    await page.goto('/debug-auth')
    await expect(page.getByTestId('session-user-id')).not.toHaveText('—', {
      timeout: process.env.CI ? 30_000 : 15_000,
    })
    await expect(page.getByTestId('profile-org-id')).not.toHaveText(/^(undefined|null)$/, {
      timeout: process.env.CI ? 30_000 : 15_000,
    })

    await page.goto('/deals/new')

    // Wait for the form to render
    await waitForDealForm(page)

    // Sales / Finance / Delivery dropdowns should either populate OR show empty-state hints.
    const salesSelect = page.getByTestId('sales-select')
    const financeSelect = page.getByTestId('finance-select')
    const deliverySelect = page.getByTestId('delivery-select')
    await expect(salesSelect).toBeVisible()
    await expect(financeSelect).toBeVisible()
    await expect(deliverySelect).toBeVisible()

    expect(await salesSelect.locator('option').count()).toBeGreaterThanOrEqual(1)
    expect(await financeSelect.locator('option').count()).toBeGreaterThanOrEqual(1)
    expect(await deliverySelect.locator('option').count()).toBeGreaterThanOrEqual(1)

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)

    // Vendor selector differs by form version:
    // - V1: top-level vendor-select
    // - V2: line-vendor-0 in line items step
    const vendorSelectV1 = page.getByTestId('vendor-select')
    const lineVendorV2 = page.getByTestId('line-vendor-0')
    const hasVendorV1 = await vendorSelectV1.isVisible().catch(() => false)
    const hasLineVendorV2 = await lineVendorV2.isVisible().catch(() => false)

    if (hasVendorV1 || hasLineVendorV2) {
      const activeVendorSelect = hasVendorV1 ? vendorSelectV1 : lineVendorV2
      await expect(activeVendorSelect).toBeVisible({ timeout: 15_000 })
      expect(await activeVendorSelect.locator('option').count()).toBeGreaterThanOrEqual(1)
    }

    // Product dropdown for first line item should populate
    const productSelect = page.getByTestId('product-select-0')
    await expect(productSelect).toBeVisible({ timeout: 15_000 })
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
    const unitPriceCandidates = [
      page.getByTestId('unit-price-input-0'),
      page.getByLabel(/unit price/i).first(),
      page.getByRole('spinbutton').first(),
      page.locator('input[type="number"]').first(),
    ]

    let unitPrice = unitPriceCandidates[0]
    for (const candidate of unitPriceCandidates) {
      if (await candidate.isVisible().catch(() => false)) {
        unitPrice = candidate
        break
      }
    }

    await expect(unitPrice).toBeVisible()
    const priceVal = await unitPrice.inputValue()
    expect(Number(priceVal)).toBeGreaterThanOrEqual(0)

    // Toggle scheduling off -> reason appears; then on -> reason disappears (V1 and V2 compatible)
    const requires = page.getByTestId('requires-scheduling-0')
    // Ensure initial state known (default can vary by environment)
    if (!(await requires.isChecked().catch(() => false))) {
      await page.locator('label[for="requiresScheduling-0"]').click()
      await expect(requires).toBeChecked({ timeout: 5_000 })
    }
    // Toggle off (prefer direct checkbox, fallback to legacy label click)
    await requires.uncheck().catch(async () => {
      await page.locator('label[for="requiresScheduling-0"]').click()
    })
    await expect(requires).not.toBeChecked()
    const reasonV1 = page.getByTestId('no-schedule-reason-0')
    const reasonV2 = page.locator('input[placeholder*="installed at delivery"]')
    const hasV1Reason = await reasonV1.isVisible().catch(() => false)
    const hasV2Reason = await reasonV2.first().isVisible().catch(() => false)
    expect(hasV1Reason || hasV2Reason).toBeTruthy()
    // Toggle back on
    await requires.check().catch(async () => {
      await page.locator('label[for="requiresScheduling-0"]').click()
    })

    if (hasV1Reason) {
      await expect(reasonV1).toHaveCount(0)
    } else {
      await expect(reasonV2).toHaveCount(0)
    }
  })
})
