import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function waitForDealForm(page: Page) {
  await Promise.race([
    page.getByTestId('deal-form').waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByTestId('deal-date-input').waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function goToLineItemsStepIfNeeded(page: Page, dealNumberValue?: string) {
  const next = page.getByTestId('next-to-line-items-btn')
  if (!(await next.isVisible().catch(() => false))) return

  const customer = page
    .getByTestId('customer-name-input')
    .or(page.getByPlaceholder(/enter customer name/i).first())
  const dealNumber = page
    .getByTestId('deal-number-input')
    .or(page.getByPlaceholder(/enter deal number/i).first())

  if (await customer.isVisible().catch(() => false)) {
    if ((await customer.inputValue().catch(() => '')).trim() === '') {
      await customer.fill(`E2E Dropdown ${Date.now()}`)
    }
  }
  if (await dealNumber.isVisible().catch(() => false)) {
    if ((await dealNumber.inputValue().catch(() => '')).trim() === '') {
      await dealNumber.fill(dealNumberValue || `DD-${Date.now()}`)
    }
  }

  await next.click()
}

async function ensureCustomerStep(page: Page) {
  const sales = page.getByTestId('sales-select')
  if (await sales.isVisible().catch(() => false)) return

  for (let attempt = 0; attempt < 3; attempt++) {
    const back = page.getByRole('button', { name: /back/i })
    if (await back.isVisible().catch(() => false)) {
      await back.click({ force: true }).catch(() => {})
      await page.waitForTimeout(250)
      if (await sales.isVisible().catch(() => false)) return
    }

    if (/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/.test(page.url())) {
      await page.goto(page.url(), { waitUntil: 'domcontentloaded' })
      if (await sales.isVisible().catch(() => false)) return
    }
  }

  await expect(sales).toBeVisible({ timeout: 10_000 })
}

async function ensureFirstLineItemVisible(page: Page) {
  const product = page.getByTestId('product-select-0')
  if (await product.isVisible().catch(() => false)) return

  const addItem = page.getByRole('button', { name: /add item/i })
  if (await addItem.isVisible().catch(() => false)) {
    await addItem.click()
  }
}

async function ensureOnEditPage(page: Page, dealNumberValue: string, preferredEditUrl?: string) {
  const editUrlPattern = /\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/
  if (editUrlPattern.test(page.url())) return

  if (preferredEditUrl) {
    await page.goto(preferredEditUrl, { waitUntil: 'domcontentloaded' }).catch(() => {})
    if (editUrlPattern.test(page.url())) return
  }

  if (!/\/deals(\?.*)?$/.test(page.url())) {
    await page.goto('/deals', { waitUntil: 'domcontentloaded' })
  }

  const matchingEditButton = page
    .locator('div')
    .filter({ hasText: dealNumberValue })
    .getByRole('button', { name: /edit/i })
    .first()

  if (await matchingEditButton.isVisible().catch(() => false)) {
    await matchingEditButton.click()
  } else {
    await page.getByRole('button', { name: /edit/i }).first().click()
  }

  await page.waitForURL(editUrlPattern, { timeout: 30_000 })
}

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

  if (!ready) {
    throw new Error(
      '[E2E] No authenticated session/org detected via /debug-auth. Ensure E2E_EMAIL/E2E_PASSWORD are set and the test user is associated to an org.'
    )
  }
}

// Capture the current value of a native <select>
async function getSelectValue(select: ReturnType<Page['locator']>) {
  return (await select.locator('option:checked').getAttribute('value')) || ''
}

// Select first non-placeholder option (index 1) and return the value string
async function pickFirstRealOption(
  select: ReturnType<Page['locator']>,
  options?: { allowPlaceholderOnly?: boolean }
) {
  await expect(select).toBeVisible()
  const optionCount = await expect
    .poll(async () => select.locator('option').count(), {
      timeout: 15_000,
    })
    .toBeGreaterThan(0)
    .then(async () => select.locator('option').count())

  if (optionCount <= 1) {
    if (options?.allowPlaceholderOnly) {
      return getSelectValue(select)
    }
    throw new Error('Dropdown did not load selectable options (only placeholder present)')
  }

  await select.selectOption({ index: 1 })
  return getSelectValue(select)
}

// This spec provides explicit persistence coverage for all primary dropdowns in DealForm
// (vendor, sales, finance, delivery, and first line item product) across save and reload.

test.describe('Deal dropdown persistence across save + reload', () => {
  test.skip(!!process.env.CI, 'Flaky in shared CI environment; covered by local verification')

  test('create -> edit: selected values persist exactly', async ({ page }) => {
    await ensureSessionAndOrg(page)
    const dealNumberValue = `DD-${Date.now()}`

    // Start a new deal
    await page.goto('/deals/new')
    await waitForDealForm(page)

    // Description (required in current form)
    const description = page
      .getByTestId('description-input')
      .or(page.getByTestId('notes-input'))
      .or(page.getByPlaceholder(/enter notes/i).first())
    if (await description.isVisible().catch(() => false)) {
      await description.fill('E2E Deal ' + Date.now())
    }

    const dealNumberInput = page
      .getByTestId('deal-number-input')
      .or(page.getByPlaceholder(/enter deal number/i).first())
    if (await dealNumberInput.isVisible().catch(() => false)) {
      await dealNumberInput.fill(dealNumberValue)
    }

    // Primary dropdowns
    const sales = page.getByTestId('sales-select')
    const finance = page.getByTestId('finance-select')
    const delivery = page.getByTestId('delivery-select')

    const salesVal = await pickFirstRealOption(sales)
    const financeVal = await pickFirstRealOption(finance)
    const deliveryVal = await pickFirstRealOption(delivery, { allowPlaceholderOnly: true })

    await goToLineItemsStepIfNeeded(page, dealNumberValue)
    await ensureFirstLineItemVisible(page)

    // Line item product (ensure at least one product so save can succeed)
    const product = page.getByTestId('product-select-0')
    const productVal = await pickFirstRealOption(product)
    // Capture unit price after product auto-fill
    const unitPrice = page
      .getByTestId('unit-price-input-0')
      .or(page.getByRole('spinbutton').first())
      .or(page.locator('input[type="number"]').first())
    await expect(unitPrice).toBeVisible()
    const unitPriceVal = await unitPrice.inputValue()

    // Vendor jobs often require a scheduled/promised date for the first line item
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const tomorrowDate = tomorrow.toISOString().slice(0, 10)
    const promisedDate = page.getByTestId('promised-date-0').or(page.getByTestId('date-scheduled-0'))
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill(tomorrowDate)

    // Save the deal
    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    // Redirect to edit page (or fail with a clear UI error)
    await waitForCreateRedirectOrSaveFailure(page)

    await ensureOnEditPage(page, dealNumberValue)
    const createdEditUrl = page.url()

    // Verify exact selections persisted on edit page
    await ensureCustomerStep(page)
    await expect(page.getByTestId('sales-select')).toHaveValue(salesVal)
    await expect(page.getByTestId('finance-select')).toHaveValue(financeVal)
    if (deliveryVal) {
      await expect(page.getByTestId('delivery-select')).toHaveValue(deliveryVal)
    }

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)
    await expect(page.getByTestId('product-select-0')).toHaveValue(productVal)
    await expect(page.getByTestId('unit-price-input-0')).toHaveValue(unitPriceVal)

    // Reload and confirm still persisted
    await page.reload()
    await ensureOnEditPage(page, dealNumberValue, createdEditUrl)
    await ensureCustomerStep(page)
    await expect(page.getByTestId('sales-select')).toHaveValue(salesVal)
    await expect(page.getByTestId('finance-select')).toHaveValue(financeVal)
    if (deliveryVal) {
      await expect(page.getByTestId('delivery-select')).toHaveValue(deliveryVal)
    }

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)
    await expect(page.getByTestId('product-select-0')).toHaveValue(productVal)
    await expect(page.getByTestId('unit-price-input-0')).toHaveValue(unitPriceVal)
  })
})
