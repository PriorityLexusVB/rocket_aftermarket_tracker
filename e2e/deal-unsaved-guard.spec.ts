import { test, expect } from '@playwright/test'

// Relies on storageState.json if configured in playwright.config.ts; otherwise uses public flows

test.describe('DealForm Unsaved Changes Guard', () => {
  test('Cancel prompts when form is dirty on New Deal', async ({ page }) => {
    // Go to New Deal page
    await page.goto('/deals/new')

    // Ensure the form has finished loading before interacting
    await expect(page.getByTestId('deal-form')).toBeVisible()

    // Type into Title to make form dirty
    const title = page.getByTestId('title-input')
    await title.fill('Tint Package')
    await expect(title).toHaveValue('Tint Package')

    // First attempt: stub confirm to return false (stay on page) and capture invocation
    await page.evaluate(() => {
      // @ts-ignore
      window.__confirmCalls = 0
      const original = window.confirm
      // @ts-ignore
      window.__origConfirm = original
      window.confirm = (msg) => {
        // @ts-ignore
        window.__confirmCalls = (window.__confirmCalls || 0) + 1
        return false
      }
    })
    await page.getByRole('button', { name: 'Cancel' }).click()
    expect(await page.evaluate(() => (window as any).__confirmCalls)).toBe(1)

    // Ensure we are still on New Deal and title persists
    await expect(page).toHaveURL(/\/deals\/new$/)
    await expect(page.getByTestId('title-input')).toHaveValue('Tint Package')

    // Second attempt: stub confirm to return true (navigate away)
    await page.evaluate(() => {
      window.confirm = () => true
    })
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Expect to land on deals listing page
    await expect(page).toHaveURL(/\/deals(\?.*)?$/)
  })
})
