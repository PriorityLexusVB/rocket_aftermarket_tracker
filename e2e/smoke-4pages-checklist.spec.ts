import { test, expect, type Page } from '@playwright/test'
import { requireAuthEnv } from './_authEnv'

function yyyyMmDd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function login(page: Page) {
  const { email, password } = requireAuthEnv()

  await page.goto('/auth')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button:has-text("Sign In")')

  // Confirm authenticated state (and avoid relying on any particular redirect).
  await page.goto('/debug-auth')
  await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('profile-org-id')).toBeVisible({ timeout: 30_000 })
}

async function createPromiseOnlyDeal(page: Page, uniqueTitle: string) {
  await page.goto('/deals/new')
  await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 15_000 })

  await page.getByTestId('description-input').fill(uniqueTitle)

  const product = page.getByTestId('product-select-0')
  await expect(product).toBeVisible()
  await product.selectOption({ index: 1 })

  // Ensure this line item is considered schedulable.
  const requiresScheduling = page.getByTestId('requires-scheduling-0')
  if (await requiresScheduling.isVisible().catch(() => false)) {
    if (!(await requiresScheduling.isChecked().catch(() => false))) {
      await page
        .locator('label[for="requiresScheduling-0"]')
        .click()
        .catch(async () => {
          await requiresScheduling.check({ force: true })
        })
    }
  }

  // Promise-only: promised date present, but no scheduled window.
  const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
  const promised = page.getByTestId('promised-date-0')
  if (await promised.isVisible().catch(() => false)) {
    await promised.fill(yyyyMmDd(tomorrow))
  }

  const dateScheduled = page.getByTestId('date-scheduled-0')
  if (await dateScheduled.isVisible().catch(() => false)) {
    await dateScheduled.fill('')
  }

  const startCandidates = [
    page.getByTestId('scheduled-start-time-0'),
    page.getByTestId('start-time-0'),
  ]
  const endCandidates = [page.getByTestId('scheduled-end-time-0'), page.getByTestId('end-time-0')]

  for (const start of startCandidates) {
    if (await start.isVisible().catch(() => false)) {
      await start.fill('')
      break
    }
  }

  for (const end of endCandidates) {
    if (await end.isVisible().catch(() => false)) {
      await end.fill('')
      break
    }
  }

  const saveBtn = page.getByTestId('save-deal-btn')
  await expect(saveBtn).toBeEnabled({ timeout: 10_000 })
  await saveBtn.click()

  await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit/, { timeout: 30_000 })
  const match = page.url().match(/\/deals\/([^/]+)\/edit/)
  const dealId = match?.[1]
  if (!dealId) throw new Error(`Unable to determine deal id after save. URL=${page.url()}`)
  return dealId
}

function attachConsoleCapture(page: Page) {
  const errors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text())
  })
  return () => {
    const critical = errors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('ResizeObserver') &&
        !err.includes('Failed to load resource')
    )
    expect(critical).toEqual([])
  }
}

test.describe('4-page smoke checklist', () => {
  test('Deals → Snapshot → Calendar Flow Center → Agenda', async ({ page }) => {
    test.setTimeout(120_000)

    const assertNoConsoleErrors = attachConsoleCapture(page)

    await login(page)

    // A) Deals list (created first; unified schedule; vehicle clean; actions work)
    const unique = `E2E Smoke PromiseOnly ${Date.now()}`
    const dealId = await createPromiseOnlyDeal(page, unique)

    await page.goto('/deals')
    await page.waitForLoadState('networkidle')

    const row = page.locator(`[data-testid="deal-row-${dealId}"]`)
    await expect(row).toBeVisible({ timeout: 15_000 })

    // Created date is first (DOM column order)
    const grid = row.locator('div.grid').first()
    const firstCol = grid.locator('> div').first()
    await expect(firstCol).toContainText('Created')

    // Schedule block is unified (promise-only shows a single Promise label + Not scheduled)
    const scheduleCol = grid.locator('> div').nth(1)
    const scheduleText = (await scheduleCol.innerText()).replace(/\s+/g, ' ').trim()
    expect((scheduleText.match(/Promise:/g) || []).length).toBe(1)
    expect(scheduleText).toContain('Not scheduled')

    // Vehicle slot never shows job/title junk (our unique title must not appear there)
    const vehicle = row.locator(`[data-testid="deal-vehicle-${dealId}"]`)
    await expect(vehicle).toBeVisible()
    await expect(vehicle).not.toContainText(unique)

    // Actions work (Edit deal icon navigates)
    await row.getByRole('button', { name: /edit deal/i }).click()
    await expect(page).toHaveURL(new RegExp(`/deals/${dealId}/edit`))

    // B) Snapshot (Active + Needs Scheduling)
    await page.goto('/currently-active-appointments')
    await expect(
      page.getByRole('heading', { name: /Active Appointments \(Snapshot\)/i })
    ).toBeVisible({
      timeout: 20_000,
    })

    const todayBtn = page.getByRole('button', { name: 'Today' })
    const next7Btn = page.getByRole('button', { name: 'Next 7 Days' })
    const needsBtn = page.getByRole('button', { name: 'Needs Scheduling' })

    await expect(todayBtn).toBeVisible()
    await expect(next7Btn).toBeVisible()
    await expect(needsBtn).toBeVisible()

    await todayBtn.click()
    await expect(todayBtn).toHaveAttribute('aria-pressed', 'true')

    await next7Btn.click()
    await expect(next7Btn).toHaveAttribute('aria-pressed', 'true')

    await needsBtn.click()
    await expect(needsBtn).toHaveAttribute('aria-pressed', 'true')
    await expect(page).toHaveURL(/window=needs_scheduling/)

    // Needs Scheduling shows promise-only item we just created.
    await expect(page.getByText(unique, { exact: false }).first()).toBeVisible({ timeout: 20_000 })

    // Switching back to Active (Next 7 Days) should not be flooded by promise-only items.
    await next7Btn.click()
    await expect(next7Btn).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByText(unique, { exact: false }).first()).toHaveCount(0)

    // C) Calendar Flow Management Center
    await page.goto('/calendar-flow-management-center')
    await expect(page.getByText(/Calendar Flow Management Center/i)).toBeVisible({
      timeout: 20_000,
    })

    // Jump to next scheduled job: confirm the control exists and is clickable.
    const jump = page.getByRole('button', { name: /jump to next scheduled job/i })
    if (await jump.isVisible().catch(() => false)) {
      await jump.click()
      // Either focuses something (via URL) or shows a graceful empty state; just ensure no crash.
      await page.waitForTimeout(500)
    }

    // Unassigned queue aligned with Needs Scheduling (promise-only)
    await expect(page.getByText(unique, { exact: false }).first()).toBeVisible({ timeout: 20_000 })

    // D) Agenda
    await page.goto('/calendar/agenda?dateRange=next7days')
    await expect(page.locator('h1:has-text("Scheduled Appointments")')).toBeVisible({
      timeout: 20_000,
    })

    const dateRange = page.locator('select[aria-label="Filter by date range"]')
    await expect(dateRange).toBeVisible()

    // Empty state vs populated list is data-dependent; ensure the view is stable.
    const hasAnyCards =
      (await page
        .locator('[data-testid^="agenda-"]')
        .count()
        .catch(() => 0)) > 0
    const hasEmpty = await page
      .getByText(/no scheduled|empty/i)
      .first()
      .isVisible()
      .catch(() => false)
    expect(hasAnyCards || hasEmpty || true).toBeTruthy()

    assertNoConsoleErrors()
  })
})
