import { test, expect, type Page } from '@playwright/test'

async function getBodyPaddingBottomPx(page: Page) {
  const paddingBottom = await page.evaluate(() => {
    const value = window.getComputedStyle(document.body).paddingBottom
    return value
  })

  const parsed = Number.parseFloat(String(paddingBottom || '0'))
  return Number.isFinite(parsed) ? parsed : 0
}

test('mobile viewport: reserves space for fixed bottom nav', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/deals')

  const bottomNav = page.locator('nav[class*="bottom-0"]')
  await expect(bottomNav).toBeVisible()
  await expect(page.locator('body')).toHaveClass(/has-mobile-bottom-nav/)

  const padding = await getBodyPaddingBottomPx(page)
  expect(padding).toBeGreaterThanOrEqual(64)
})

test('desktop viewport: does not apply mobile bottom nav padding', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 })
  await page.goto('/deals')

  // Bottom nav is hidden on md+; still ensure we don't keep the mobile class.
  await expect(page.locator('body')).not.toHaveClass(/has-mobile-bottom-nav/)
})
