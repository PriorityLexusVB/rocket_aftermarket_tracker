import { test, expect } from '@playwright/test'
import { requireAuthEnv } from './_authEnv'

async function waitForDealForm(page: import('@playwright/test').Page) {
  await Promise.race([
    page.getByTestId('deal-form').waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByTestId('deal-date-input').waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function findVisibleSaveButton(page: import('@playwright/test').Page) {
  const candidates = [
    page.getByTestId('save-deal-btn').last(),
    page.getByTestId('next-to-line-items-btn').last(),
    page.getByRole('button', { name: /next.*line items|create deal|save changes|update deal|save/i }).first(),
    page.locator('button[type="submit"]').last(),
    page.locator('button:has-text("Next → Line Items")').last(),
  ]

  for (let attempt = 0; attempt < 10; attempt += 1) {
    for (const candidate of candidates) {
      if (await candidate.isVisible().catch(() => false)) return candidate
    }
    await page.waitForTimeout(300)
  }

  return candidates[0]
}

// Validates that the DealForm sticky footer actions are visible and clickable on a small viewport
// and are not overlapped by the mobile bottom navbar.

test.describe('DealForm sticky footer - mobile', () => {
  test('save button is visible and clickable at 390x844', async ({ page }) => {
    requireAuthEnv()
    await page.setViewportSize({ width: 390, height: 844 })

    // Go to create page (assumes authenticated storageState is configured)
    await page.goto('/deals/new')

    // Wait for the form
    await waitForDealForm(page)

    // Ensure the sticky footer is present and the Save button visible
    const saveBtn = await findVisibleSaveButton(page)
    await saveBtn.scrollIntoViewIfNeeded()
    await expect(saveBtn).toBeVisible()

    // Step-1 variants gate the primary action behind required fields.
    if (await saveBtn.isDisabled()) {
      const customerName = page
        .getByTestId('customer-name-input')
        .or(page.getByPlaceholder(/enter customer name/i).first())
      const dealNumber = page
        .getByTestId('deal-number-input')
        .or(page.getByPlaceholder(/enter deal number/i).first())

      if (await customerName.isVisible().catch(() => false)) {
        await customerName.fill(`E2E Mobile ${Date.now()}`)
      }
      if (await dealNumber.isVisible().catch(() => false)) {
        await dealNumber.fill(`M-${Date.now()}`)
      }
    }

    // The button may be disabled briefly while the form finishes loading dropdowns.
    await expect(saveBtn).toBeEnabled({ timeout: 15_000 })

    // Click Save without adding products to trigger validation,
    // which also proves the click landed (not intercepted by navbar)
    await saveBtn.click()

    const steppedToLineItems = await page
      .getByRole('heading', { name: /line items/i })
      .isVisible()
      .catch(() => false)

    if (!steppedToLineItems) {
      const error = page.getByTestId('save-error')
      await expect(error.or(page.getByText(/Please add at least one product/i))).toBeVisible()
    }

    // Sticky actions are implemented as a section with sticky positioning; the Save button being
    // clickable suffices to assert it isn't obstructed by any mobile nav.
  })
})
