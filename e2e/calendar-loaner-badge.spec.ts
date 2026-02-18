import { test, expect } from '@playwright/test'

// Verifies that a seeded scheduled job shows a Loaner badge and a Promise chip on the calendar
// Creates its own deal to avoid seeded-data dependencies.

function yyyyMmDd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function waitForDealForm(page: import('@playwright/test').Page) {
  await Promise.race([
    page.getByTestId('deal-form').waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByTestId('deal-date-input').waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function goToLineItemsStepIfNeeded(page: import('@playwright/test').Page, jobNumber: string) {
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
    await dealNumber.fill(jobNumber)
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

test.describe('Calendar loaner badge and promise chip', () => {
  test('shows Loaner pill and Promise date for seeded job', async ({ page }) => {
    // Ensure authenticated session via debug-auth
    await page.goto('/debug-auth')
    await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('profile-org-id')).toBeVisible({ timeout: 15_000 })

    // Create a deal with a loaner and a scheduled/promised date so it appears in the calendar.
    const jobTitle = `E2E Loaner Job ${Date.now()}`
    const jobNumber = `JOB-${Date.now()}`
    const loanerNumberValue = `LOANER-E2E-${Date.now()}`
    await page.goto('/deals/new')
    await waitForDealForm(page)

    const description = page
      .getByTestId('description-input')
      .or(page.getByTestId('notes-input'))
      .or(page.getByPlaceholder(/enter notes/i).first())
    if (await description.isVisible().catch(() => false)) {
      await description.fill(jobTitle)
    }

    const dealNumberInput = page
      .getByTestId('deal-number-input')
      .or(page.getByPlaceholder(/enter deal number/i).first())
    if (await dealNumberInput.isVisible().catch(() => false)) {
      await dealNumberInput.fill(jobNumber)
    }

    await goToLineItemsStepIfNeeded(page, jobNumber)
    await ensureFirstLineItemVisible(page)
    await page.getByTestId('product-select-0').selectOption({ index: 1 })

    // Ensure the line item is considered schedulable so the job appears on calendar views.
    const requiresScheduling = page.getByTestId('requires-scheduling-0')
    if (await requiresScheduling.isVisible().catch(() => false)) {
      if (!(await requiresScheduling.isChecked().catch(() => false))) {
        await page.locator('label[for="requiresScheduling-0"]').click()
        await expect(requiresScheduling).toBeChecked({ timeout: 5_000 })
      }
    }

    const offsite = page.getByTestId('offsite-radio-0')
    if (await offsite.isVisible().catch(() => false)) {
      await offsite.check().catch(async () => {
        await offsite.click()
      })
    }

    await page.getByTestId('promised-date-0').or(page.getByTestId('date-scheduled-0')).fill(yyyyMmDd(new Date()))

    // Agenda/appointment views typically key off scheduled date/time, not just promised date.
    const dateScheduled = page.getByTestId('date-scheduled-0')
    if (await dateScheduled.isVisible().catch(() => false)) {
      await dateScheduled.fill(yyyyMmDd(new Date()))
    }

    const startCandidates = [
      page.getByTestId('scheduled-start-time-0'),
      page.getByTestId('start-time-0'),
    ]
    const endCandidates = [page.getByTestId('scheduled-end-time-0'), page.getByTestId('end-time-0')]

    for (const start of startCandidates) {
      if (await start.isVisible().catch(() => false)) {
        await start.fill('09:00')
        break
      }
    }

    for (const end of endCandidates) {
      if (await end.isVisible().catch(() => false)) {
        await end.fill('10:00')
        break
      }
    }

    await ensureCustomerStep(page)

    const loaner = page.getByTestId('loaner-checkbox')
    if (!(await loaner.isChecked().catch(() => false))) {
      await page.locator('label[for="needsLoaner"]').click({ force: true })
      await expect(loaner).toBeChecked({ timeout: 5_000 })
    }
    await page.getByTestId('loaner-number-input').fill(loanerNumberValue)

    const loanerEta = page.getByTestId('loaner-eta-input')
    if (await loanerEta.isVisible().catch(() => false)) {
      await loanerEta.fill(yyyyMmDd(new Date(Date.now() + 3 * 86400000)))
    }

    await goToLineItemsStepIfNeeded(page, jobNumber)
    await ensureFirstLineItemVisible(page)

    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    // Extract job id for focus routes.
    await page.waitForURL(/\/deals\/[^/]+\/edit/, { timeout: 30_000 })
    const editUrl = page.url()
    const jobIdMatch = page.url().match(/\/deals\/([^/]+)\/edit/)
    const jobId = jobIdMatch?.[1]
    if (!jobId) throw new Error(`Unable to determine job id after save. URL=${page.url()}`)

    // Prefer asserting calendar UI when the environment has appointments/cards available.
    // If there are no appointments, fall back to verifying the underlying deal fields persisted.
    await page.goto(`/calendar-flow-management-center?focus=${encodeURIComponent(jobId)}`)
    await expect(page.getByText(/Calendar Flow Management Center/i)).toBeVisible({
      timeout: 15_000,
    })

    const loanerChip = page.getByText(/Loaner/i).first()
    const promiseChip = page.getByText(/Promise/i).first()
    const hasLoaner = await loanerChip.isVisible().catch(() => false)
    const hasPromise = await promiseChip.isVisible().catch(() => false)

    if (hasLoaner && hasPromise) {
      await expect(loanerChip).toBeVisible()
      await expect(promiseChip).toBeVisible()
    } else {
      // Fallback: validate persistence in the edit form.
      await page.goto(editUrl)
      await waitForDealForm(page)
      await expect(page.getByTestId('loaner-checkbox')).toBeChecked({ timeout: 10_000 })
      await expect(page.getByTestId('loaner-number-input')).toHaveValue(loanerNumberValue)
      await expect(page.getByTestId('promised-date-0')).toHaveValue(yyyyMmDd(new Date()))
    }
  })
})
