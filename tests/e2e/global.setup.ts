import { chromium } from '@playwright/test'

export default async function globalSetup() {
  const browser = await chromium.launch()
  const page = await browser.newPage()

  const base = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:5174'
  await page.goto(base)

  const loggedIn = await page
    .locator('[data-testid="org-badge"], [data-testid="session-user-id"]')
    .first()
    .isVisible()
    .catch(() => false)

  if (!loggedIn) {
    const hasSignInButton = await page
      .getByRole('button', { name: /sign in|log in/i })
      .first()
      .isVisible()
      .catch(() => false)

    if (hasSignInButton) {
      await page
        .getByRole('button', { name: /sign in|log in/i })
        .first()
        .click()
    } else {
      await page.goto(base + '/login')
    }

    const email = page.getByLabel(/email/i).or(page.getByPlaceholder(/email/i))
    const pass = page.getByLabel(/password/i).or(page.getByPlaceholder(/password/i))
    await email.fill(process.env.E2E_EMAIL!)
    await pass.fill(process.env.E2E_PASSWORD!)

    const submit = page.getByRole('button', { name: /continue|sign in|log in/i }).first()
    await submit.click()

    await page.waitForLoadState('networkidle')
  }

  await page.context().storageState({ path: 'e2e/storageState.json' })
  await browser.close()
}
