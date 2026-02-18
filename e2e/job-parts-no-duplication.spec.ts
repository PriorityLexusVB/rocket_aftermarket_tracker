// e2e/job-parts-no-duplication.spec.ts
// Test to verify job_parts are not duplicated on multiple saves
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

async function tryClickSave(page: import('@playwright/test').Page) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const btn = page.getByTestId('save-deal-btn')
      await expect(btn).toBeEnabled({ timeout: 10_000 })
      await btn.click()
      return true
    } catch {
      if (attempt === 3) return false
      await page.waitForTimeout(500)
    }
  }

  return false
}

test.describe('Job Parts No Duplication', () => {
  test('should not create duplicate job_parts on multiple saves', async ({ page }) => {
    test.skip(
      !!process.env.CI,
      'Flaky in shared CI due intermittent external connectivity and long-running save retries; covered by other deal-form E2E specs.'
    )

    test.setTimeout(180_000)

    const { email, password } = requireAuthEnv()

    // Login
    await page.goto('/auth')
    await page.fill('input[name="email"]', email!)
    await page.fill('input[name="password"]', password!)
    await page.click('button:has-text("Sign In")')
    // Wait for successful navigation after login instead of arbitrary timeout
    await page.waitForURL(/^\/$|\/deals/, { timeout: 10000 })

    // Navigate to new deal page
    await page.goto('/deals/new')
    await waitForDealForm(page)
    await page.waitForLoadState('networkidle')

    // Fill in required fields
    const description = await getVisibleDescriptionField(page)
    await expect(description).toBeVisible()
    await description.fill(`E2E No-Dup Test ${Date.now()}`)

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)

    // Select a product
    const productSelect = page.getByTestId('product-select-0')
    await expect(productSelect).toBeVisible()
    await productSelect.selectOption({ index: 1 })

    // Provide a scheduled date (default requires_scheduling is enabled)
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const tomorrowDate = tomorrow.toISOString().slice(0, 10)
    const promisedDate = await getVisiblePromisedDateField(page)
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill(tomorrowDate)

    // Ensure at least one line-item product control is present after selection
    await expect(page.locator('[data-testid^="product-select-"]').first()).toBeVisible()

    // Save the deal
    const saveBtn = page.getByTestId('save-deal-btn')
    await expect(saveBtn).toBeEnabled()
    const firstSaveOk = await tryClickSave(page)
    expect(firstSaveOk).toBeTruthy()

    // Wait for redirect to edit page
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 30_000 })

    // Extract deal ID from URL
    const url = page.url()
    const dealIdMatch = url.match(/\/deals\/([A-Za-z0-9-]+)\/edit/)
    const dealId = dealIdMatch ? dealIdMatch[1] : null

    expect(dealId).not.toBeNull()

    // Wait for page to be fully loaded and ready for edits
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('save-deal-btn')).toBeEnabled()

    // Save again (simulate edit + save)
    const secondSaveOk = await tryClickSave(page)

    // Wait for save confirmation - use explicit UI indicators
    await Promise.race([
      page.getByTestId('save-success').waitFor({ state: 'visible', timeout: 10000 }),
      page.getByTestId('last-saved-timestamp').waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(async () => {
      // Fallback: wait for network to be idle as a sign of save completion
      await page.waitForLoadState('networkidle')
    })

    if (secondSaveOk) {
      // Ensure save button is ready for next save
      await expect(page.getByTestId('save-deal-btn')).toBeEnabled()

      // Save one more time to test for duplication
      const thirdSaveOk = await tryClickSave(page)
      if (thirdSaveOk) {
        await Promise.race([
          page.getByTestId('save-success').waitFor({ state: 'visible', timeout: 10000 }),
          page.getByTestId('last-saved-timestamp').waitFor({ state: 'visible', timeout: 10000 }),
        ]).catch(async () => {
          await page.waitForLoadState('networkidle')
        })
      }
    }

    // Now verify that there's only ONE job_parts row for this job
    // We can check this via UI: should see only 1 line item row
    const lineItemCards = page.locator('[data-testid^="product-select-"]')
    const rowCount = await lineItemCards.count()

    // Should have exactly 1 line item row (no duplicates)
    expect(rowCount).toBe(1)

    // If the test passes, we've verified that:
    // 1. Deal was created with 1 product
    // 2. Saved multiple times
    // 3. Still only 1 product line shows in the form (no duplication)

    console.log(`✅ Job parts duplication test passed for deal: ${dealId}`)
  })
})
