import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

async function ensureAuth(page: Page) {
  await page.goto('/debug-auth')
  await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByTestId('profile-org-id')).toBeVisible({ timeout: 15_000 })
}

function yyyyMmDd(d: Date) {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

async function createMinimalDeal(page: Page, description: string) {
  await page.goto('/deals/new')
  await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 10_000 })

  await page.getByTestId('description-input').fill(description)
  await page.getByTestId('product-select-0').selectOption({ index: 1 })
  await page.getByTestId('promised-date-0').fill(yyyyMmDd(new Date()))

  const saveBtn = page.getByTestId('save-deal-btn')
  await expect(saveBtn).toBeEnabled()
  await saveBtn.click()
}

// New Deal: reps visible and loaner toggles on first click
test('new deal: reps dropdowns present and loaner checkbox toggles once', async ({ page }) => {
  await ensureAuth(page)

  await page.goto('/deals/new')

  // Reps selects visible (Step 1)
  await expect(page.getByTestId('sales-select')).toBeVisible()
  await expect(page.getByTestId('delivery-select')).toBeVisible()
  await expect(page.getByTestId('finance-select')).toBeVisible()

  // Loaner checkbox toggles reliably
  const loaner = page.getByTestId('loaner-checkbox')
  await expect(loaner).toBeVisible()
  const wasChecked = await loaner.isChecked()
  await page.locator('label[for="needsLoaner"]').click({ force: true }) // single click should toggle
  await expect(loaner).toHaveJSProperty('checked', !wasChecked)
  await page.locator('label[for="needsLoaner"]').click({ force: true })
  await expect(loaner).toHaveJSProperty('checked', wasChecked)
})

// Edit Deal: open first deal, verify reps and loaner toggle
// Note: Relies on at least one deal existing in the list.
// If none exist, this test will be skipped gracefully.
test('edit deal: reps visible and loaner checkbox toggles once', async ({ page }) => {
  await ensureAuth(page)

  await page.goto('/deals')
  await page.waitForLoadState('networkidle')

  // Navigate directly to edit page of first visible deal row.
  let firstRow = page.locator('[data-testid^="deal-row-"]').first()
  const hasRow = await firstRow.isVisible().catch(() => false)
  if (!hasRow) {
    await createMinimalDeal(page, `E2E Reps Edit ${Date.now()}`)
    await page.goto('/deals')
    await page.waitForLoadState('networkidle')
    firstRow = page.locator('[data-testid^="deal-row-"]').first()
    await expect(firstRow).toBeVisible({ timeout: 15_000 })
  }

  const dealTestId = await firstRow.getAttribute('data-testid')
  const dealId = dealTestId?.replace('deal-row-', '')
  if (!dealId) throw new Error('Unable to derive deal id from first row')
  await page.goto(`/deals/${dealId}/edit`, { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 20_000 })

  // The modal should appear; verify reps blocks exist
  await expect(page.getByTestId('sales-select')).toBeVisible()
  await expect(page.getByTestId('delivery-select')).toBeVisible()
  await expect(page.getByTestId('finance-select')).toBeVisible()

  // Loaner checkbox behavior
  const loaner = page.getByTestId('loaner-checkbox')
  await expect(loaner).toBeVisible()
  const wasChecked = await loaner.isChecked()
  await page.locator('label[for="needsLoaner"]').click({ force: true })
  await expect(loaner).toHaveJSProperty('checked', !wasChecked)
  await page.locator('label[for="needsLoaner"]').click({ force: true })
  await expect(loaner).toHaveJSProperty('checked', wasChecked)
})
