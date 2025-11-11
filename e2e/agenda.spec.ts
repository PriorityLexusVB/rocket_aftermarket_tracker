// e2e/agenda.spec.ts
// Playwright spec for Agenda feature (flag-dependent)
import { test, expect } from '@playwright/test'

// Assumes environment has VITE_SIMPLE_CALENDAR=true

test.describe('Agenda View', () => {
  test.skip('redirect after create focuses new appointment', async ({ page }) => {
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

    // Verify filters are present
    await expect(page.locator('select[aria-label="Filter by date range"]')).toBeVisible()
    await expect(page.locator('select[aria-label="Filter by status"]')).toBeVisible()
    await expect(page.locator('input[aria-label="Search appointments"]')).toBeVisible()
  })
})
