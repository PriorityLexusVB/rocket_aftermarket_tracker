// e2e/agenda.spec.ts
// Playwright spec for Agenda feature (flag-dependent)
import { test, expect } from '@playwright/test'

// Assumes environment has VITE_SIMPLE_CALENDAR=true

test.describe('Agenda View', () => {
  test.skip('redirect after create focuses new appointment', async () => {
    // Note: This test requires a full deal creation flow which involves multiple steps:
    // 1. Create deal with customer/vehicle
    // 2. Add line items with scheduling
    // 3. Set scheduled_start_time and scheduled_end_time
    // 4. Save and verify redirect to /calendar/agenda?focus=<id>
    // Skip for now as it requires complete form flow setup
    // Can be implemented once we have stable test data fixtures
  })

  test('agenda view renders with flag enabled', async ({ page }) => {
    // Login
    await page.goto('/auth')
    await page.fill('input[name="email"]', process.env.E2E_EMAIL || 'tester@example.com')
    await page.fill('input[name="password"]', process.env.E2E_PASSWORD || 'your-password')
    await page.click('button:has-text("Sign In")')

    // Wait for auth
    await page.waitForTimeout(2000)

    // Navigate to agenda
    await page.goto('/calendar/agenda')

    // Verify page loads
    await expect(page.locator('h1:has-text("Scheduled Appointments")')).toBeVisible()

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
    // Login first
    await page.goto('/auth')
    await page.fill('input[name="email"]', process.env.E2E_EMAIL || 'tester@example.com')
    await page.fill('input[name="password"]', process.env.E2E_PASSWORD || 'your-password')
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(2000)

    // Navigate to agenda with a focus parameter (use a placeholder ID)
    await page.goto('/calendar/agenda?focus=test-job-123')

    // Verify page loads without error
    await expect(page.locator('h1:has-text("Scheduled Appointments")')).toBeVisible()

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
    // Login
    await page.goto('/auth')
    await page.fill('input[name="email"]', process.env.E2E_EMAIL || 'tester@example.com')
    await page.fill('input[name="password"]', process.env.E2E_PASSWORD || 'your-password')
    await page.click('button:has-text("Sign In")')
    await page.waitForTimeout(2000)

    // Navigate to agenda
    await page.goto('/calendar/agenda')

    // Expand the filters panel to reveal status filter
    const filtersButton = page.locator('button:has-text("Filters")')
    await expect(filtersButton).toBeVisible()
    await filtersButton.click()

    // Change a filter
    const statusFilter = page.locator('select[aria-label="Filter by status"]')
    await expect(statusFilter).toBeVisible()
    await statusFilter.selectOption({ label: 'Completed' })

    // Verify filter was applied
    await expect(statusFilter).toHaveValue('completed')

    // Navigate away and back
    await page.goto('/')
    await page.goto('/calendar/agenda')

    // Expand filters again to check persistence
    const filtersButtonAfter = page.locator('button:has-text("Filters")')
    await expect(filtersButtonAfter).toBeVisible()
    await filtersButtonAfter.click()

    // Check if filter persisted
    const statusFilterAfter = page.locator('select[aria-label="Filter by status"]')
    await expect(statusFilterAfter).toHaveValue('completed')
    await expect(page.locator('h1:has-text("Scheduled Appointments")')).toBeVisible()
  })
})
