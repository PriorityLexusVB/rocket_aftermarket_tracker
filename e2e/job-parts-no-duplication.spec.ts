// e2e/job-parts-no-duplication.spec.ts
// Test to verify job_parts are not duplicated on multiple saves
import { test, expect } from '@playwright/test'

test.describe('Job Parts No Duplication', () => {
  test('should not create duplicate job_parts on multiple saves', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[name="email"]', process.env.E2E_EMAIL || 'tester@example.com')
    await page.fill('input[name="password"]', process.env.E2E_PASSWORD || 'your-password')
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(2000)

    // Navigate to new deal page
    await page.goto('/deals/new')
    await page.waitForLoadState('networkidle')

    // Fill in required fields
    const description = page.getByTestId('description-input')
    await expect(description).toBeVisible()
    await description.fill(`E2E No-Dup Test ${Date.now()}`)

    // Select a product
    const productSelect = page.getByTestId('product-select-0')
    await expect(productSelect).toBeVisible()
    await productSelect.selectOption({ index: 1 })

    // Wait for product selection to populate price
    await page.waitForTimeout(500)

    // Save the deal
    const saveBtn = page.getByTestId('save-deal-btn')
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Wait for redirect to edit page
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 15_000 })

    // Extract deal ID from URL
    const url = page.url()
    const dealIdMatch = url.match(/\/deals\/([A-Za-z0-9-]+)\/edit/)
    const dealId = dealIdMatch ? dealIdMatch[1] : null

    expect(dealId).not.toBeNull()

    // Wait for any autosave to complete
    await page.waitForTimeout(2000)

    // Save again (simulate edit + save)
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    // Wait for save confirmation
    await Promise.race([
      page.getByTestId('save-success').waitFor({ state: 'visible', timeout: 10000 }),
      page.getByTestId('last-saved-timestamp').waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => page.waitForTimeout(2000))

    // Save one more time to test for duplication
    await page.waitForTimeout(1000)
    await expect(saveBtn).toBeEnabled()
    await saveBtn.click()

    await Promise.race([
      page.getByTestId('save-success').waitFor({ state: 'visible', timeout: 10000 }),
      page.getByTestId('last-saved-timestamp').waitFor({ state: 'visible', timeout: 10000 }),
    ]).catch(() => page.waitForTimeout(2000))

    // Now verify that there's only ONE job_parts row for this job
    // We can check this via UI: should see only 1 line item row
    const lineItemRows = page.locator('[data-testid^="line-item-row-"]')
    const rowCount = await lineItemRows.count()

    // Should have exactly 1 line item row (no duplicates)
    expect(rowCount).toBe(1)

    // If the test passes, we've verified that:
    // 1. Deal was created with 1 product
    // 2. Saved multiple times
    // 3. Still only 1 product line shows in the form (no duplication)

    console.log(`✅ Job parts duplication test passed for deal: ${dealId}`)
  })
})
