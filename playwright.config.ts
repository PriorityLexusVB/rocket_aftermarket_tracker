import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 30_000,
  retries: process.env.CI ? 2 : 0,
  fullyParallel: true,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: 'storageState.json',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // If our dev server script is not "dev", detect and adjust to the correct one (e.g., "start").
  webServer: {
    command: 'npm run dev || npm run start',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  globalSetup: require.resolve('./tests/e2e/global.setup.ts'),
})
