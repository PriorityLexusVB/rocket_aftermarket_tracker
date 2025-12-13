import { defineConfig, devices } from '@playwright/test'
// Load env vars from .env.local/.env so Playwright tests (and globalSetup) can access E2E_EMAIL/E2E_PASSWORD
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import path from 'path'

try {
  const envFiles = ['.env.local', '.env']
  for (const f of envFiles) {
    const p = path.resolve(process.cwd(), f)
    if (existsSync(p)) dotenv.config({ path: p })
  }
} catch {}

export default defineConfig({
  testDir: './e2e',
  timeout: process.env.CI ? 45_000 : 30_000, // Longer timeout in CI for slower environments
  retries: process.env.CI ? 1 : 0, // Retry once in CI to handle flaky tests
  fullyParallel: false,
  // Stabilize defaults in CI while allowing local override via PLAYWRIGHT_WORKERS
  workers: process.env.PLAYWRIGHT_WORKERS
    ? Number(process.env.PLAYWRIGHT_WORKERS)
    : process.env.CI
      ? 1
      : undefined,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:5173',
    trace: process.env.CI ? 'on' : 'on-first-retry', // Always capture traces in CI
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: './e2e/storageState.json',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // If our dev server script is not "dev", detect and adjust to the correct one (e.g., "start").
  webServer: {
    // Launch a fresh Vite dev server with explicit env vars so no .env.local is required in CI/agent
    command: 'npm run start -- --port 5173',
    port: 5173,
    reuseExistingServer: false,
    env: {
      // Supabase client for the SPA
      VITE_SUPABASE_URL:
        process.env.VITE_SUPABASE_URL || 'https://ogjtmtndgiqqdtwatsue.supabase.co',
      VITE_SUPABASE_ANON_KEY:
        process.env.VITE_SUPABASE_ANON_KEY ||
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9nanRtdG5kZ2lxcWR0d2F0c3VlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg1NTE5OTcsImV4cCI6MjA3NDEyNzk5N30.n17KiM5c08XuKY-W9fL667VsVWABwzGmJpxVieSgcX4',
      VITE_ORG_SCOPED_DROPDOWNS: process.env.VITE_ORG_SCOPED_DROPDOWNS || 'true',
      VITE_SIMPLE_CALENDAR: process.env.VITE_SIMPLE_CALENDAR || 'true',
      VITE_DEAL_FORM_V2: process.env.VITE_DEAL_FORM_V2 || 'true',
      // E2E config for global.setup
      PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:5173',
      E2E_EMAIL: process.env.E2E_EMAIL || 'rob.brasco@priorityautomotive.com',
      E2E_PASSWORD: process.env.E2E_PASSWORD || 'Rocket123!',
    },
  },
  globalSetup: './global.setup.ts',
})
