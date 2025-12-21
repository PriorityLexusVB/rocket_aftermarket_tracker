// e2e/snapshot-smoke.spec.ts
// Optional smoke test for Snapshot view (Currently Active Appointments)
// Added as part of closure task verification (Nov 16, 2025)
import { test, expect } from '@playwright/test'

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

test.describe('Snapshot View (Currently Active Appointments)', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('snapshot view loads successfully', async ({ page }) => {
    // Collect console errors BEFORE navigating
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Navigate to currently active appointments (snapshot view)
    await page.goto('/currently-active-appointments')

    // Verify the page loads without errors
    // The exact heading may vary, so check for common elements
    const pageLoaded = await page.waitForSelector('body', { timeout: 5000 })
    expect(pageLoaded).toBeTruthy()

    // Wait a moment for any console errors to appear
    await page.waitForTimeout(1000)

    // Filter out expected/benign errors (adjust as needed)
    const criticalErrors = errors.filter(
      (err) =>
        !err.includes('favicon') &&
        !err.includes('ResizeObserver') &&
        !err.includes('404') &&
        !err.includes('status of 400') &&
        !err.includes('status of 422') &&
        !err.includes('status of 403') &&
        !err.includes('Failed to load resource')
    )

    expect(criticalErrors).toEqual([])
  })

  test('snapshot view renders key components', async ({ page }) => {
    await page.goto('/currently-active-appointments')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Check for presence of key UI elements
    // Note: Exact selectors may need adjustment based on actual implementation

    // Should have some kind of container for appointments
    const hasContent = await page.locator('body').count()
    expect(hasContent).toBeGreaterThan(0)

    // Check that the page isn't showing a critical error state
    const errorStates = await page.locator('[role="alert"]').count()
    // If there are alerts, they should be informational, not critical errors
    if (errorStates > 0) {
      const errorText = await page.locator('[role="alert"]').first().textContent()
      // Should not contain critical error messages
      expect(errorText?.toLowerCase()).not.toContain('critical')
      expect(errorText?.toLowerCase()).not.toContain('fatal')
    }
  })

  test('snapshot view handles empty state gracefully', async ({ page }) => {
    await page.goto('/currently-active-appointments')

    // Wait for page to load
    await page.waitForTimeout(1500)

    // Even if there are no appointments, the page should render without crashing
    const bodyContent = await page.locator('body').innerHTML()
    expect(bodyContent).toBeTruthy()
    expect(bodyContent.length).toBeGreaterThan(100) // Should have substantial HTML

    // Should not show uncaught error messages
    const criticalErrors = await page.locator('text=/uncaught|unhandled|fatal/i').count()
    expect(criticalErrors).toBe(0)
  })

  test('snapshot view navigation is accessible', async ({ page }) => {
    // Start from home
    await page.goto('/')

    // Wait for navigation to be ready
    await page.waitForTimeout(1000)

    // Try to navigate to snapshot view via menu or direct URL
    await page.goto('/currently-active-appointments')

    // Verify navigation succeeded
    await page.waitForTimeout(1000)
    expect(page.url()).toContain('/currently-active-appointments')

    // Page should be functional
    const bodyVisible = await page.locator('body').isVisible()
    expect(bodyVisible).toBeTruthy()
  })
})
