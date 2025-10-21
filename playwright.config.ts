import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  retries: 0,
  fullyParallel: false,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: './e2e/storageState.json',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // If our dev server script is not "dev", detect and adjust to the correct one (e.g., "start").
  webServer: {
    command: 'npm run dev || npm run start',
    port: 5173,
    reuseExistingServer: !process.env.CI,
  },
  globalSetup: require.resolve('./global.setup.ts'),
})
