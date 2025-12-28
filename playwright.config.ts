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

// Ensure the Playwright runner process itself has required env vars.
// Note: webServer.env only applies to the spawned dev server process; globalSetup/tests run in this process.
//
// IMPORTANT: Do NOT default Supabase credentials here.
// If these are missing, it is safer to fail fast than to accidentally run E2E against a real environment.
const DEFAULT_BASE_URL = 'http://localhost:5173'

process.env.PLAYWRIGHT_BASE_URL ||= DEFAULT_BASE_URL

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `[playwright.config] Missing required env var: ${name}. ` +
        `Refusing to run E2E without explicit Supabase config.`
    )
  }
  return value
}

const supabaseUrl = requireEnv('VITE_SUPABASE_URL')
const supabaseAnonKey = requireEnv('VITE_SUPABASE_ANON_KEY')

// Do not set default E2E credentials here.
// In CI (especially for forked PRs), secrets are not available; using hardcoded
// credentials causes E2E to attempt login and fail. When E2E_EMAIL/E2E_PASSWORD
// are not explicitly set, globalSetup and tests will skip auth-dependent flows.

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
      : 1,
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
    command: 'pnpm start -- --port 5173',
    port: 5173,
    reuseExistingServer: !process.env.CI, // Avoid stale state in CI but allow reuse locally
    env: {
      // Supabase client for the SPA (guaranteed to exist due to validation above)
      VITE_SUPABASE_URL: supabaseUrl,
      VITE_SUPABASE_ANON_KEY: supabaseAnonKey,
      VITE_ORG_SCOPED_DROPDOWNS: process.env.VITE_ORG_SCOPED_DROPDOWNS || 'true',
      VITE_SIMPLE_CALENDAR: process.env.VITE_SIMPLE_CALENDAR || 'true',
      VITE_DEAL_FORM_V2: process.env.VITE_DEAL_FORM_V2 || 'true',
      VITE_ACTIVE_SNAPSHOT: process.env.VITE_ACTIVE_SNAPSHOT || 'true',
      // E2E config for global.setup (guaranteed to exist due to default assignment above)
      PLAYWRIGHT_BASE_URL: process.env.PLAYWRIGHT_BASE_URL || DEFAULT_BASE_URL,
      E2E_EMAIL: process.env.E2E_EMAIL || '',
      E2E_PASSWORD: process.env.E2E_PASSWORD || '',
    },
  },
  globalSetup: './global.setup.ts',
})
