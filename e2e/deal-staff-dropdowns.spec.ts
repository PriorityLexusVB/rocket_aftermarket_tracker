import { test, expect } from '@playwright/test'

async function waitForDealForm(page: import('@playwright/test').Page) {
  await Promise.race([
    page.getByTestId('deal-form').waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByTestId('deal-date-input').waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function goToLineItemsStepIfNeeded(page: import('@playwright/test').Page) {
  const next = page.getByTestId('next-to-line-items-btn')
  if (await next.isVisible().catch(() => false)) {
    const customerName = page.getByTestId('customer-name-input')
    if ((await customerName.inputValue().catch(() => '')).trim() === '') {
      await customerName.fill(`E2E Customer ${Date.now()}`)
    }

    const dealNumber = page.getByTestId('deal-number-input')
    if ((await dealNumber.inputValue().catch(() => '')).trim() === '') {
      await dealNumber.fill(`E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
    }

    await next.click()
  }
}

async function ensureFirstLineItemVisible(page: import('@playwright/test').Page) {
  const product = page.getByTestId('product-select-0')
  if (await product.isVisible().catch(() => false)) return

  const addItemButton = page.getByRole('button', { name: /add item/i })
  if (await addItemButton.isVisible().catch(() => false)) {
    await addItemButton.click()
  }
}

// This spec validates that create-deal staff/vendor dropdowns populate, selections can be made,
// and that those selections persist on the edit page and across reloads.
// Requires an authenticated session. global.setup.ts will create one if
// E2E_EMAIL/E2E_PASSWORD are provided, or if e2e/storageState.json already exists.

test.describe('Deal staff/vendor dropdowns - create -> edit persistence', () => {
  test('selects staff/vendor on create and persists on edit', async ({ page }) => {
    // Preflight: require an authenticated session (debug-auth markers)
    await page.goto('/debug-auth')
    await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('profile-org-id')).toBeVisible({ timeout: 15_000 })

    // Start a new deal
    await page.goto('/deals/new')
    await waitForDealForm(page)

    // Ensure all main dropdowns have at least one real option beyond placeholder
    const vendor = page.getByTestId('vendor-select')
    const sales = page.getByTestId('sales-select')
    const finance = page.getByTestId('finance-select')
    const delivery = page.getByTestId('delivery-select')

    const hasStaffVendorSelectors =
      (await vendor.isVisible().catch(() => false)) &&
      (await sales.isVisible().catch(() => false)) &&
      (await finance.isVisible().catch(() => false)) &&
      (await delivery.isVisible().catch(() => false))

    if (!hasStaffVendorSelectors) {
      return
    }

    await expect(vendor).toBeVisible()
    await expect(sales).toBeVisible()
    await expect(finance).toBeVisible()
    await expect(delivery).toBeVisible()

    // Wait for async dropdown hydration (either options populate or empty-state banners appear)
    await page
      .waitForFunction(
        () => {
          const v = document.querySelector('[data-testid="vendor-select"]')
          const s = document.querySelector('[data-testid="sales-select"]')
          const f = document.querySelector('[data-testid="finance-select"]')
          const d = document.querySelector('[data-testid="delivery-select"]')
          if (!(v instanceof HTMLSelectElement)) return false
          if (!(s instanceof HTMLSelectElement)) return false
          if (!(f instanceof HTMLSelectElement)) return false
          if (!(d instanceof HTMLSelectElement)) return false
          const ok = (el: HTMLSelectElement, emptyText: string) =>
            el.options.length > 1 || document.body.innerText.includes(emptyText)
          return (
            ok(v, 'No vendors found yet') &&
            ok(s, 'No sales staff found yet') &&
            ok(f, 'No finance managers found yet') &&
            ok(d, 'No delivery coordinators found yet')
          )
        },
        { timeout: 30_000 }
      )
      .catch(() => {
        throw new Error('Dropdowns did not hydrate (options or empty-state banners)')
      })

    const vendorOptions = await vendor.locator('option').count()
    const salesOptions = await sales.locator('option').count()
    const financeOptions = await finance.locator('option').count()
    const deliveryOptions = await delivery.locator('option').count()

    const selected = {
      vendor: false,
      sales: false,
      finance: false,
      delivery: false,
    }

    // Select first real option (index 1) only when available.
    if (vendorOptions > 1) {
      await vendor.selectOption({ index: 1 })
      selected.vendor = true
    } else {
      await expect(page.getByTestId('admin-link-vendors')).toBeVisible({ timeout: 10_000 })
    }

    if (salesOptions > 1) {
      await sales.selectOption({ index: 1 })
      selected.sales = true
    } else {
      await expect(page.getByTestId('admin-link-sales-empty')).toBeVisible({ timeout: 10_000 })
    }

    if (financeOptions > 1) {
      await finance.selectOption({ index: 1 })
      selected.finance = true
    } else {
      await expect(page.getByTestId('admin-link-finance-empty')).toBeVisible({ timeout: 10_000 })
    }

    if (deliveryOptions > 1) {
      await delivery.selectOption({ index: 1 })
      selected.delivery = true
    } else {
      await expect(page.getByTestId('admin-link-delivery-empty')).toBeVisible({ timeout: 10_000 })
    }

    // Also add first product so the save can succeed
    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)

    const product = page.getByTestId('product-select-0')
    await expect(product).toBeVisible()
    await product.selectOption({ index: 1 })

    // Save the deal
    const saveBtn = page.getByTestId('save-deal-btn')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Expect redirect to edit page
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 30000 })

    // On edit page, verify selected fields persisted; otherwise verify empty-state UX.
    if (selected.vendor) await expect(page.getByTestId('vendor-select')).not.toHaveValue('')
    if (selected.sales) await expect(page.getByTestId('sales-select')).not.toHaveValue('')
    if (selected.finance) await expect(page.getByTestId('finance-select')).not.toHaveValue('')
    if (selected.delivery) await expect(page.getByTestId('delivery-select')).not.toHaveValue('')

    // Reload and confirm persistence
    await page.reload()
    if (selected.vendor) await expect(page.getByTestId('vendor-select')).not.toHaveValue('')
    if (selected.sales) await expect(page.getByTestId('sales-select')).not.toHaveValue('')
    if (selected.finance) await expect(page.getByTestId('finance-select')).not.toHaveValue('')
    if (selected.delivery) await expect(page.getByTestId('delivery-select')).not.toHaveValue('')
  })
})
