import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForCreateRedirectOrSaveFailure(page: Page) {
  const redirectRe = /\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/
  const saveError = page.getByTestId('save-error')
  const saveSuccess = page.getByTestId('save-success')

  const result = await Promise.race([
    page
      .waitForURL(redirectRe, { timeout: 30_000 })
      .then(() => ({ kind: 'redirect' as const }))
      .catch((error) => ({ kind: 'redirect-timeout' as const, error })),
    saveError
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(async () => ({
        kind: 'save-error' as const,
        text: ((await saveError.textContent()) || '').trim(),
      }))
      .catch((error) => ({ kind: 'save-error-timeout' as const, error })),
    saveSuccess
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => ({ kind: 'save-success' as const }))
      .catch((error) => ({ kind: 'save-success-timeout' as const, error })),
  ])

  if (result.kind === 'redirect') return

  if (result.kind === 'save-error') {
    throw new Error(`Deal save failed (UI error): ${result.text || '(no message)'}`)
  }

  if (result.kind === 'save-success') {
    await page.waitForURL(redirectRe, { timeout: 10_000 })
    return
  }

  throw new Error('Deal save did not redirect and no save status was observed within 30s')
}

// Helper to require an authenticated session and org before proceeding
async function ensureSessionAndOrg(page: Page) {
  await page.goto('/debug-auth')

  const sessionEl = page.getByTestId('session-user-id')
  const orgEl = page.getByTestId('profile-org-id')
  await expect(sessionEl).toBeVisible({ timeout: 15_000 })
  await expect(orgEl).toBeVisible({ timeout: 15_000 })

  let ready = true
  try {
    await expect
      .poll(
        async () => {
          const sessionText = (await sessionEl.textContent().catch(() => '')) || ''
          const orgText = (await orgEl.textContent().catch(() => '')) || ''

          const hasSession = sessionText.trim().length > 0 && !/\bnull\b/i.test(sessionText)
          const hasOrg = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(
            orgText
          )

          return hasSession && hasOrg
        },
        { timeout: 15_000 }
      )
      .toBe(true)
  } catch {
    ready = false
  }

  test.skip(!ready, 'No authenticated session/org; skipping persistence test')
}

// Capture the current value of a native <select>
async function getSelectValue(select: ReturnType<Page['locator']>) {
  return (await select.locator('option:checked').getAttribute('value')) || ''
}

// Select first non-placeholder option (index 1) and return the value string
async function pickFirstRealOption(select: ReturnType<Page['locator']>) {
  await expect(select).toBeVisible()
  await expect
    .poll(async () => select.locator('option').count(), {
      timeout: 15_000,
    })
    .toBeGreaterThan(1)
  await select.selectOption({ index: 1 })
  return getSelectValue(select)
}

// This spec provides explicit persistence coverage for all primary dropdowns in DealForm
// (vendor, sales, finance, delivery, and first line item product) across save and reload.

test.describe('Deal dropdown persistence across save + reload', () => {
  test('create -> edit: selected values persist exactly', async ({ page }) => {
    await ensureSessionAndOrg(page)

    // Start a new deal
    await page.goto('/deals/new')
    await expect(page.getByTestId('deal-form')).toBeVisible()

    // Description (required in current form)
    const description = page.getByTestId('description-input')
    await expect(description).toBeVisible()
    await description.fill('E2E Deal ' + Date.now())

    // Primary dropdowns
    const sales = page.getByTestId('sales-select')
    const finance = page.getByTestId('finance-select')
    const delivery = page.getByTestId('delivery-select')

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

    // Vendor jobs often require a scheduled/promised date for the first line item
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const tomorrowDate = tomorrow.toISOString().slice(0, 10)
    const promisedDate = page.getByTestId('promised-date-0')
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill(tomorrowDate)

    // Save the deal
    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    // Redirect to edit page (or fail with a clear UI error)
    await waitForCreateRedirectOrSaveFailure(page)

    // Verify exact selections persisted on edit page
    await expect(page.getByTestId('sales-select')).toHaveValue(salesVal)
    await expect(page.getByTestId('finance-select')).toHaveValue(financeVal)
    await expect(page.getByTestId('delivery-select')).toHaveValue(deliveryVal)
    await expect(page.getByTestId('product-select-0')).toHaveValue(productVal)
    await expect(page.getByTestId('unit-price-input-0')).toHaveValue(unitPriceVal)

    // Reload and confirm still persisted
    await page.reload()
    await expect(page.getByTestId('sales-select')).toHaveValue(salesVal)
    await expect(page.getByTestId('finance-select')).toHaveValue(financeVal)
    await expect(page.getByTestId('delivery-select')).toHaveValue(deliveryVal)
    await expect(page.getByTestId('product-select-0')).toHaveValue(productVal)
    await expect(page.getByTestId('unit-price-input-0')).toHaveValue(unitPriceVal)
  })
})
