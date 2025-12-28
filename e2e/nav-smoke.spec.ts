import { test, expect } from '@playwright/test'
import { requireAuthEnv } from './_authEnv'

// Minimal nav smoke: verify navbar links navigate correctly (desktop),
// and routes load when directly visited (mobile).

test.describe('Navigation smoke', () => {
  const desktopLinks: Array<{ name: string; path: string }> = [
    { name: 'Calendar', path: '/calendar-flow-management-center' },
    { name: 'Appointments', path: '/currently-active-appointments' },
    { name: 'Claims', path: '/claims-management-center' },
    { name: 'Deals', path: '/deals' },
    { name: 'Analytics', path: '/advanced-business-intelligence-analytics' },
    { name: 'Admin', path: '/admin' },
  ]

  test('desktop navbar links navigate to expected routes', async ({ page }) => {
    requireAuthEnv()
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/')

    // Authenticated flow: click through navbar links
    for (const { name, path } of desktopLinks) {
      const link = page.getByRole('link', { name }).first()
      const visible = await link.isVisible().catch(() => false)
      if (visible) {
        await link.click()
        await expect(page).toHaveURL(new RegExp(path.replaceAll('/', '\\/')))
      } else {
        // Fallback: direct navigation if navbar link not present (e.g., role-gated)
        await page.goto(path)
        await expect(page).toHaveURL(new RegExp(path.replaceAll('/', '\\/')))
      }
    }

    // Communications and Profile: direct routes (links exist via dropdowns/notifications)
    await page.goto('/communications')
    await expect(page).toHaveURL(/\/communications/)
    await expect(page.getByRole('heading', { name: /communications center/i })).toBeVisible()

    await page.goto('/profile')
    await expect(page).toHaveURL(/\/profile/)
    await expect(page.getByRole('heading', { name: /profile settings/i })).toBeVisible()
  })

  test('mobile direct route visits resolve', async ({ page }) => {
    requireAuthEnv()
    // Model: directly visit routes (mobile bottom bar omits Admin)
    await page.setViewportSize({ width: 390, height: 844 })

    const paths = [
      '/calendar-flow-management-center',
      '/currently-active-appointments',
      '/claims-management-center',
      '/deals',
      '/advanced-business-intelligence-analytics',
      '/admin',
      '/communications',
      '/profile',
    ]

    for (const p of paths) {
      await page.goto(p)
      await expect(page).toHaveURL(new RegExp(`${p.replace('/', '\\/')}`))
    }
  })
})
