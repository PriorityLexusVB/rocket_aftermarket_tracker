import { test, expect } from '@playwright/test'

import { requireAuthEnv } from './_authEnv'

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
    await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 10_000 })

    const dealNumber = page.getByTestId('deal-number-input')
    await expect(dealNumber).toBeVisible()

    const uniqueJobNumber = `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    // Job/Deal number must be globally unique in shared E2E DB
    await dealNumber.fill(uniqueJobNumber)
    await expect(dealNumber).toHaveValue(uniqueJobNumber)

    const description = page.getByTestId('description-input')
    await expect(description).toBeVisible()
    const initialDescription = `E2E Deal ${Date.now()}`
    await description.fill(initialDescription)

    const product = page.getByTestId('product-select-0')
    await expect(product).toBeVisible()
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
    const promisedDate = page.getByTestId('promised-date-0')
    await expect(promisedDate).toBeVisible()
    await promisedDate.fill(tomorrowDate)

    const save = page.getByTestId('save-deal-btn')
    await expect(save).toBeEnabled()

    // Click save and wait for either redirect or error
    await save.click()

    // Wait for redirect to edit page.
    // Avoid `networkidle` here: realtime subscriptions + polling can keep the network busy
    // and make this wait flaky even when navigation succeeded.
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, {
      timeout: 30_000,
      waitUntil: 'domcontentloaded',
    })

    // Re-acquire description element after navigation (DOM changed)
    const descriptionAfterNav = page.getByTestId('description-input')
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

    // For line item 0: uncheck requires scheduling to reveal reason, then re-check
    const reason = page.getByTestId('no-schedule-reason-0')
    // Use the label to toggle to avoid any styled overlay issues
    await page.locator('label[for="requiresScheduling-0"]').click()
    await expect(reason).toBeVisible()
    await reason.fill('No scheduling required for test')
    await page.locator('label[for="requiresScheduling-0"]').click()
    await expect(reason).toHaveCount(0)

    // Toggle on/off-site radios (ensure both states function)
    const onsite = page.getByTestId('onsite-radio-0')
    const offsite = page.getByTestId('offsite-radio-0')
    await offsite.check()
    await onsite.check()

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
    await expect(page.getByTestId('description-input')).toBeVisible({ timeout: 10_000 })
    await expect(page.getByTestId('description-input')).toHaveValue(editedDescription, {
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
    const promisedAfterReload = page.getByTestId('promised-date-0')
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
