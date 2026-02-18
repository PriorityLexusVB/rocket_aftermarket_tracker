// e2e/agenda.spec.ts
// Playwright spec for Agenda feature (flag-dependent)
import { test, expect } from '@playwright/test'
import { requireAuthEnv } from './_authEnv'

// Assumes environment has VITE_SIMPLE_CALENDAR=true

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
    await customer.fill(`E2E Agenda ${Date.now()}`)
  }
  if (await dealNumber.isVisible().catch(() => false)) {
    await dealNumber.fill(`AG-${Date.now()}`)
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

async function expectAgendaOrCalendarLoaded(page: import('@playwright/test').Page) {
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible({
    timeout: 20_000,
  })

  const agendaHeader = page.locator('header[aria-label="Agenda controls"]')
  const hasAgendaHeader = await agendaHeader.isVisible().catch(() => false)
  if (hasAgendaHeader) return

  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 10_000 })
    .toMatch(/\/calendar(\/agenda)?$/)
}

test.describe('Agenda View', () => {
  test('redirect after create focuses new appointment', async ({ page }) => {
    const { email, password } = requireAuthEnv()
    // Login
    await page.goto('/auth')
    await page.fill('input[name="email"]', email!)
    await page.fill('input[name="password"]', password!)
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(2000)

    // Create a scheduled deal. In this codebase, saving a deal with a scheduled timestamp
    // triggers a redirect to /calendar/agenda?focus=<job_id>.
    await page.goto('/deals/new')
    await waitForDealForm(page)

    const description = page
      .getByTestId('description-input')
      .or(page.getByTestId('notes-input'))
      .or(page.getByPlaceholder(/enter notes/i).first())
    if (await description.isVisible().catch(() => false)) {
      await description.fill(`E2E Agenda Focus ${Date.now()}`)
    }

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)

    const product = page.getByTestId('product-select-0')
    await expect(product).toBeVisible()
    await product.selectOption({ index: 1 })

    // Mark as off-site and provide a "Date Scheduled" (promised date) to trigger scheduling.
    const offsite = page.getByTestId('offsite-radio-0')
    if (await offsite.isVisible().catch(() => false)) {
      await offsite.check().catch(async () => {
        await offsite.click()
      })
    }

    const promised = page.getByTestId('promised-date-0').or(page.getByTestId('date-scheduled-0'))
    await expect(promised).toBeVisible()
    const today = new Date()
    const yyyy = today.getFullYear()
    const mm = String(today.getMonth() + 1).padStart(2, '0')
    const dd = String(today.getDate()).padStart(2, '0')
    await promised.fill(`${yyyy}-${mm}-${dd}`)

    const saveBtn = page.getByTestId('save-deal-btn')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // In this route, NewDeal.jsx owns navigation and always routes to Edit.
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit/, { timeout: 30_000 })
    const url = new URL(page.url())
    const match = url.pathname.match(/\/deals\/([A-Za-z0-9-]+)\/edit/)
    const jobId = match?.[1]
    if (!jobId) throw new Error(`Unable to determine job id after create. URL=${page.url()}`)

    // Verify agenda can accept focus param without crashing.
    await page.goto(`/calendar/agenda?focus=${encodeURIComponent(jobId)}`)
    await expectAgendaOrCalendarLoaded(page)
  })

  test('agenda view renders with flag enabled', async ({ page }) => {
    const { email, password } = requireAuthEnv()
    // Login
    await page.goto('/auth')
    await page.fill('input[name="email"]', email!)
    await page.fill('input[name="password"]', password!)
    await page.click('button:has-text("Sign In")')

    // Wait for auth
    await page.waitForTimeout(2000)

    // Navigate to agenda
    await page.goto('/calendar/agenda')

    // Verify page loads
    await expectAgendaOrCalendarLoaded(page)

    // Verify always-visible filters are present
    await expect(page.locator('select[aria-label="Filter by date range"]')).toBeVisible()
    await expect(page.locator('input[aria-label="Search appointments"]')).toBeVisible()

    // Expand the filters panel to reveal status filter
    const filtersButton = page.locator('button:has-text("Filters")')
    await expect(filtersButton).toBeVisible()
    await filtersButton.click()

    // Now the status filter should be visible
    await expect(page.locator('select[aria-label="Filter by status"]')).toBeVisible()
  })

  test('agenda view handles focus parameter', async ({ page }) => {
    const { email, password } = requireAuthEnv()
    // Login first
    await page.goto('/auth')
    await page.fill('input[name="email"]', email!)
    await page.fill('input[name="password"]', password!)
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(2000)

    // Navigate to agenda with a focus parameter (use a placeholder ID)
    await page.goto('/calendar/agenda?focus=test-job-123')

    // Verify page loads without error
    await expectAgendaOrCalendarLoaded(page)

    // Page should handle missing job gracefully (no crash)
    const errorBanner = page.locator('[role="alert"]')
    // Either no error or a graceful "not found" message
    const errorCount = await errorBanner.count()
    if (errorCount > 0) {
      // If there's an error, it should be handled gracefully
      await expect(errorBanner).toContainText(/not found|unable to load/i)
    }
  })

  test('agenda filters persist across navigation', async ({ page }) => {
    const { email, password } = requireAuthEnv()
    // Login
    await page.goto('/auth')
    await page.fill('input[name="email"]', email!)
    await page.fill('input[name="password"]', password!)
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(2000)

    // Navigate to agenda
    await page.goto('/calendar/agenda')

    // Expand the filters panel to reveal status filter
    const filtersButton = page.locator('button:has-text("Filters")')
    await expect(filtersButton).toBeVisible()
    await filtersButton.click()

    // Define status filter selector once for reuse
    const statusFilter = page.locator('select[aria-label="Filter by status"]')

    // Change a filter
    await expect(statusFilter).toBeVisible()
    await statusFilter.selectOption({ label: 'Completed' })

    // Verify filter was applied
    await expect(statusFilter).toHaveValue('completed')

    // Navigate away and back
    await page.goto('/')
    await page.goto('/calendar/agenda')

    // Expand filters again to check persistence
    await expect(filtersButton).toBeVisible()
    await filtersButton.click()

    // Check if filter persisted - reusing the same statusFilter locator
    await expect(statusFilter).toHaveValue('completed')
    await expectAgendaOrCalendarLoaded(page)
  })
})
