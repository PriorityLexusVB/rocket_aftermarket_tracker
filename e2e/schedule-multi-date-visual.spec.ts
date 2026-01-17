import { test, expect } from '@playwright/test'

import { requireAuthEnv } from './_authEnv'

test.describe('Schedule multi-date promise-only (visual + correctness)', () => {
  test.describe.configure({ mode: 'serial' })

  const runVisual = process.env.E2E_VISUAL === '1'
  test.skip(!runVisual, 'Set E2E_VISUAL=1 to run this on-demand visual QA spec.')

  const viewports = [
    { name: 'iphone-pro', width: 390, height: 844 },
    { name: 'ipad-pro', width: 1024, height: 1366 },
    { name: 'desktop', width: 1440, height: 900 },
  ] as const

  for (const vp of viewports) {
    test.describe(vp.name, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } })

      test('renders one entry per promised date across calendar + agenda', async ({ page }) => {
        test.setTimeout(process.env.CI ? 180_000 : 150_000)

        requireAuthEnv()

        // Preflight: ensure we have an authenticated session (via storageState)
        await page.goto('/debug-auth')
        await expect(page.getByRole('heading', { name: /Debug: Auth/i })).toBeVisible({
          timeout: 15_000,
        })
        await expect(page.getByTestId('session-user-id')).not.toHaveText('—', { timeout: 15_000 })

        // Create a deal with TWO line items, each with a different promised date.
        await page.goto('/deals/new')
        await expect(page.getByTestId('deal-form')).toBeVisible({ timeout: 10_000 })

        const descriptionText = `E2E MultiDate ${vp.name} ${Date.now()}`
        await page.getByTestId('description-input').fill(descriptionText)

        // Add a second line item
        const addLineItem = page.getByTestId('add-line-item-btn')
        await expect(addLineItem).toBeEnabled()
        await addLineItem.click()

        // Wait for products to be available for both rows.
        // Use different products to avoid unique constraint collisions in some environments.
        for (const i of [0, 1] as const) {
          const product = page.getByTestId(`product-select-${i}`)
          await expect(product).toBeVisible({ timeout: 15_000 })
          const optionCount: number = await page
            .waitForFunction(
              (idx) => {
                const el = document.querySelector(`[data-testid="product-select-${idx}"]`)
                return !!el && el instanceof HTMLSelectElement && el.options.length > 1
              },
              i,
              { timeout: 30_000 }
            )
            .then(async () => {
              return await page.evaluate((idx) => {
                const el = document.querySelector(`[data-testid="product-select-${idx}"]`)
                if (!el || !(el instanceof HTMLSelectElement)) return 0
                return el.options.length
              }, i)
            })
            .catch(() => {
              throw new Error(
                'No products available in test environment; seed E2E products or run admin-crud first.'
              )
            })

          // index 0 is placeholder; pick 1 for first item, 2 for second when available.
          const desiredIndex = i === 0 ? 1 : 2
          if (i === 1 && optionCount < 3) {
            throw new Error(
              `Need at least 2 real products for multi-line-item test (options=${optionCount}). Seed another product or run admin-crud.`
            )
          }
          await product.selectOption({ index: desiredIndex })
          await expect(product).not.toHaveValue('')

          // Ensure requires scheduling is on (promise-only path)
          const requiresScheduling = page.getByTestId(`requires-scheduling-${i}`)
          if (await requiresScheduling.isVisible().catch(() => false)) {
            await requiresScheduling.setChecked(true)
          }

          // Mark off-site if present (some environments gate this UI)
          const offsite = page.getByTestId(`offsite-radio-${i}`)
          if (await offsite.isVisible().catch(() => false)) {
            await offsite.check().catch(async () => {
              await offsite.click()
            })
          }
        }

        const d0 = new Date(Date.now() + 24 * 60 * 60 * 1000)
        const d1 = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
        const date0 = d0.toISOString().slice(0, 10)
        const date1 = d1.toISOString().slice(0, 10)

        await page.getByTestId('promised-date-0').fill(date0)
        await page.getByTestId('promised-date-1').fill(date1)

        const save = page.getByTestId('save-deal-btn')
        await expect(save).toBeEnabled()
        await save.click()

        await page.waitForURL(/\/deals\/[A-Za-z0-9-]+\/edit(\?.*)?$/, {
          timeout: 30_000,
          waitUntil: 'domcontentloaded',
        })

        const url = new URL(page.url())
        const match = url.pathname.match(/\/deals\/([A-Za-z0-9-]+)\/edit/)
        const jobId = match?.[1]
        if (!jobId) throw new Error(`Unable to determine job id after create. URL=${page.url()}`)

        // Calendar Day view should show the same deal on EACH promised date
        for (const date of [date0, date1]) {
          await page.goto(`/calendar/grid?view=day&date=${encodeURIComponent(date)}`)
          await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible({
            timeout: 20_000,
          })

          // Expect at least one card for our created deal on this date.
          await expect(page.locator(`text=${descriptionText}`).first()).toBeVisible({
            timeout: 20_000,
          })
          // Status/time text may appear multiple times on the page; assert at least one is visible.
          // Product semantics: promised/no-time work is treated as Scheduled (All-day) rather than Pending.
          await expect(page.getByText(/SCHEDULED/i).first()).toBeVisible({ timeout: 20_000 })
          await expect(page.getByText(/All day|Time TBD/i).first()).toBeVisible({ timeout: 20_000 })

          await test.info().attach(`${vp.name}-calendar-day-${date}.png`, {
            body: await page.screenshot({ fullPage: true }),
            contentType: 'image/png',
          })
        }

        // Agenda should be able to show BOTH occurrences (one per promised date)
        await page.goto(`/calendar/agenda?focus=${encodeURIComponent(jobId)}`)
        await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible({
          timeout: 20_000,
        })
        await expect(page.locator('header[aria-label="Agenda controls"]')).toContainText('Agenda')

        const occurrences = page.locator(`text=${descriptionText}`)
        await expect(occurrences).toHaveCount(2, { timeout: 30_000 })

        await test.info().attach(`${vp.name}-agenda.png`, {
          body: await page.screenshot({ fullPage: true }),
          contentType: 'image/png',
        })
      })
    })
  }
})
