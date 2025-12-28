# CI/CD Troubleshooting Guide

## Overview

This guide helps diagnose and fix common CI/CD pipeline failures in the Rocket Aftermarket Tracker project.

## Common Failure Scenarios

### 0. E2E Safety Check Failure (Production Block)

**Symptom:**
```
Refusing to run E2E against production Supabase (VITE_SUPABASE_URL contains ogjtmtndgiqqdtwatsue).
Point repo secrets to a dedicated E2E/staging Supabase project, or set ALLOW_E2E_ON_PROD=1 intentionally.
```

**Root Cause:**
- The workflow has a **safety check** that prevents E2E tests from running against production databases
- Your `VITE_SUPABASE_URL` or `DATABASE_URL` secrets contain the production Supabase reference
- `ALLOW_E2E_ON_PROD` variable is not set to "1"

**Resolution:**

**Quick Fix (Temporary)**: Set `ALLOW_E2E_ON_PROD=1` repository variable
- ⚠️ **WARNING**: This will run tests against production - use with caution!
- See: [E2E Safety Check Quick Fix](./E2E_SAFETY_CHECK_QUICKFIX.md)

**Proper Fix (Recommended)**: Set up dedicated E2E/Staging Supabase project
- ✅ Complete isolation from production
- ✅ Safe to seed and modify test data
- See: [E2E Safety Check Guide](./E2E_SAFETY_CHECK_GUIDE.md) for detailed setup instructions

### 1. Secrets Not Accessible

**Symptom:**
```
Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in repo secrets
Missing E2E_EMAIL or E2E_PASSWORD in repo secrets; required for full E2E on main
```

**Root Causes:**
- Repository secrets not configured in GitHub Settings
- Secrets configured but not accessible from the workflow
- Typo in secret names (case-sensitive!)

**Resolution:**
1. Verify secrets are configured:
   - Go to GitHub repo → Settings → Secrets and variables → Actions
   - Ensure these secrets exist:
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
     - `E2E_EMAIL`
     - `E2E_PASSWORD`

2. Check workflow environment:
   - The enhanced debug step in `.github/workflows/e2e.yml` shows which variables are set
   - Look for the "Debug Environment Variables" section in the workflow logs

3. For PRs from forks:
   - Secrets are NOT available to PRs from forks for security reasons
   - The smoke test job will skip gracefully with a warning

### 2. Database Schema Mismatch

**Symptom:**
```
PostgrestError: column user_profiles.name does not exist
```

**Root Causes:**
- This is actually EXPECTED behavior!
- The `user_profiles` table only has `full_name`, not `name` or `display_name`
- The health endpoint probes for columns by attempting to query them
- A "column does not exist" error is caught and results in `false` for that capability

**Why This Isn't a Problem:**
- The capability detection system is designed to handle missing columns
- The health endpoint returns `{ name: false, full_name: true, display_name: false }`
- The application then uses only the available columns

**When It IS a Problem:**
- If ALL capabilities return `false` (including `full_name`)
- If the application crashes trying to use a missing column
- If RLS policies block the health check query

**Resolution:**
1. Verify `full_name` exists in the schema:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'user_profiles';
   ```

2. Check RLS policies allow reads:
   ```sql
   SELECT * FROM pg_policies WHERE tablename = 'user_profiles';
   ```

3. Reload PostgREST schema cache:
   ```sql
   NOTIFY pgrst, 'reload schema';
   ```

### 3. Test Timeouts

**Symptom:**
```
Test timeout of 30000ms exceeded
expect(locator).toHaveCount(expected) failed
```

**Root Causes:**
- Slow CI environment
- Network latency to Supabase
- Missing wait conditions in tests
- App not loading properly

**Resolution (Already Implemented):**
1. **Increased Timeout**: CI tests now have 45-second timeout (vs 30s locally)
2. **Retries**: Tests retry once in CI to handle transient failures
3. **Better Tracing**: Traces captured on every run in CI for debugging

**If Still Failing:**
1. Check the uploaded test artifacts:
   - Screenshots show what the page looked like at failure
   - Traces show detailed timeline of actions
   - HTML report shows full test output

2. Look for stuck navigation:
   ```typescript
   // Bad: No timeout specified
   await page.goto('/deals')
   
   // Good: Explicit timeout and wait condition
   await page.goto('/deals', { waitUntil: 'networkidle', timeout: 15000 })
   ```

3. Check for slow API calls:
   - Review network panel in trace
   - Look for hanging Supabase requests
   - Verify RLS policies aren't causing performance issues

### 4. E2E Test Init Script Issues

**Symptom:**
- Tests that should mock capabilities are failing
- SessionStorage values not persisting
- Route mocks not being applied

**Root Cause:**
- `addInitScript()` called AFTER `goto()`
- Init scripts must be added before any navigation

**Resolution (Fixed in profile-name-fallback.spec.ts):**
```typescript
// Bad:
await page.goto('/')
await page.addInitScript(() => { ... })  // Too late!
await page.goto('/')

// Good:
await page.addInitScript(() => { ... })  // Before any navigation
await page.goto('/')
```

### 5. Missing Test Artifacts

**Symptom:**
- No screenshots or traces in CI logs
- "if-no-files-found: ignore" hiding issues

**Resolution (Already Implemented):**
- Test results uploaded to `test-results-full` and `test-results-smoke` artifacts
- Includes:
  - `test-results/` directory
  - `e2e/*.png` (setup screenshots)
  - `e2e/*.html` (setup HTML dumps)
- Retention: 7 days

**To Download:**
1. Go to failed workflow run
2. Scroll to "Artifacts" section at bottom
3. Download `test-results-full` or `test-results-smoke`
4. Unzip and review traces/screenshots

## Workflow Configuration

### E2E Workflow (`.github/workflows/e2e.yml`)

**Two Jobs:**

1. **e2e-smoke** (Pull Requests):
   - Runs on PRs only
   - Gracefully skips if secrets not available
   - Runs 3 key tests: profile-name-fallback, deal-form-dropdowns, deal-edit

2. **e2e-full** (Main Branch):
   - Runs on pushes to main
   - REQUIRES all secrets (fails if missing)
   - Runs full test suite (`pnpm e2e`)

### Playwright Config (playwright.config.ts)

**CI-Specific Settings:**
- Timeout: 45s (vs 30s local)
- Retries: 1 (vs 0 local)
- Trace: 'on' (vs 'on-first-retry' local)
- Workers: 1 (sequential)

**Fallback Credentials:**
The config includes hardcoded test credentials as fallback:
```typescript
E2E_EMAIL: process.env.E2E_EMAIL || 'rob.brasco@priorityautomotive.com',
E2E_PASSWORD: process.env.E2E_PASSWORD || 'Rocket123!',
```
These are used when no env vars are set (e.g., local dev).

## Debugging Checklist

When a CI job fails:

- [ ] Check "Debug Environment Variables" output - are secrets available?
- [ ] Look for "column does not exist" errors - is this for a capability check?
- [ ] Review test timeout errors - did the test just need more time?
- [ ] Download and review test artifacts (screenshots, traces)
- [ ] Check if the failure is reproducible locally
- [ ] Verify Supabase is accessible and healthy
- [ ] Check for recent schema changes that might need cache reload

## Local Testing

To run E2E tests locally with full debugging:

```bash
# Install dependencies
pnpm install

# Install Playwright browsers
pnpm exec playwright install chromium --with-deps

# Set up .env.local with your credentials
cp .env.example .env.local
# Edit .env.local with real values

# Run all E2E tests
pnpm e2e

# Run specific test file
pnpm exec playwright test e2e/profile-name-fallback.spec.ts

# Run with UI mode (interactive)
pnpm e2e:ui

# Run with debug mode (step through)
pnpm e2e:debug
```

## Related Documentation

- [E2E Safety Check Guide](./E2E_SAFETY_CHECK_GUIDE.md) - Detailed guide for E2E safety check setup
- [E2E Safety Check Quick Fix](./E2E_SAFETY_CHECK_QUICKFIX.md) - Quick fix for production block error
- [User Profiles Schema](./USER_PROFILES_SCHEMA.md) - Schema details and capability system
- [Profile Name Fallback](./PROFILE_NAME_FALLBACK.md) - Display name resolution
- [README](../README.md) - General setup instructions
- [Deployment Guide](../DEPLOYMENT_GUIDE.md) - Production deployment

## Getting Help

If you've tried the above and are still stuck:

1. Collect diagnostic information:
   - Workflow run URL
   - Full error message
   - Downloaded test artifacts
   - Recent commits/changes

2. Create a detailed issue with:
   - What you expected to happen
   - What actually happened
   - Steps taken to diagnose
   - Relevant logs and screenshots

3. Tag appropriate team members for review
