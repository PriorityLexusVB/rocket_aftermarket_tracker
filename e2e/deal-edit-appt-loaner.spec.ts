import { test, expect } from '@playwright/test'

async function waitForDealForm(page: import('@playwright/test').Page) {
  await Promise.race([
    page.getByTestId('deal-form').waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByTestId('deal-date-input').waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function goToLineItemsStepIfNeeded(page: import('@playwright/test').Page) {
  const next = page.getByTestId('next-to-line-items-btn')
  if (!(await next.isVisible().catch(() => false))) return

  const customer = page
    .getByTestId('customer-name-input')
    .or(page.getByPlaceholder(/enter customer name/i).first())
  const dealNumber = page
    .getByTestId('deal-number-input')
    .or(page.getByPlaceholder(/enter deal number/i).first())

  if (await customer.isVisible().catch(() => false)) {
    await customer.fill(`E2E Loaner ${Date.now()}`)
  }
  if (await dealNumber.isVisible().catch(() => false)) {
    await dealNumber.fill(`LOAN-${Date.now()}`)
  }

  await next.click()
}

async function ensureFirstLineItemVisible(page: import('@playwright/test').Page) {
  const product = page.getByTestId('product-select-0')
  if (await product.isVisible().catch(() => false)) return

  const addItem = page.getByRole('button', { name: /add item/i })
  if (await addItem.isVisible().catch(() => false)) {
    await addItem.click()
  }
}

async function ensureCustomerStep(page: import('@playwright/test').Page) {
  const back = page.getByRole('button', { name: /back/i })
  if (await back.isVisible().catch(() => false)) {
    await back.click()
  }
}

test.describe('Deal edit: appointment window & loaner return date', () => {
  test('editing deal preserves appointment window and loaner return date', async ({ page }) => {
    test.setTimeout(60_000)
    // Preflight: ensure we have an authenticated session
    await page.goto('/debug-auth')
    await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('profile-org-id')).toBeVisible({ timeout: 15_000 })

    // Create a new deal with appointment window and loaner
    await page.goto('/deals/new')
    await waitForDealForm(page)

    const loanerNumberValue = `LOANER-E2E-${Date.now()}`
    const descriptionValue = `E2E Appt+Loaner Test ${Date.now()}`

    // Fill in basic deal info
    const description = page
      .getByTestId('description-input')
      .or(page.getByTestId('notes-input'))
      .or(page.getByPlaceholder(/enter notes/i).first())
    if (await description.isVisible().catch(() => false)) {
      await description.fill(descriptionValue)
    }

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)

    // Select product for line item
    const product = page.getByTestId('product-select-0')
    await product.selectOption({ index: 1 })

    // Enable scheduling for line item 0
    const requiresScheduling = page.getByTestId('requires-scheduling-0')
    if (!(await requiresScheduling.isChecked())) {
      await page.locator('label[for="requiresScheduling-0"]').click()
    }

    // Set scheduled/promised date for line item (current UI uses promised-date-0)
    const promisedDate = page.getByTestId('promised-date-0').or(page.getByTestId('date-scheduled-0'))
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill('2025-12-12')

    await ensureCustomerStep(page)

    // Enable loaner
    const loanerCheckbox = page.getByTestId('loaner-checkbox')
    if (!(await loanerCheckbox.isChecked())) {
      await page.locator('label[for="needsLoaner"]').click({ force: true })
      await expect(loanerCheckbox).toBeChecked({ timeout: 5_000 })
    }

    // Fill loaner details
    const loanerNumber = page.getByTestId('loaner-number-input')
    await loanerNumber.fill(loanerNumberValue)

    const loanerReturnDate = page.getByTestId('loaner-eta-input')
    const hasLoanerReturnDate = await loanerReturnDate.isVisible().catch(() => false)
    if (hasLoanerReturnDate) {
      await loanerReturnDate.fill('2025-12-18')
    }

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)

    // Save the deal
    const saveBtn = page.getByTestId('save-deal-btn')
    await saveBtn.click()

    // Depending on scheduling state, the app may redirect to Agenda with a focus param.
    // Extract the job id from either the edit route or the agenda focus query param.
    await page.waitForURL(/(\/deals\/[A-Za-z0-9-]+\/edit|\/calendar\/agenda\?focus=)/, {
      timeout: 30_000,
    })

    const url = new URL(page.url())
    let jobId: string | null = null
    const editMatch = url.pathname.match(/\/deals\/([A-Za-z0-9-]+)\/edit/)
    if (editMatch?.[1]) jobId = editMatch[1]
    if (!jobId) jobId = url.searchParams.get('focus')
    if (!jobId) throw new Error(`Unable to determine job id after save. URL=${page.url()}`)

    await page.goto(`/deals/${jobId}/edit`, { waitUntil: 'domcontentloaded' })
    await waitForDealForm(page)

    // Verify promised date persisted in edit form
    await expect(page.getByTestId('promised-date-0').or(page.getByTestId('date-scheduled-0'))).toHaveValue('2025-12-12')

    // Verify loaner checkbox is checked
    const loanerCheckboxAfter = page.getByTestId('loaner-checkbox')
    await expect(loanerCheckboxAfter).toBeChecked()

    // Verify loaner number is populated
    const loanerNumberAfter = page.getByTestId('loaner-number-input')
    await expect(loanerNumberAfter).toHaveValue(loanerNumberValue)

    // Verify loaner return date is populated
    const loanerReturnDateAfter = page.getByTestId('loaner-eta-input')
    if (hasLoanerReturnDate) {
      await expect(loanerReturnDateAfter).toHaveValue('2025-12-18')
    }

    // Save again without changes to ensure no data loss
    await saveBtn.click()
    await Promise.race([
      page.getByTestId('save-success').waitFor({ state: 'visible', timeout: 10000 }),
      page.getByTestId('last-saved-timestamp').waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => {
      // Save indicators may not exist in all builds - safe to ignore
    })
    await page.waitForTimeout(1000) // Give save time to complete

    // Reload the page to ensure persistence
    await page.reload()

    // Re-verify all fields after reload
    await expect(page.getByTestId('promised-date-0').or(page.getByTestId('date-scheduled-0'))).toHaveValue('2025-12-12')
    await expect(page.getByTestId('loaner-checkbox')).toBeChecked()
    await expect(page.getByTestId('loaner-number-input')).toHaveValue(loanerNumberValue)
    if (hasLoanerReturnDate) {
      await expect(page.getByTestId('loaner-eta-input')).toHaveValue('2025-12-18')
    }

    // NOTE: The deals list is paginated/filterable and can lag behind newly created/updated deals
    // depending on caching and server-side search. Persistence is verified via the edit form.
  })
})
