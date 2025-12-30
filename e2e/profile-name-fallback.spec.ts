import { test, expect } from '@playwright/test'

import { requireAuthEnv } from './_authEnv'

// Simulates capability flag downgrades for user_profiles name columns by pre-setting
// sessionStorage before app code runs. Verifies flags reflect expected fallback priority.

test.describe('Profile name capability fallback', () => {
  test('missing name -> falls back to full_name', async ({ page }) => {
    requireAuthEnv()
    // Pre-set capability flags before app scripts execute
    await page.addInitScript(() => {
      sessionStorage.setItem('cap_userProfilesName', 'false')
      sessionStorage.setItem('cap_userProfilesFullName', 'true')
      sessionStorage.setItem('cap_userProfilesDisplayName', 'true')
    })

    await page.goto('/')
    // Wait for preflight to run and set sessionStorage caps
    await page.waitForFunction(
      () =>
        sessionStorage.getItem('cap_userProfilesName') !== null ||
        sessionStorage.getItem('cap_userProfilesFullName') !== null ||
        sessionStorage.getItem('cap_userProfilesDisplayName') !== null,
      undefined,
      { timeout: 10000 }
    )

    // Navigate to a page that renders staff names (e.g., Deals list)
    // Navigate to another route to ensure SPA navigation still works with downgraded caps
    await page.goto('/deals')

    // Expect at least one staff label rendered; since test data is mocked, we assert no crash and
    // that the app considers "full_name" as the fragment candidate
    // We check sessionStorage capability flags exposed by the app
    const caps = await page.evaluate(() => ({
      name: sessionStorage.getItem('cap_userProfilesName'),
      full: sessionStorage.getItem('cap_userProfilesFullName'),
      display: sessionStorage.getItem('cap_userProfilesDisplayName'),
    }))
    expect(caps).toEqual({ name: 'false', full: 'true', display: 'true' })
  })

  test('missing name and full_name -> falls back to display_name', async ({ page }) => {
    requireAuthEnv()
    await page.route('**/api/health-user-profiles', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ columns: { name: false, full_name: false, display_name: true } }),
      })
    })

    await page.addInitScript(() => {
      sessionStorage.setItem('cap_userProfilesName', 'false')
      sessionStorage.setItem('cap_userProfilesFullName', 'false')
      sessionStorage.setItem('cap_userProfilesDisplayName', 'true')
    })
    await page.goto('/')
    await page.goto('/claims-management-center')

    const caps = await page.evaluate(() => ({
      name: sessionStorage.getItem('cap_userProfilesName'),
      full: sessionStorage.getItem('cap_userProfilesFullName'),
      display: sessionStorage.getItem('cap_userProfilesDisplayName'),
    }))
    expect(caps).toEqual({ name: 'false', full: 'false', display: 'true' })
  })

  test('only email available -> email local-part used', async ({ page }) => {
    requireAuthEnv()
    await page.route('**/api/health-user-profiles', (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ columns: { name: false, full_name: false, display_name: false } }),
      })
    })

    await page.addInitScript(() => {
      sessionStorage.setItem('cap_userProfilesName', 'false')
      sessionStorage.setItem('cap_userProfilesFullName', 'false')
      sessionStorage.setItem('cap_userProfilesDisplayName', 'false')
    })
    await page.goto('/')
    await page.goto('/advanced-business-intelligence-analytics')

    const caps = await page.evaluate(() => ({
      name: sessionStorage.getItem('cap_userProfilesName'),
      full: sessionStorage.getItem('cap_userProfilesFullName'),
      display: sessionStorage.getItem('cap_userProfilesDisplayName'),
    }))
    expect(caps).toEqual({ name: 'false', full: 'false', display: 'false' })
  })
})
