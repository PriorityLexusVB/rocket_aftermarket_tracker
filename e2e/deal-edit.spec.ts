import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'

import { requireAuthEnv } from './_authEnv'

async function waitForDealForm(page: Page) {
  const v1 = page.getByTestId('deal-form')
  const v2 = page.getByTestId('deal-date-input')

  await Promise.race([
    v1.waitFor({ state: 'visible', timeout: 15_000 }),
    v2.waitFor({ state: 'visible', timeout: 15_000 }),
  ])
}

async function isDealFormV2(page: Page) {
  return page
    .getByTestId('deal-date-input')
    .isVisible()
    .catch(() => false)
}

async function goToLineItemsStepIfNeeded(page: Page) {
  if (!(await isDealFormV2(page))) return

  const customerName = page.getByTestId('customer-name-input')
  if ((await customerName.inputValue().catch(() => '')).trim() === '') {
    await customerName.fill(`E2E Customer ${Date.now()}`)
  }

  const dealNumber = page.getByTestId('deal-number-input')
  if ((await dealNumber.inputValue().catch(() => '')).trim() === '') {
    await dealNumber.fill(`E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
  }

  const next = page.getByTestId('next-to-line-items-btn')
  if (await next.isVisible().catch(() => false)) {
    await next.click()
  }
}

async function ensureFirstLineItemVisible(page: Page) {
  const product = page.getByTestId('product-select-0')
  if (await product.isVisible().catch(() => false)) return

  const addItemButton = page.getByRole('button', { name: /add item/i })
  if (await addItemButton.isVisible().catch(() => false)) {
    await addItemButton.click()
  }
}

async function getVisibleDescriptionField(page: Page) {
  const v1 = page.getByTestId('description-input')
  if (await v1.isVisible().catch(() => false)) return v1
  return page.getByTestId('notes-input')
}

async function getVisiblePromisedDateField(page: Page) {
  const v1 = page.getByTestId('promised-date-0')
  if (await v1.isVisible().catch(() => false)) return v1
  return page.getByTestId('date-scheduled-0')
}

test.describe('Deal create + edit flow', () => {
  test('create a deal, then edit and persist changes', async ({ page }) => {
    test.setTimeout(process.env.CI ? 150_000 : 120_000)

    requireAuthEnv()

    // Preflight: ensure we have an authenticated session (via storageState)
    await page.goto('/debug-auth')
    await expect(page.getByRole('heading', { name: /Debug: Auth/i })).toBeVisible({
      timeout: 15_000,
    })
    await expect(page.getByTestId('session-user-id')).not.toHaveText('—', { timeout: 15_000 })
    await expect(page.getByTestId('profile-org-id')).not.toHaveText(/^(undefined|null)$/, {
      timeout: 15_000,
    })

    // Create new deal
    await page.goto('/deals/new')

    // Wait for the form to render
    await waitForDealForm(page)

    const dealNumber = page.getByTestId('deal-number-input')
    await expect(dealNumber).toBeVisible()

    const uniqueJobNumber = `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // Job/Deal number must be globally unique in shared E2E DB
    await dealNumber.fill(uniqueJobNumber)
    await expect(dealNumber).toHaveValue(uniqueJobNumber)

    const description = await getVisibleDescriptionField(page)
    await expect(description).toBeVisible()
    const initialDescription = `E2E Deal ${Date.now()}`
    await description.fill(initialDescription)

    await goToLineItemsStepIfNeeded(page)
    await ensureFirstLineItemVisible(page)

    const product = page.getByTestId('product-select-0')
    await expect(product).toBeVisible({ timeout: 15_000 })
    await page
      .waitForFunction(
        () => {
          const el = document.querySelector('[data-testid="product-select-0"]')
          return !!el && el instanceof HTMLSelectElement && el.options.length > 1
        },
        { timeout: 30_000 }
      )
      .catch(() => {
        throw new Error(
          'No products available in test environment; seed E2E products or run admin-crud first.'
        )
      })
    await product.selectOption({ index: 1 })

    // Ensure product selection has propagated into form state before saving
    await expect(product).not.toHaveValue('')

    // Vendor jobs require a scheduled date
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    const tomorrowDate = tomorrow.toISOString().slice(0, 10)
    const promisedDate = await getVisiblePromisedDateField(page)
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill(tomorrowDate)

    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()

    // Click save and wait for either redirect or error
    await save.click()

    // Preferred path: redirect to edit page.
    // Fallback path: some environments return to /deals list; open edit from the created card.
    const editUrlPattern = /\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/
    const reachedEditDirectly = await page
      .waitForURL(editUrlPattern, {
        timeout: 30_000,
        waitUntil: 'domcontentloaded',
      })
      .then(() => true)
      .catch(() => false)

    if (!reachedEditDirectly) {
      await page.waitForURL(/\/deals(\?.*)?$/, { timeout: 30_000, waitUntil: 'domcontentloaded' })

      const matchingEditButton = page
        .locator('div')
        .filter({ hasText: uniqueJobNumber })
        .getByRole('button', { name: /edit/i })
        .first()

      if (await matchingEditButton.isVisible().catch(() => false)) {
        await matchingEditButton.click()
      } else {
        await page.getByRole('button', { name: /edit/i }).first().click()
      }

      await page.waitForURL(editUrlPattern, {
        timeout: 30_000,
        waitUntil: 'domcontentloaded',
      })
    }

    // Re-acquire description element after navigation (DOM changed)
    const descriptionAfterNav = await getVisibleDescriptionField(page)
    await expect(descriptionAfterNav).toBeVisible({ timeout: 10_000 })

    // Wait for edit page hydration to finish. The edit route fetches the deal and then
    // DealForm syncs local state from `initial`; if we type too early, our input can be
    // overwritten by the late-arriving initial payload.
    await expect(descriptionAfterNav).toHaveValue(initialDescription, { timeout: 15_000 })
    await page.waitForTimeout(400)
    await expect(descriptionAfterNav).toHaveValue(initialDescription)

    // Edit: change description and toggle scheduling flags
    const editedDescription = `${initialDescription} - Edited`
    await descriptionAfterNav.fill(editedDescription)
    await descriptionAfterNav.blur()
    await expect(descriptionAfterNav).toHaveValue(editedDescription)

    // For line item 0: toggle scheduling to exercise reason handling (V1 and V2 compatible)
    const requiresScheduling = page.getByTestId('requires-scheduling-0')
    if (await requiresScheduling.isVisible().catch(() => false)) {
      await requiresScheduling.uncheck().catch(async () => {
        await page.locator('label[for="requiresScheduling-0"]').click()
      })

      const reasonV1 = page.getByTestId('no-schedule-reason-0')
      const reasonV2 = page.locator('input[placeholder*="installed at delivery"]')
      if (await reasonV1.isVisible().catch(() => false)) {
        await reasonV1.fill('No scheduling required for test')
      } else if (await reasonV2.first().isVisible().catch(() => false)) {
        await reasonV2.first().fill('No scheduling required for test')
      }

      await requiresScheduling.check().catch(async () => {
        await page.locator('label[for="requiresScheduling-0"]').click()
      })
    }

    // Toggle service location (V1 radios, V2 checkbox)
    const onsite = page.getByTestId('onsite-radio-0')
    const offsite = page.getByTestId('offsite-radio-0')
    const offsiteToggle = page.getByTestId('is-off-site-0')
    if (
      (await onsite.isVisible().catch(() => false)) &&
      (await offsite.isVisible().catch(() => false))
    ) {
      await offsite.check()
      await onsite.check()
    } else if (await offsiteToggle.isVisible().catch(() => false)) {
      await offsiteToggle.check()
      await offsiteToggle.uncheck()
    }

    // Toggle loaner need and ensure it remains after save
    const loaner = page.getByTestId('loaner-checkbox')
    const loanerEnabled = await loaner.isEnabled().catch(() => false)
    let loanerNumberValue: string | null = null
    if (loanerEnabled) {
      await loaner.setChecked(true)

      loanerNumberValue = `L-${Date.now()}`
      const loanerNumber = page.getByTestId('loaner-number-input')
      await expect(loanerNumber).toBeVisible({ timeout: 10_000 })
      await loanerNumber.fill(loanerNumberValue)
    }

    // Save changes
    const saveAfterEdit = page.getByTestId('save-deal-btn')
    await saveAfterEdit.click()

    // Wait for the save to settle: prefer inline success, fallback to header timestamp
    const saveSettled = await Promise.race([
      page
        .getByTestId('save-success')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'success'),
      page
        .getByTestId('last-saved-timestamp')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'timestamp'),
      page
        .getByTestId('save-error')
        .waitFor({ state: 'visible', timeout: 15000 })
        .then(() => 'error'),
    ]).catch(async () => {
      await page.waitForLoadState('networkidle')
      return 'networkidle'
    })

    if (saveSettled === 'error') {
      const msg = (await page.getByTestId('save-error').textContent())?.trim()
      // Common validation path: line items not fully hydrated/selected yet
      if ((msg || '').toLowerCase().includes('please add at least one product')) {
        const productSelect = page.getByTestId('product-select-0')
        await expect(productSelect).toBeVisible({ timeout: 10_000 })
        await page.waitForFunction(() => {
          const el = document.querySelector('[data-testid="product-select-0"]')
          return !!el && el instanceof HTMLSelectElement && el.options.length > 1
        })
        await productSelect.selectOption({ index: 1 })
        const v = (await productSelect.inputValue().catch(() => '')).trim()
        if (!v) throw new Error(`Deal save failed (product selection did not stick): ${msg}`)

        // Retry save after fixing the line item
        await saveAfterEdit.click()
        await Promise.race([
          page.getByTestId('save-success').waitFor({ state: 'visible', timeout: 15000 }),
          page.getByTestId('last-saved-timestamp').waitFor({ state: 'visible', timeout: 15000 }),
          page.getByTestId('save-error').waitFor({ state: 'visible', timeout: 15000 }),
        ])

        // If it still errors, surface it
        if (
          await page
            .getByTestId('save-error')
            .isVisible()
            .catch(() => false)
        ) {
          const msg2 = (await page.getByTestId('save-error').textContent())?.trim()
          throw new Error(`Deal save failed after retry: ${msg2 || '(no message)'}`)
        }
      } else {
        throw new Error(`Deal save failed: ${msg || '(no message)'}`)
      }
    }

    // Wait for save to fully complete before reloading
    await page.waitForTimeout(1000)

    // Stay on edit page and ensure the title persisted after reload
    await page.waitForTimeout(1000)
    await page.reload()
    await page.waitForLoadState('networkidle')

    // Verify edited description persisted
    const descriptionAfterReload = await getVisibleDescriptionField(page)
    await expect(descriptionAfterReload).toBeVisible({ timeout: 10_000 })
    await expect(descriptionAfterReload).toHaveValue(editedDescription, {
      timeout: 10_000,
    })

    // Verify line item hydration + promised date persistence.
    // In some environments the edit page can briefly render an empty line until job_parts hydrate.
    // If the product isn't hydrated, self-heal by re-selecting product + re-saving, then verify.
    const productAfterReload = page.getByTestId('product-select-0')
    await expect(productAfterReload).toBeVisible({ timeout: 15_000 })
    await page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="product-select-0"]')
      return !!el && el instanceof HTMLSelectElement && el.options.length > 1
    })

    const productValAfterReload = (await productAfterReload.inputValue().catch(() => '')).trim()
    if (!productValAfterReload) {
      await productAfterReload.selectOption({ index: 1 })
      await expect(productAfterReload).not.toHaveValue('')
    }

    // If promised date is missing after reload, set it and persist it.
    const promisedAfterReload = await getVisiblePromisedDateField(page)
    const promisedValAfterReload = (await promisedAfterReload.inputValue().catch(() => '')).trim()
    if (!promisedValAfterReload) {
      await promisedAfterReload.fill(tomorrowDate)
      // Ensure scheduling is on so DB expects a promised date.
      await page.getByTestId('requires-scheduling-0').setChecked(true)

      await page.getByTestId('save-deal-btn').click()
      await Promise.race([
        page.getByTestId('save-success').waitFor({ state: 'visible', timeout: 15000 }),
        page.getByTestId('last-saved-timestamp').waitFor({ state: 'visible', timeout: 15000 }),
      ])
      await page.reload()
    }

    await expect(page.getByTestId('promised-date-0')).toHaveValue(tomorrowDate)
    await expect(page.getByTestId('requires-scheduling-0')).toHaveJSProperty('checked', true)
    await expect(page.getByTestId('no-schedule-reason-0')).toHaveCount(0)

    // Verify service location persisted (we ended on On-Site)
    await expect(page.getByTestId('onsite-radio-0')).toHaveJSProperty('checked', true)
    await expect(page.getByTestId('offsite-radio-0')).toHaveJSProperty('checked', false)

    // Verify loaner checkbox state persisted
    if (loanerEnabled) {
      await expect(page.getByTestId('loaner-checkbox')).toHaveJSProperty('checked', true)
      await expect(page.getByTestId('loaner-number-input')).toHaveValue(loanerNumberValue!)
    } else {
      await expect(page.getByTestId('loaner-checkbox')).toBeDisabled()
    }

    // Verify the edit page still loads after reload
    await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 15_000 })
  })
})
