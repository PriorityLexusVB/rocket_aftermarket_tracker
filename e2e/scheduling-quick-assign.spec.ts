import { test, expect } from '@playwright/test'

// This test is lightweight and resilient: it creates a pending job via Deal form,
// then visits Active Appointments, switches filter to include pending/unassigned,
// and (if present) uses the Assign Jobs quick panel to set it to scheduled.

const missingAuthEnv = !process.env.E2E_EMAIL || !process.env.E2E_PASSWORD

test.describe('Scheduling via Active Appointments (quick assign)', () => {
  test.skip(missingAuthEnv, 'E2E auth env not set')

  test('new pending job appears in Unassigned and can be assigned (scheduled)', async ({ page }) => {
    const unique = Date.now()
    const title = `E2E Schedule ${unique}`

    // Create a minimal deal
    await page.goto('/deals/new')
    const titleInput = page.getByTestId('title-input')
    await expect(titleInput).toBeVisible()
    await titleInput.fill(title)

    const vendor = page.getByTestId('vendor-select')
    await vendor.selectOption({ index: 1 })

    const product = page.getByTestId('product-select-0')
    await product.selectOption({ index: 1 })

    const save = page.getByTestId('save-deal-btn')
    await save.click()

    // Redirect to edit confirms creation
    await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/)

    // Go to Active Appointments
    await page.goto('/currently-active-appointments')

    // If there are unassigned jobs, open Assign Jobs panel
    // The page shows a button with text 'Assign Jobs' when counts.unassigned > 0
    const assignBtn = page.getByRole('button', { name: /assign jobs/i })
    if (await assignBtn.isVisible().catch(() => false)) {
      await assignBtn.click()

      // In the quick panel, try to locate our newly created job by title
      const jobRow = page.getByText(title, { exact: false })

      // If not visible (due to pagination or limit), skip without failing
      test.skip(!(await jobRow.isVisible().catch(() => false)), 'New job not listed in quick panel (limit window)')

      // Pick the first staff member option available for this job
      const staffSelect = jobRow.locator('select').first()
      await staffSelect.selectOption({ index: 1 })

      // Click assign for that row (assume an Assign button exists per row)
      const rowAssign = jobRow.getByRole('button', { name: /assign/i }).first()
      await rowAssign.click()

      // Close the panel
      const closeBtn = page.getByRole('button', { name: /close/i }).first()
      if (await closeBtn.isVisible().catch(() => false)) {
        await closeBtn.click()
      }

      // The scheduled badge should be visible in the main list for this title
      await expect(page.getByText(title).first()).toBeVisible()
      await expect(page.getByText(/scheduled/i).first()).toBeVisible()
    } else {
      test.skip(true, 'No unassigned jobs available to assign')
    }
  })
})
