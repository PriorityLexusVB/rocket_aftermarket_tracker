// e2e/agenda.spec.ts
// Playwright spec skeleton for Agenda feature (flag-dependent)
import { test, expect } from '@playwright/test'

// Assumes environment has VITE_SIMPLE_CALENDAR=true and a way to create a scheduled deal quickly.

test.describe('Agenda View', () => {
  test('redirect after create focuses new appointment', async ({ page }) => {
    // Login helper (assumes existing auth portal test utilities)
    await page.goto('/auth')
    // Minimal auth flow (placeholder selectors)
    await page.fill('input[name="email"]', process.env.E2E_EMAIL || 'tester@example.com')
    await page.fill('input[name="password"]', process.env.E2E_PASSWORD || 'your-password')
    await page.click('button:has-text("Sign In")')

    // Create a new deal with scheduling (placeholder - adjust selectors to real form)
    await page.goto('/deals/new')
    await page.fill('input[name="title"]', 'Agenda Smoke Test Deal')
    // Provide a scheduled start time via any date/time widget; placeholder below
    // (Real implementation would interact with date picker components.)
    // Submit form
    await page.click('button:has-text("Save")')

    // Expect redirect to agenda
    await page.waitForURL(/\/calendar\/agenda\?focus=/)
    const focused = page.locator('li.animate-pulse')
    await expect(focused).toBeVisible()
  })
})
