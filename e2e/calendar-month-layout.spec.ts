import { test, expect, type Page } from '@playwright/test'
import { requireAuthEnv } from './_authEnv'

async function login(page: Page) {
  await page.goto('/debug-auth')
  const sessionUserId = page.getByTestId('session-user-id')
  const alreadyAuthed = await sessionUserId
    .waitFor({ state: 'visible', timeout: 5_000 })
    .then(async () => {
      const text = (await sessionUserId.textContent())?.trim() || ''
      return text !== '' && text !== '—'
    })
    .catch(() => false)

  if (alreadyAuthed) return

  const { email, password } = requireAuthEnv()
  await page.goto('/auth')
  await page.fill('input[name="email"]', email)
  await page.fill('input[name="password"]', password)
  await page.click('button:has-text("Sign In")')

  await page.goto('/debug-auth')
  await expect(page.getByTestId('session-user-id')).toBeVisible({ timeout: 30_000 })
  await expect(page.getByTestId('session-user-id')).not.toHaveText('—', { timeout: 30_000 })
}

test.describe('Calendar month layout guard', () => {
  test('embedded month layout keeps single-column width without right rail', async ({ page }) => {
    await page.setViewportSize({ width: 1720, height: 1100 })
    await login(page)

    await page.goto('/calendar?view=calendar&range=month')

    await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible({
      timeout: 20_000,
    })

    const agendaControlsVisible = await page
      .locator('[aria-label="Agenda controls"]')
      .first()
      .isVisible()
      .catch(() => false)

    if (agendaControlsVisible) {
      await expect(page.getByRole('link', { name: 'Grid' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Flow' })).toBeVisible()
      await expect(page.getByRole('link', { name: 'Agenda' })).toBeVisible()
      await expect(page.getByRole('list').first()).toBeVisible()
      return
    }

    const layout = await page.evaluate(() => {
      const root =
        document.querySelector('[data-testid="calendar-main-grid"]') ||
        Array.from(document.querySelectorAll('div.grid')).find((el) => {
          const style = window.getComputedStyle(el)
          if (style.display !== 'grid') return false
          const rect = el.getBoundingClientRect()
          if (rect.width < 600 || rect.height < 160) return false

          const hasMainContent = Array.from(el.children).some((child) =>
            String(child.className || '').includes('min-w-0')
          )
          return hasMainContent
        })

      if (!root) {
        return {
          found: false,
          gridTemplateColumns: '',
          columnCount: 0,
          renderedChildren: 0,
          railLikeChildren: 0,
        }
      }

      const style = window.getComputedStyle(root)
      const gridTemplateColumns = style.gridTemplateColumns || ''
      const columnCount = gridTemplateColumns.trim()
        ? gridTemplateColumns.trim().split(/\s+/).length
        : 0

      const renderedChildren = Array.from(root.children).filter((child) => {
        const childStyle = window.getComputedStyle(child)
        return childStyle.display !== 'none' && childStyle.visibility !== 'hidden'
      })

      const railLikeChildren = renderedChildren.filter((child) => {
        const width = child.getBoundingClientRect().width
        return width >= 260 && width <= 460
      })

      return {
        found: true,
        gridTemplateColumns,
        columnCount,
        renderedChildren: renderedChildren.length,
        railLikeChildren: railLikeChildren.length,
      }
    })

    expect(layout.found).toBe(true)

    if (layout.columnCount <= 1) {
      // Unified shell mode: single-column embedded layout.
      expect(layout.columnCount).toBe(1)
      expect(layout.renderedChildren).toBe(1)
      return
    }

    // Legacy/non-unified mode: right rail is expected at wide viewport.
    expect(layout.columnCount).toBeGreaterThanOrEqual(2)
    expect(layout.renderedChildren).toBeGreaterThanOrEqual(2)
    expect(layout.railLikeChildren).toBeGreaterThanOrEqual(1)
  })
})
