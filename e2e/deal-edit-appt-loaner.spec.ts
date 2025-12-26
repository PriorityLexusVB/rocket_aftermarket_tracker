import { test, expect } from '@playwright/test'

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

test.describe('Deal edit: appointment window & loaner return date', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('editing deal preserves appointment window and loaner return date', async ({ page }) => {
    // Preflight: ensure we have an authenticated session
    await page.goto('/debug-auth')
    const hasSession = await page
      .getByTestId('session-user-id')
      .isVisible()
      .catch(() => false)
    const hasOrg = await page
      .getByTestId('profile-org-id')
      .isVisible()
      .catch(() => false)
    test.skip(!(hasSession && hasOrg), 'No authenticated session')

    // Create a new deal with appointment window and loaner
    await page.goto('/deals/new')
    await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 10_000 })

    // Appointment window (date + start/end time) is only available in Deal Form V2.
    // Deal Form V1 does not expose these inputs and cannot satisfy vendor scheduling validation.
    const hasV2SchedulingFields = await page
      .getByTestId('date-scheduled-0')
      .isVisible()
      .catch(() => false)
    test.skip(!hasV2SchedulingFields, 'Deal Form V2 scheduling fields not enabled')

    // Fill in basic deal info
    const description = page.getByTestId('description-input')
    await description.fill(`E2E Appt+Loaner Test ${Date.now()}`)

    // Select vendor (required)
    const vendor = page.getByTestId('vendor-select')
    await vendor.selectOption({ index: 1 })

    // Select product for line item
    const product = page.getByTestId('product-select-0')
    await product.selectOption({ index: 1 })

    // Enable scheduling for line item 0
    const requiresScheduling = page.getByTestId('requires-scheduling-0')
    if (!(await requiresScheduling.isChecked())) {
      await page.locator('label[for="requiresScheduling-0"]').click()
    }

    // Set appointment date and time for line item
    const schedDate = page.getByTestId('date-scheduled-0')
    await schedDate.fill('2025-12-12')

    const schedStart = page.getByTestId('start-time-0')
    await schedStart.fill('13:30')

    const schedEnd = page.getByTestId('end-time-0')
    await schedEnd.fill('15:00')

    // Enable loaner
    const loanerCheckbox = page.getByTestId('loaner-checkbox')
    if (!(await loanerCheckbox.isChecked())) {
      await loanerCheckbox.check()
    }

    // Fill loaner details
    const loanerNumber = page.getByTestId('loaner-number-input')
    await loanerNumber.fill('LOANER-E2E-123')

    const loanerReturnDate = page.getByTestId('loaner-return-date-input')
    await loanerReturnDate.fill('2025-12-18')

    // Save the deal
    const saveBtn = page.getByTestId('save-deal-btn')
    await saveBtn.click()

    // Wait for redirect to edit page
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, {
      timeout: 30_000,
      waitUntil: 'networkidle',
    })

    // Verify appointment window time fields are populated in edit form
    const schedDateAfter = page.getByTestId('date-scheduled-0')
    await expect(schedDateAfter).toHaveValue('2025-12-12')

    const schedStartAfter = page.getByTestId('start-time-0')
    await expect(schedStartAfter).toHaveValue('13:30')

    const schedEndAfter = page.getByTestId('end-time-0')
    await expect(schedEndAfter).toHaveValue('15:00')

    // Verify loaner checkbox is checked
    const loanerCheckboxAfter = page.getByTestId('loaner-checkbox')
    await expect(loanerCheckboxAfter).toBeChecked()

    // Verify loaner number is populated
    const loanerNumberAfter = page.getByTestId('loaner-number-input')
    await expect(loanerNumberAfter).toHaveValue('LOANER-E2E-123')

    // Verify loaner return date is populated
    const loanerReturnDateAfter = page.getByTestId('loaner-return-date-input')
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
    await expect(page.getByTestId('date-scheduled-0')).toHaveValue('2025-12-12')
    await expect(page.getByTestId('start-time-0')).toHaveValue('13:30')
    await expect(page.getByTestId('end-time-0')).toHaveValue('15:00')
    await expect(page.getByTestId('loaner-checkbox')).toBeChecked()
    await expect(page.getByTestId('loaner-number-input')).toHaveValue('LOANER-E2E-123')
    await expect(page.getByTestId('loaner-return-date-input')).toHaveValue('2025-12-18')

    // Navigate back to deals list to verify display
    await page.goto('/deals')
    await page.waitForLoadState('networkidle')

    // Find the deal in the list and verify appointment window and loaner display correctly
    // The deal should show up with the appointment window and loaner badge
    const dealRow = page.locator(`text=/E2E Appt\\+Loaner Test/`).first()
    await expect(dealRow).toBeVisible({ timeout: 10_000 })

    // Check that appointment window is rendered (ScheduleChip should show date/time)
    // Look for a schedule chip with the date we set
    const scheduleChip = page.locator('text=/Dec 12/')
    await expect(scheduleChip).toBeVisible({ timeout: 5_000 })

    // Check that loaner badge is rendered
    const loanerBadge = page.locator('text=/LOANER-E2E-123/')
    await expect(loanerBadge).toBeVisible({ timeout: 5_000 })
  })
})
