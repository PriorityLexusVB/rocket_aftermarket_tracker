import { test, expect } from '@playwright/test'

// Helper to locate a table row by its text content
const rowByText = (page, text: string) => page.locator('tbody tr').filter({ hasText: text })

// Ensures we wait for modals to appear
const expectModalOpen = async (page) => {
  await expect(page.locator('div[role="dialog"], .fixed.inset-0')).toBeVisible()
}

// Clicks the first button (edit) within a row
const clickEditInRow = async (page, rowText: string) => {
  const row = rowByText(page, rowText)
  await expect(row).toHaveCount(1)
  await row.locator('button').first().click()
}

// Clicks the second button (delete) within a row
const clickDeleteInRow = async (page, rowText: string) => {
  const row = rowByText(page, rowText)
  await expect(row).toHaveCount(1)
  await row.locator('button').nth(1).click()
  // Confirm browser confirm() dialog
  page.once('dialog', (dialog) => dialog.accept())
}

// Navigates to Admin page and waits for it to be ready
const gotoAdmin = async (page) => {
  await page.goto('/admin')
  await expect(page.getByRole('heading', { name: /Administrative|Admin|Configuration/i }))
    .toBeVisible({ timeout: 10000 })
    .catch(() => {})
}

test.describe('Admin CRUD - Vendors and Products', () => {
  test('create, edit, and delete a Vendor', async ({ page }) => {
    const unique = Date.now()
    const vendorName = `E2E Vendor ${unique}`
    const vendorNameUpdated = `${vendorName} Updated`

    await gotoAdmin(page)
    // Switch to Vendors tab explicitly
    await page.getByRole('button', { name: /vendors/i }).click()
    // Add Vendor
    await page.getByRole('button', { name: /add vendor/i }).click()
    await expectModalOpen(page)

    await page.getByLabel('Vendor Name').fill(vendorName)
    await page.getByLabel('Contact Person').fill('QA Bot')
    await page.getByLabel('Phone').fill('555-0100')
    await page.getByLabel('Email').fill(`qa-${unique}@example.com`)
    await page.getByLabel('Specialty').fill('Tint')
    await page.getByLabel(/Rating/).fill('4.5')

    await page.getByRole('button', { name: /create/i }).click()

    // Expect the vendor to appear in the table
    await expect(rowByText(page, vendorName)).toHaveCount(1)

    // Edit the vendor
    await clickEditInRow(page, vendorName)
    await expectModalOpen(page)
    const nameInput = page.getByLabel('Vendor Name')
    await nameInput.fill('')
    await nameInput.fill(vendorNameUpdated)
    await page.getByRole('button', { name: /update/i }).click()

    await expect(rowByText(page, vendorNameUpdated)).toHaveCount(1)

    // Delete the vendor
    await clickDeleteInRow(page, vendorNameUpdated)
    await expect(rowByText(page, vendorNameUpdated)).toHaveCount(0)
  })

  test('create, edit, and delete a Product', async ({ page }) => {
    const unique = Date.now()
    const productName = `E2E Product ${unique}`
    const productNameUpdated = `${productName} Updated`

    await gotoAdmin(page)
    // Switch to Products tab explicitly
    await page.getByRole('button', { name: /aftermarket products|products/i }).click()
    await page.getByRole('button', { name: /add product/i }).click()
    await expectModalOpen(page)

    await page.getByLabel('Product Name').fill(productName)
    await page.getByLabel('Brand').fill('AcmeCo')
    await page.getByLabel('Category').fill('Protection')
    await page.getByLabel('Op Code').fill('EN3')
    await page.getByLabel('Cost').fill('10.00')
    await page.getByLabel('Unit Price').fill('25.00')
    await page.getByLabel('Part Number').fill('PN-TEST')
    await page.getByLabel('Description').fill('E2E created test product')

    await page.getByRole('button', { name: /create/i }).click()

    await expect(rowByText(page, productName)).toHaveCount(1)

    // Edit the product name
    await clickEditInRow(page, productName)
    await expectModalOpen(page)
    const productNameInput = page.getByLabel('Product Name')
    await productNameInput.fill(productNameUpdated)
    await page.getByRole('button', { name: /update/i }).click()

    await expect(rowByText(page, productNameUpdated)).toHaveCount(1)

    // Delete the product
    await clickDeleteInRow(page, productNameUpdated)
    await expect(rowByText(page, productNameUpdated)).toHaveCount(0)
  })
})
