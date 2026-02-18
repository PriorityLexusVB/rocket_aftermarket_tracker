import { test, expect } from '@playwright/test'

import { requireAuthEnv } from './_authEnv'

async function waitForDealForm(page: import('@playwright/test').Page) {
  await Promise.race([
    page.getByTestId('deal-form').waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByTestId('deal-date-input').waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function isDealFormV2(page: import('@playwright/test').Page) {
  return page
    .getByTestId('deal-date-input')
    .isVisible()
    .catch(() => false)
}

async function getVisibleDescriptionField(page: import('@playwright/test').Page) {
  const v1 = page.getByTestId('description-input')
  if (await v1.isVisible().catch(() => false)) return v1
  return page.getByTestId('notes-input')
}

async function getVisiblePromisedDateField(page: import('@playwright/test').Page) {
  const v1 = page.getByTestId('promised-date-0')
  if (await v1.isVisible().catch(() => false)) return v1
  return page.getByTestId('date-scheduled-0')
}

async function goToLineItemsStepIfNeeded(page: import('@playwright/test').Page) {
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

async function ensureFirstLineItemVisible(page: import('@playwright/test').Page) {
  const product = page.getByTestId('product-select-0')
  if (await product.isVisible().catch(() => false)) return

  const addItemButton = page.getByRole('button', { name: /add item/i })
  if (await addItemButton.isVisible().catch(() => false)) {
    await addItemButton.click()
  }
}

test.describe('Deal create redirect', () => {
  test('saving a new deal redirects to /deals/:id/edit', async ({ page }) => {
    requireAuthEnv()
    await page.goto('/deals/new')
    await waitForDealForm(page)

    // Description (required in current form)
    const description = await getVisibleDescriptionField(page)
    await expect(description).toBeVisible()
    await description.fill('E2E Deal ' + Date.now())

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)

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
    const promisedDate = await getVisiblePromisedDateField(page)
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill(tomorrowDate)

    // Save
    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    // Wait for navigation to edit (numeric or UUID IDs) with a slightly longer timeout
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 30_000 })
    await expect(page.getByTestId('save-deal-btn')).toBeVisible({ timeout: 10_000 })
  })
})
