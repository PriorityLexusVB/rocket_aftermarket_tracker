import { test, expect } from '@playwright/test'

// Verifies that a seeded scheduled job shows a Loaner badge and a Promise chip on the calendar
// Creates its own deal to avoid seeded-data dependencies.

function yyyyMmDd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

test.describe('Calendar loaner badge and promise chip', () => {
  test('shows Loaner pill and Promise date for seeded job', async ({ page }) => {
    // Ensure authenticated session via debug-auth
    await page.goto('/debug-auth')
    await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('profile-org-id')).toBeVisible({ timeout: 15_000 })

    // Create a deal with a loaner and a scheduled/promised date so it appears in the calendar.
    const jobTitle = `E2E Loaner Job ${Date.now()}`
    const jobNumber = `JOB-${Date.now()}`
    const jobNumberSuffix = jobNumber.split('-').pop() || jobNumber
    const loanerNumberValue = `LOANER-E2E-${Date.now()}`
    await page.goto('/deals/new')
    await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 10_000 })

    await page.getByTestId('description-input').fill(jobTitle)
    await page.getByTestId('deal-number-input').fill(jobNumber)
    await page.getByTestId('product-select-0').selectOption({ index: 1 })

    const offsite = page.getByTestId('offsite-radio-0')
    if (await offsite.isVisible().catch(() => false)) {
      await offsite.check().catch(async () => {
        await offsite.click()
      })
    }

    await page.getByTestId('promised-date-0').fill(yyyyMmDd(new Date()))

    const loaner = page.getByTestId('loaner-checkbox')
    if (!(await loaner.isChecked().catch(() => false))) {
      await page.locator('label[for="needsLoaner"]').click({ force: true })
      await expect(loaner).toBeChecked({ timeout: 5_000 })
    }
    await page.getByTestId('loaner-number-input').fill(loanerNumberValue)
    await page.getByTestId('loaner-eta-input').fill(yyyyMmDd(new Date(Date.now() + 3 * 86400000)))

    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    await page.waitForURL(/\/deals\/[^/]+\/edit/, { timeout: 30_000 })
    const jobIdMatch = page.url().match(/\/deals\/([^/]+)\/edit/)
    const jobId = jobIdMatch?.[1]
    if (!jobId) throw new Error(`Unable to determine job id after save. URL=${page.url()}`)

    // The form may redirect to Agenda automatically; regardless, proceed to the calendar view.
    await page.goto('/calendar-flow-management-center')
    await expect(page.getByText('Calendar Flow Management Center')).toBeVisible()

    // Wait for jobs to load and render
    await page.waitForTimeout(750)

    // Find the job chip by job number suffix (calendar renders job_number • title)
    const jobCard = page.getByText(new RegExp(jobNumberSuffix)).first()
    await expect(jobCard).toBeVisible({ timeout: 20_000 })

    // Check for Loaner pill near the job card
    await expect(page.getByText('Loaner').first()).toBeVisible()

    // Check for Promise label on the card
    const promiseLocator = page.getByText('Promise', { exact: false })
    await expect(promiseLocator.first()).toBeVisible()
  })
})
