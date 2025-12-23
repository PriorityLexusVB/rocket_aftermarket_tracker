import { test, expect } from '@playwright/test'

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

test.describe('Deal create + edit flow', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('create a deal, then edit and persist changes', async ({ page }) => {
    // Create new deal
    await page.goto('/deals/new')

    const description = page.getByTestId('description-input')
    await expect(description).toBeVisible()
    const initialDescription = `E2E Deal ${Date.now()}`
    await description.fill(initialDescription)

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

    // Some environments may briefly load the edit form without joined job_parts.
    // Ensure at least one product is selected before attempting to save edits.
    const productOnEdit = page.getByTestId('product-select-0')
    await expect(productOnEdit).toBeVisible()
    if (!(await productOnEdit.inputValue())) {
      await productOnEdit.selectOption({ index: 1 })
    }

    // Edit: change description and toggle scheduling flags
    const editedDescription = `${initialDescription} - Edited`
    await description.fill(editedDescription)
    await expect(description).toHaveValue(editedDescription)

    // Toggle loaner need and ensure it remains after save
    const loaner = page.getByTestId('loaner-checkbox')
    const wasChecked = await loaner.isChecked()
    await loaner.setChecked(!wasChecked)

    // Ensure a product is selected right before saving (guards against late initial sync overwriting state).
    await productOnEdit.selectOption({ index: 1 })
    await expect(productOnEdit).not.toHaveValue('')

    // Save changes
    await save.click()

    // Wait for the save to settle: prefer inline success, but fail fast if an error banner appears.
    const saveSuccess = page.getByTestId('save-success')
    const saveError = page.getByTestId('save-error')
    await Promise.race([
      saveSuccess.waitFor({ state: 'visible', timeout: 10000 }),
      saveError.waitFor({ state: 'visible', timeout: 10000 }),
      page.getByTestId('last-saved-timestamp').waitFor({ state: 'visible', timeout: 10000 }),
    ])
    await expect(saveError).toHaveCount(0)
    await expect(saveSuccess).toBeVisible()

    // Reload and verify at least one persisted field
    await page.reload()
    await expect(page.getByTestId('description-input')).toBeVisible()

    // Verify loaner checkbox state persisted
    await expect(page.getByTestId('loaner-checkbox')).toHaveJSProperty('checked', !wasChecked)
  })
})
