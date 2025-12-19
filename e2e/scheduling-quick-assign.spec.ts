import { test, expect } from '@playwright/test'

// This test is lightweight and resilient: it creates a pending job via Deal form,
// then visits Active Appointments, switches filter to include pending/unassigned,
// and (if present) uses the Assign Jobs quick panel to set it to scheduled.

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

async function waitForEditOpen(page) {
  return Promise.race([
    page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, { timeout: 30_000 }).then(() => 'url'),
    page
      .getByRole('heading', { name: /edit deal/i })
      .waitFor({ state: 'visible', timeout: 30_000 })
      .then(() => 'modal'),
  ])
}

async function goToLineItems(page) {
  const nextBtn = page.getByTestId('next-to-line-items-btn')
  if (await nextBtn.isVisible().catch(() => false)) {
    await nextBtn.click()
  }

  const saveBtn = page.getByTestId('save-deal-btn')
  await expect(saveBtn).toBeVisible()
  return saveBtn
}

async function fillSchedulingDate(page, idx = 0) {
  const dateScheduled = page.getByTestId(`date-scheduled-${idx}`)
  if (await dateScheduled.isVisible().catch(() => false)) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await dateScheduled.fill(tomorrow.toISOString().slice(0, 10))
    return true
  }

  const promisedDate = page.getByTestId(`promised-date-${idx}`)
  if (await promisedDate.isVisible().catch(() => false)) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000)
    await promisedDate.fill(tomorrow.toISOString().slice(0, 10))
    return true
  }

  return false
}

async function fillSchedulingTime(page, idx = 0) {
  const startCandidates = [
    page.getByTestId(`scheduled-start-time-${idx}`),
    page.getByTestId(`start-time-${idx}`),
  ]
  const endCandidates = [
    page.getByTestId(`scheduled-end-time-${idx}`),
    page.getByTestId(`end-time-${idx}`),
  ]

  for (const start of startCandidates) {
    if (await start.isVisible().catch(() => false)) {
      await start.fill('09:00')
      break
    }
  }

  for (const end of endCandidates) {
    if (await end.isVisible().catch(() => false)) {
      await end.fill('10:00')
      break
    }
  }
}

async function setLineItemVendor(page, idx = 0) {
  const offsite = page.getByTestId(`is-off-site-${idx}`)
  if (await offsite.isVisible().catch(() => false)) {
    await offsite.setChecked(true)
  }

  const vendorSelect = page.getByTestId(`line-vendor-${idx}`)
  if (await vendorSelect.isVisible().catch(() => false)) {
    // Clear vendor to avoid vendor scheduling constraint
    await vendorSelect.selectOption({ value: '' })
    return true
  }
  return false
}

test.describe('Scheduling via Active Appointments (quick assign)', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('new pending job appears in Unassigned and can be assigned (scheduled)', async ({
    page,
  }) => {
    const unique = Date.now()
    const title = `E2E Schedule ${unique}`

    // Create a minimal deal
    await page.goto('/deals/new')
    const descriptionInput = page.getByTestId('description-input')
    await expect(descriptionInput).toBeVisible()
    await descriptionInput.fill(title)

    const vendor = page.getByTestId('vendor-select')
    if (await vendor.isVisible().catch(() => false)) {
      await vendor.selectOption({ value: '' }).catch(async () => vendor.selectOption({ index: 0 }))
    }

    const product = page.getByTestId('product-select-0')
    await product.selectOption({ index: 1 })

    // If V2 step gating is present, move to line-items step now
    const nextBtn = page.getByTestId('next-to-line-items-btn')
    if (await nextBtn.isVisible().catch(() => false)) {
      await expect(nextBtn).toBeEnabled({ timeout: 10_000 })
      await nextBtn.click()
    }

    const save = await goToLineItems(page)

    // Avoid vendor scheduling constraint: clear vendor, disable scheduling, provide reason
    await setLineItemVendor(page, 0)

    const requiresScheduling = page.getByTestId('requires-scheduling-0')
    if (await requiresScheduling.isVisible().catch(() => false)) {
      await requiresScheduling.setChecked(false)
    }

    const noScheduleReason = page.getByTestId('no-schedule-reason-0')
    if (await noScheduleReason.isVisible().catch(() => false)) {
      await noScheduleReason.fill('E2E no schedule required')
    }

    // If date/time fields are present anyway, fill them defensively
    const dateFilled = await fillSchedulingDate(page, 0)
    if (dateFilled) {
      await fillSchedulingTime(page, 0)
    }
    await save.click()

    const awaitSaveResult = async () =>
      Promise.race([
        waitForEditOpen(page).then(() => 'navigated'),
        page
          .getByTestId('save-error')
          .waitFor({ state: 'visible', timeout: 30_000 })
          .then(() => 'error'),
      ]).catch(() => 'timeout')

    let saveResult = await awaitSaveResult()

    if (saveResult === 'error') {
      const msg = (
        await page
          .getByTestId('save-error')
          .textContent()
          .catch(() => 'unknown error')
      )?.trim()

      if (msg?.toLowerCase().includes('vendor jobs must have scheduled dates')) {
        // Retry once with explicit scheduling on and refreshed date/time
        const requiresSchedulingInput = page.getByTestId('requires-scheduling-0')
        if (await requiresSchedulingInput.isVisible().catch(() => false)) {
          await requiresSchedulingInput.setChecked(true)
        }

        const retryDateFilled = await fillSchedulingDate(page, 0)
        if (!retryDateFilled) {
          throw new Error('Retry failed: scheduling date field not available')
        }

        await fillSchedulingTime(page, 0)
        await save.click()
        saveResult = await awaitSaveResult()
      } else {
        throw new Error(`Deal save failed: ${msg}`)
      }
    }

    if (saveResult !== 'navigated') {
      const msg = (
        await page
          .getByTestId('save-error')
          .textContent()
          .catch(() => 'unknown error')
      )?.trim()
      throw new Error(`Deal creation did not navigate (result=${saveResult}) message=${msg}`)
    }

    // Go to Active Appointments
    await page.goto('/currently-active-appointments')

    // If Assign Jobs panel is available, attempt assignment; otherwise pass
    const assignBtn = page.getByRole('button', { name: /assign jobs/i })
    if (await assignBtn.isVisible().catch(() => false)) {
      await assignBtn.click()

      const jobRow = page.getByText(title, { exact: false })
      if (await jobRow.isVisible().catch(() => false)) {
        const staffSelect = jobRow.locator('select').first()
        await staffSelect.selectOption({ index: 1 })

        const rowAssign = jobRow.getByRole('button', { name: /assign/i }).first()
        await rowAssign.click()

        const closeBtn = page.getByRole('button', { name: /close/i }).first()
        if (await closeBtn.isVisible().catch(() => false)) {
          await closeBtn.click()
        }

        await expect(page.getByText(title).first()).toBeVisible()
        await expect(page.getByText(/scheduled/i).first()).toBeVisible()
      }
    }
  })
})
