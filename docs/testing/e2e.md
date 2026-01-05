# E2E Testing with Playwright

This document describes how to run end-to-end (E2E) tests locally and in CI for the Rocket Aftermarket Tracker application.

## Prerequisites

- **Node.js 20** (pinned via `.nvmrc`)
- **pnpm** (version specified in `package.json` via `packageManager` field)
- Supabase credentials (for auth and API access)
- E2E test user credentials

## Required Environment Variables

The following environment variables are required for E2E tests to run successfully:

| Variable                 | Description                                           | Required for   |
| ------------------------ | ----------------------------------------------------- | -------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL                                  | App runtime    |
| `VITE_SUPABASE_ANON_KEY` | Supabase anonymous/public key                         | App runtime    |
| `E2E_EMAIL`              | Email address for E2E test user                       | Authentication |
| `E2E_PASSWORD`           | Password for E2E test user                            | Authentication |
| `PLAYWRIGHT_BASE_URL`    | Base URL for tests (default: `http://localhost:5173`) | Test execution |

Notes:

- Playwright prefers `.env.e2e.local` (if present) and will override values from `.env.local`.
- `VITE_ORG_SCOPED_DROPDOWNS` is deprecated/ignored by the app (safe to omit). The Playwright web server currently sets it, but it does not change behavior.

## Running E2E Tests Locally

### 1. Install Dependencies

```bash
pnpm install --frozen-lockfile
```

### 2. Install Playwright Browsers

```bash
pnpm exec playwright install --with-deps
```

### 3. Set Environment Variables

Create a `.env.e2e.local` file in the project root (preferred) or export environment variables:

```bash
export VITE_SUPABASE_URL="your-supabase-url"
export VITE_SUPABASE_ANON_KEY="your-supabase-anon-key"
export E2E_EMAIL="test-user@example.com"
export E2E_PASSWORD="your-test-password"
```

### 4. Run Tests

```bash
# List discovered tests (use this when "No tests found" is suspected)
pnpm exec playwright test --list

# Run all E2E tests
pnpm e2e

# Run with UI mode for debugging
pnpm e2e:ui

# Run with step-by-step debug mode
pnpm e2e:debug
```

## CI/GitHub Actions Configuration

The E2E tests run via the `.github/workflows/e2e.yml` workflow with two jobs:

### Smoke Tests (PR)

- Runs on pull requests to `main`
- Executes a subset of critical tests for faster feedback
- **Skips gracefully** when secrets are not available (e.g., external PRs)

### Full Tests (Main Branch)

- Runs on pushes to `main` and manual workflow dispatch
- Executes the complete E2E test suite
- **Fails** if required secrets are missing

### Required GitHub Secrets

Add these secrets to your repository settings:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `E2E_EMAIL`
- `E2E_PASSWORD`

## Common Issues and Troubleshooting

### "require is not defined in ES module scope"

**Cause**: The repo uses `"type": "module"` in `package.json` (ESM), but code is using CommonJS patterns like `require()` or `__dirname`.

**Solution**: Use ESM-compatible imports. For `__dirname`:

```typescript
import { fileURLToPath } from 'url'
import path from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
```

### Missing Environment Variables

**Symptom**: Tests fail with "Missing E2E_EMAIL/E2E_PASSWORD" or similar errors.

**Solution**: Ensure all required environment variables are set. In CI, check that GitHub secrets are properly configured and passed to the workflow steps.

### Storage State Not Found

**Symptom**: Tests fail because `e2e/storageState.json` doesn't exist.

**Solution**: The `global.setup.ts` file handles authentication and creates the storage state file automatically. If login fails, check:

1. `E2E_EMAIL` and `E2E_PASSWORD` are correct
2. The test user exists in Supabase
3. The auth page selectors match the current UI

If you changed credentials or the file is stale/corrupted:

1. Delete `e2e/storageState.json`
2. Re-run `pnpm e2e`

### Port Conflicts

**Symptom**: Tests fail because the dev server can't start on port 5173.

**Solution**: The Playwright config starts a fresh dev server on port 5173 with `reuseExistingServer: false`, which means it won't reuse an existing dev server. If you have a dev server running on port 5173, stop it before running E2E tests, or Playwright will fail to start its own server.

## Test Files Overview

Key E2E test files:

| File                                | Description                                          |
| ----------------------------------- | ---------------------------------------------------- |
| `e2e/profile-name-fallback.spec.ts` | Tests profile name display with capability fallbacks |
| `e2e/deal-form-dropdowns.spec.ts`   | Tests dropdown population and line item behavior     |
| `e2e/deal-edit.spec.ts`             | Tests deal creation and editing flows                |
| `e2e/smoke.spec.ts`                 | Basic app loading test                               |
| `e2e/debug-auth.spec.ts`            | Authentication verification                          |

## Configuration Files

- `playwright.config.ts` - Main Playwright configuration
- `global.setup.ts` - Authentication setup (runs before tests)
- `tsconfig.e2e.json` - TypeScript config for E2E files
- `e2e/storageState.json` - Browser storage state (auth cookies/tokens)

## Debugging Tips

1. **Screenshots and traces**: Enabled on failure; check `playwright-report/` after test runs
2. **Console logs**: Global setup logs auth responses and browser console messages
3. **UI mode**: Use `pnpm e2e:ui` for interactive test debugging
4. **Debug mode**: Use `pnpm e2e:debug` for step-through debugging with Playwright Inspector
