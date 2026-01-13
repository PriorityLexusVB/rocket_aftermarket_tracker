import { defineConfig, devices } from '@playwright/test'
// Load env vars from .env.local/.env so Playwright tests (and globalSetup) can access E2E_EMAIL/E2E_PASSWORD
import dotenv from 'dotenv'
import { existsSync } from 'fs'
import path from 'path'

try {
  // Prefer an explicit local E2E env file (never commit secrets).
  // Use override=true so a developer can keep prod-ish settings in .env.local
  // while running Playwright against a dedicated E2E project.
  const e2eEnvPath = path.resolve(process.cwd(), '.env.e2e.local')
  const hasE2eEnv = existsSync(e2eEnvPath)
  if (hasE2eEnv) {
    dotenv.config({ path: e2eEnvPath, override: true })
  } else {
    // Fallbacks for older local setups.
    const envFiles = ['.env.local', '.env']
    for (const f of envFiles) {
      const p = path.resolve(process.cwd(), f)
      if (existsSync(p)) dotenv.config({ path: p, override: false })
    }
  }
} catch {}

// Ensure the Playwright runner process itself has required env vars.
// Note: webServer.env only applies to the spawned dev server process; globalSetup/tests run in this process.
//
// IMPORTANT: Do NOT default Supabase credentials here.
// If these are missing, it is safer to fail fast than to accidentally run E2E against a real environment.
// Prefer IPv4 loopback in CI to avoid ::1/IPv6 resolution issues.
// Use a dedicated port for E2E to avoid accidentally reusing some other app's dev server.
const DEFAULT_BASE_URL = 'http://127.0.0.1:5174'
const PROD_REF = 'ogjtmtndgiqqdtwatsue'

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

if (supabaseUrl.includes(PROD_REF)) {
  throw new Error(
    `[playwright.config] Refusing to run E2E against production Supabase (VITE_SUPABASE_URL contains ${PROD_REF}).`
  )
}

const possibleDbUrl =
  process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || process.env.SUPABASE_DB_URL
if (possibleDbUrl && possibleDbUrl.includes(PROD_REF)) {
  throw new Error(
    `[playwright.config] Refusing to run E2E seeding/helpers against production Supabase (DATABASE_URL contains ${PROD_REF}).`
  )
}

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
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? DEFAULT_BASE_URL,
    trace: process.env.CI ? 'on' : 'on-first-retry', // Always capture traces in CI
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    storageState: './e2e/storageState.json',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // If our dev server script is not "dev", detect and adjust to the correct one (e.g., "start").
  webServer: {
    // Launch a fresh Vite dev server with explicit env vars so no .env.local is required in CI/agent
    // Bind to IPv4 to avoid localhost resolving to ::1 in CI.
    // Use `pnpm exec vite` so Vite receives flags directly (no extra `--` that can cause it to ignore --port).
    command: 'pnpm exec vite --host 127.0.0.1 --port 5174 --strictPort',
    port: 5174,
    // CI runners can be slow to install deps + boot Vite (and Playwright will kill the server if it times out).
    timeout: process.env.CI ? 120_000 : 60_000,
    // IMPORTANT: Never reuse an existing server locally.
    // If another app is running on this port, reusing it can lead to debugging the wrong project
    // (e.g., unexpected Firebase logs from a different codebase).
    reuseExistingServer: false,
    // Surface server output in CI logs for diagnosing startup crashes (e.g., ERR_HTTP_HEADERS_SENT).
    stdout: 'pipe',
    stderr: 'pipe',
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
