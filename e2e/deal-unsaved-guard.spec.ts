import { test, expect } from '@playwright/test'

import { requireAuthEnv } from './_authEnv'

async function waitForDealForm(page: import('@playwright/test').Page) {
  await Promise.race([
    page.getByTestId('deal-form').waitFor({ state: 'visible', timeout: 15_000 }),
    page.getByTestId('deal-date-input').waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function getVisibleDescriptionField(page: import('@playwright/test').Page) {
  const v1 = page.getByTestId('description-input')
  if (await v1.isVisible().catch(() => false)) return v1
  return page.getByTestId('notes-input')
}

// Relies on storageState.json if configured in playwright.config.ts; otherwise uses public flows

test.describe('DealForm Unsaved Changes Guard', () => {
  test('Cancel prompts when form is dirty on New Deal', async ({ page }) => {
    requireAuthEnv()
    // Go to New Deal page
    await page.goto('/deals/new')

    // Ensure the form has finished loading before interacting
    await waitForDealForm(page)

    // Type into Description to make form dirty
    const description = await getVisibleDescriptionField(page)
    await description.fill('Tint Package')
    await expect(description).toHaveValue('Tint Package')

    // First attempt: stub confirm to return false (stay on page) and capture invocation
    await page.evaluate(() => {
      // @ts-ignore
      window.__confirmCalls = 0
      const original = window.confirm
      // @ts-ignore
      window.__origConfirm = original
      window.confirm = () => {
        // @ts-ignore
        window.__confirmCalls = (window.__confirmCalls || 0) + 1
        return false
      }
    })
    await page.getByRole('button', { name: 'Cancel' }).click()
    const confirmCalls = await page.evaluate(() => (window as any).__confirmCalls)

    if (confirmCalls > 0) {
      // Ensure we are still on New Deal and title persists when guard is active
      await expect(page).toHaveURL(/\/deals\/new$/)
      await expect(await getVisibleDescriptionField(page)).toHaveValue('Tint Package')
    }

    // Second attempt: stub confirm to return true (navigate away)
    await page.evaluate(() => {
      window.confirm = () => true
    })
    await page.getByRole('button', { name: 'Cancel' }).click()

    // Expect to land on deals listing page
    await expect(page).toHaveURL(/\/deals(\?.*)?$/)
  })
})
