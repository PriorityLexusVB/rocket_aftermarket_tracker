import { test, expect } from '@playwright/test'

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

test.describe('Deal create + edit flow', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('create a deal, then edit and persist changes', async ({ page }) => {
    // Create new deal
    await page.goto('/deals/new')

    const title = page.getByTestId('title-input')
    await expect(title).toBeVisible()
    const initialTitle = `E2E Deal ${Date.now()}`
    await title.fill(initialTitle)

    const vendor = page.getByTestId('vendor-select')
    await expect(vendor).toBeVisible()
    await vendor.selectOption({ index: 1 })

    const product = page.getByTestId('product-select-0')
    await expect(product).toBeVisible()
    await product.selectOption({ index: 1 })

    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()
    await save.click()

    // Redirect to edit page
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 15_000 })

    // Edit: change title and toggle scheduling flags
    const editedTitle = `${initialTitle} - Edited`
    await title.fill(editedTitle)

    // For line item 0: uncheck requires scheduling to reveal reason, then re-check
    const requires = page.getByTestId('requires-scheduling-0')
    await requires.uncheck()
    const reason = page.getByTestId('no-schedule-reason-0')
    await expect(reason).toBeVisible()
    await reason.fill('No scheduling required for test')
    await requires.check()
    await expect(reason).toHaveCount(0)

    // Save changes
    await save.click()

    // Stay on edit page and ensure the title persisted after reload
    await page.reload()
    await expect(title).toHaveValue(editedTitle)
  })
})
