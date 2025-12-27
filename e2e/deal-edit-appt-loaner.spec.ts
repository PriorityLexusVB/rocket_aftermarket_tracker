import { test, expect } from '@playwright/test'

import { missingAuthEnv } from './_authEnv'

test.describe('Deal edit: appointment window & loaner return date', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('editing deal preserves appointment window and loaner return date', async ({ page }) => {
    // Preflight: ensure we have an authenticated session
    await page.goto('/debug-auth')
    await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('profile-org-id')).toBeVisible({ timeout: 15_000 })

    // Create a new deal with appointment window and loaner
    await page.goto('/deals/new')
    await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 10_000 })

    const loanerNumberValue = `LOANER-E2E-${Date.now()}`

    // Fill in basic deal info
    const description = page.getByTestId('description-input')
    await description.fill(`E2E Appt+Loaner Test ${Date.now()}`)

    // Select product for line item
    const product = page.getByTestId('product-select-0')
    await product.selectOption({ index: 1 })

    // Enable scheduling for line item 0
    const requiresScheduling = page.getByTestId('requires-scheduling-0')
    if (!(await requiresScheduling.isChecked())) {
      await page.locator('label[for="requiresScheduling-0"]').click()
    }

    // Set scheduled/promised date for line item (current UI uses promised-date-0)
    const promisedDate = page.getByTestId('promised-date-0')
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill('2025-12-12')

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
    await loanerReturnDate.fill('2025-12-18')

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
    await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 15_000 })

    // Verify promised date persisted in edit form
    await expect(page.getByTestId('promised-date-0')).toHaveValue('2025-12-12')

    // Verify loaner checkbox is checked
    const loanerCheckboxAfter = page.getByTestId('loaner-checkbox')
    await expect(loanerCheckboxAfter).toBeChecked()

    // Verify loaner number is populated
    const loanerNumberAfter = page.getByTestId('loaner-number-input')
    await expect(loanerNumberAfter).toHaveValue(loanerNumberValue)

    // Verify loaner return date is populated
    const loanerReturnDateAfter = page.getByTestId('loaner-eta-input')
    await expect(loanerReturnDateAfter).toHaveValue('2025-12-18')

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
    await expect(page.getByTestId('promised-date-0')).toHaveValue('2025-12-12')
    await expect(page.getByTestId('loaner-checkbox')).toBeChecked()
    await expect(page.getByTestId('loaner-number-input')).toHaveValue(loanerNumberValue)
    await expect(page.getByTestId('loaner-eta-input')).toHaveValue('2025-12-18')

    // Navigate back to deals list to verify display
    await page.goto('/deals')
    await page.waitForLoadState('networkidle')

    // Switch to All to avoid status-filter surprises, then locate the exact row by job id
    await page.getByRole('button', { name: 'All', exact: true }).click()
    const row = page.getByTestId(`deal-row-${jobId}`)
    await expect(row).toBeVisible({ timeout: 15_000 })

    // Appointment window should be rendered once scheduled_start_time is inferred
    await expect(row.getByText(/Dec 12/i)).toBeVisible({ timeout: 10_000 })

    // Loaner badge should show the loaner number
    await expect(row.getByText(loanerNumberValue)).toBeVisible({ timeout: 10_000 })
  })
})
