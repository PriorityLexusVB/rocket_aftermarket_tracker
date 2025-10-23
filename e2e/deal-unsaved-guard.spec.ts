import { test, expect } from '@playwright/test'

// Relies on storageState.json if configured in playwright.config.ts; otherwise uses public flows

test.describe('DealForm Unsaved Changes Guard', () => {
  test('Cancel prompts when form is dirty on New Deal', async ({ page }) => {
    // Go to New Deal page
    await page.goto('/deals/new')

    // Type into Title to make form dirty
    const title = page.getByTestId('title-input')
    await title.fill('Tint Package')
    await expect(title).toHaveValue('Tint Package')

    // Click Cancel and intercept confirm dialog
    const [dialog] = await Promise.all([
      page.waitForEvent('dialog'),
      page.getByRole('button', { name: 'Cancel' }).click(),
    ])
    expect(dialog.type()).toBe('confirm')

    // Dismiss first to stay on page
    await dialog.dismiss()

    // Ensure we are still on New Deal and title persists
    await expect(page).toHaveURL(/\/deals\/new$/)
    await expect(page.getByTestId('title-input')).toHaveValue('Tint Package')

    // Try again and accept to navigate away
    const [dialog2] = await Promise.all([
      page.waitForEvent('dialog'),
      page.getByRole('button', { name: 'Cancel' }).click(),
    ])
    await dialog2.accept()

    // Expect to land on deals listing page
    await expect(page).toHaveURL(/\/deals(\?.*)?$/)
  })
})
