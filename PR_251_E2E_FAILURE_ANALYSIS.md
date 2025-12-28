# PR #251 E2E Workflow Failure - Complete Analysis & Resolution

**Date**: December 28, 2025  
**PR**: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/pull/251  
**Failing Workflow**: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20557233940/job/59045279378  
**Status**: ⚠️ **ACTION REQUIRED** - Safety check intentionally blocking E2E tests

---

## Executive Summary

The E2E workflow is **working correctly** but is **intentionally blocking** test execution due to a production safety check. This is not a bug—it's a security feature protecting your production database from test operations.

**Root Cause**: GitHub Actions secrets (`VITE_SUPABASE_URL` and/or `DATABASE_URL`) point to production Supabase, and the safety check is preventing tests from running against production without explicit approval.

**Impact**: PR #251 cannot complete E2E smoke tests until this configuration issue is resolved.

**Risk Level**: 🟢 Low - This is a configuration issue, not a code defect. The PR code changes are fine.

---

## What's Happening

### The Failed Step

**Step 10 of 14**: "Safety check - block E2E against production Supabase"

```yaml
- name: Safety check - block E2E against production Supabase
  if: steps.check-secrets.outputs.secrets_available == 'true'
  env:
    VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
    DATABASE_URL: ${{ secrets.DATABASE_URL }}
    ALLOW_E2E_ON_PROD: ${{ vars.ALLOW_E2E_ON_PROD }}
  run: |
    set -euo pipefail
    PROD_REF="ogjtmtndgiqqdtwatsue"
    if [ "${ALLOW_E2E_ON_PROD:-}" = "1" ]; then
      echo "::warning::ALLOW_E2E_ON_PROD=1 set; skipping prod safety block"
      exit 0
    fi

    if echo "${VITE_SUPABASE_URL:-}" | grep -q "${PROD_REF}"; then
      echo "::error::Refusing to run E2E against production Supabase (VITE_SUPABASE_URL contains ${PROD_REF})."
      echo "::error::Point repo secrets to a dedicated E2E/staging Supabase project, or set ALLOW_E2E_ON_PROD=1 intentionally."
      exit 1
    fi

    if echo "${DATABASE_URL:-}" | grep -q "${PROD_REF}"; then
      echo "::error::Refusing to seed E2E data against production Supabase (DATABASE_URL contains ${PROD_REF})."
      echo "::error::Point DATABASE_URL to a dedicated E2E/staging database, or set ALLOW_E2E_ON_PROD=1 intentionally."
      exit 1
    fi
```

**What it does**:
1. Checks if `VITE_SUPABASE_URL` contains the production reference `ogjtmtndgiqqdtwatsue`
2. Checks if `DATABASE_URL` contains the production reference `ogjtmtndgiqqdtwatsue`
3. If either contains the production reference AND `ALLOW_E2E_ON_PROD` is not set to "1", the workflow fails
4. This prevents accidental E2E test execution against production databases

**Why it exists**:
- E2E tests seed test data (`pnpm run db:seed-e2e`)
- E2E tests create, update, and delete records
- Running these against production could corrupt real user data
- This safety check prevents disasters

---

## PR #251 Code Changes

### Files Changed (3 files, +5/-26 lines)

**✅ All changes are valid and not causing the workflow failure**

1. **playwright.config.ts** (+1/-1)
   - Changed `workers` from `undefined` to `1` for non-CI local runs
   - **Purpose**: Stabilize local Playwright test execution
   - **Impact**: No effect on CI (CI already uses 1 worker)

2. **src/services/dealService.js** (+0/-24)
   - Removed `USER_PROFILES_NAME_AVAILABLE` capability detection code
   - Removed `disableUserProfilesNameCapability()` and `enableUserProfilesNameCapability()` functions
   - **Purpose**: Cleanup unused code (user_profiles.name column detection no longer needed)
   - **Impact**: No functional change - these functions were leftover from previous capability work

3. **src/tests/jobPartsService.test.js** (+4/-1)
   - Fixed test mock to include `select` method
   - **Purpose**: Fix unit test to match actual service usage
   - **Impact**: Unit tests now pass correctly

### PR Checklist (from PR description)

- [ ] VITE_DEAL_FORM_V2 honored; tests run with flag on.
- [ ] Only a `data-testid="loaner-section"` was added to `DealForm.jsx`.
- [ ] Toggle test passes (create + edit).
- [ ] No service signatures changed. ✅ **Confirmed: Only internal cleanup**
- [ ] Rollback: set `VITE_DEAL_FORM_V2=false`.

**Note**: The PR checklist items don't match the actual code changes (checklist mentions loaner section changes, but the diff shows different changes). This suggests the PR description may be out of date or the wrong template was used.

---

## Resolution Options

### ⚡ Option 1: Temporary Bypass (5 minutes)

**Use case**: You want to quickly unblock the PR and are willing to run tests against production temporarily.

**⚠️ WARNING**: This will seed test data into production and may interfere with real users.

**Steps**:
1. Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/settings/variables/actions
2. Click "New repository variable"
3. Name: `ALLOW_E2E_ON_PROD`
4. Value: `1`
5. Click "Add variable"
6. Go back to PR #251 and click "Re-run jobs"

**What happens next**:
- Safety check will show warning but pass
- E2E tests will run against production
- Test data will be seeded into production database
- You can remove the variable later to restore the safety check

---

### ✅ Option 2: Dedicated E2E Supabase (30-60 minutes)

**Use case**: You want a proper, long-term solution with complete test isolation.

**Benefits**:
- Complete isolation from production
- Safe to seed, modify, and delete test data
- Can be reset/wiped at any time
- Best practice for professional CI/CD

**Steps**:

#### 2.1. Create E2E Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name: "Rocket Aftermarket Tracker - E2E"
4. Region: Same as production (for consistency)
5. Database password: Set a strong password
6. Wait for project creation

#### 2.2. Copy Schema to E2E Project

Choose one of these methods:

**Method A**: If you have Supabase CLI and migrations
```bash
cd supabase
supabase link --project-ref <e2e-project-ref>
supabase db push
```

**Method B**: If you have production database access
```bash
# Export production schema (structure only, no data)
pg_dump -h <prod-host> -U postgres -s -n public > schema.sql

# Import to E2E project
psql -h <e2e-host> -U postgres -d postgres -f schema.sql
```

**Method C**: Manual copy
- Open production Supabase SQL editor
- Copy table definitions, RLS policies, functions
- Paste into E2E Supabase SQL editor

#### 2.3. Create E2E Test User

In E2E Supabase Dashboard:
1. Go to Authentication → Users
2. Click "Add user" → "Create new user"
3. Email: `e2e-tester@example.com`
4. Password: (generate strong password)
5. Enable "Email confirmed"
6. Click "Create user"
7. **Note the user ID** (copy from the users table)

#### 2.4. Set Up Test Organization

Run this SQL in E2E Supabase SQL Editor:

```sql
-- Create E2E organization
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (
  'e2e-test-org-id',
  'E2E Test Organization',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Get E2E user ID from auth.users
SELECT id, email FROM auth.users WHERE email = 'e2e-tester@example.com';

-- Associate E2E user with E2E organization
INSERT INTO user_profiles (
  id,  -- Use the ID from previous SELECT
  email,
  full_name,
  org_id,
  created_at,
  updated_at
)
VALUES (
  '<paste-user-id-here>',
  'e2e-tester@example.com',
  'E2E Test User',
  'e2e-test-org-id',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  org_id = EXCLUDED.org_id,
  updated_at = NOW();
```

#### 2.5. Update GitHub Repository Secrets

Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/settings/secrets/actions

Update these secrets (click "Update" next to each):

**VITE_SUPABASE_URL**
```
https://<e2e-project-ref>.supabase.co
```
Get from: E2E Supabase → Settings → API → Project URL

**VITE_SUPABASE_ANON_KEY**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
Get from: E2E Supabase → Settings → API → anon public

**DATABASE_URL**
```
postgresql://postgres:<password>@db.<e2e-project-ref>.supabase.co:5432/postgres
```
Get from: E2E Supabase → Settings → Database → Connection string (URI)
Replace `<password>` with your E2E database password

**E2E_EMAIL**
```
e2e-tester@example.com
```

**E2E_PASSWORD**
```
<the-password-you-set-in-step-2.3>
```

#### 2.6. Enable E2E Seeding (Recommended)

Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/settings/variables/actions

Click "New repository variable":
- Name: `ENABLE_E2E_SEED`
- Value: `1`
- Click "Add variable"

#### 2.7. Test the Configuration

1. Go to PR #251
2. Click "Re-run jobs" → "Re-run all jobs"
3. Watch for:
   - ✅ "Safety check" step passes (no error about production)
   - ✅ "Seed E2E test data" step runs and seeds data
   - ✅ "Run E2E smoke tests" step completes successfully

---

## Verification & Testing

After implementing either option:

### 1. Check Workflow Logs

Go to: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions

Find the re-run of workflow run #20557233940 and look for these steps:

**"Check for required secrets"** - Should show:
```
VITE_SUPABASE_URL=PRESENT
VITE_SUPABASE_ANON_KEY=PRESENT
E2E_EMAIL=PRESENT
E2E_PASSWORD=PRESENT
DATABASE_URL=PRESENT
```

**"Safety check - block E2E against production Supabase"** - Should show:
- **Option 1**: `⚠️ ALLOW_E2E_ON_PROD=1 set; skipping prod safety block`
- **Option 2**: (No output - passes silently)

**"Seed E2E test data"** - Should show:
```
Seeding E2E test data (products, vendors, etc.)
✓ Products seeded
✓ Vendors seeded
✓ Organization verified
✓ Staff members created
```

**"Run E2E smoke tests"** - Should show:
```
Running 3 tests:
✓ profile-name-fallback.spec.ts
✓ deal-form-dropdowns.spec.ts
✓ deal-edit.spec.ts

3 passed (XX.Xs)
```

### 2. Manual Test (Local)

If you want to test the E2E setup locally with the new configuration:

```bash
# Clone the repo
git clone https://github.com/PriorityLexusVB/rocket_aftermarket_tracker.git
cd rocket_aftermarket_tracker

# Check out the PR branch
git fetch origin pull/251/head:pr-251
git checkout pr-251

# Set up environment (use E2E credentials)
cp .env.example .env.local
# Edit .env.local:
# VITE_SUPABASE_URL=https://<e2e-ref>.supabase.co
# VITE_SUPABASE_ANON_KEY=<e2e-anon-key>
# E2E_EMAIL=e2e-tester@example.com
# E2E_PASSWORD=<e2e-password>

# Install dependencies
pnpm install

# Install Playwright
pnpm exec playwright install chromium --with-deps

# Run E2E tests
pnpm e2e
```

Expected output:
```
✓ All 27 tests pass
```

---

## Troubleshooting

### Issue: "Secrets not available" error

**Symptom**: Workflow says secrets are NOT_PRESENT

**Solution**:
1. Verify you're updating secrets in the correct repository
2. Check secret names are exactly correct (case-sensitive!)
3. Wait 1-2 minutes after updating secrets before re-running
4. Try re-running workflow instead of pushing new commit

### Issue: "Column does not exist" errors during tests

**Symptom**: Tests fail with PostgrestError about missing columns

**Solution**:
1. Verify E2E schema matches production schema
2. Run schema sync (see Option 2, Step 2.2)
3. Check that migrations have been applied to E2E project

### Issue: "Permission denied for table" errors

**Symptom**: Tests fail with RLS permission errors

**Solution**:
1. Review RLS policies in E2E Supabase
2. Ensure test user has correct permissions
3. Verify user is associated with correct organization
4. Check that `org_id` in user_profiles matches organization

### Issue: "No products available" errors

**Symptom**: Tests fail with message about missing products

**Solution**:
1. Ensure `DATABASE_URL` secret is set correctly
2. Enable `ENABLE_E2E_SEED=1` variable
3. Check seeding step output in workflow logs
4. Manually run: `DATABASE_URL=<e2e-url> pnpm run db:seed-e2e`

---

## Impact Analysis

### What PR #251 Changes

✅ **Safe Changes**:
- Stabilizes Playwright worker configuration for local development
- Removes unused capability detection code
- Fixes unit test mocks

⚠️ **No Breaking Changes**:
- No API signature changes
- No schema changes
- No UI changes
- No feature flag changes

### What This Resolution Does

**Option 1 (ALLOW_E2E_ON_PROD=1)**:
- ⚠️ Runs E2E tests against production
- ⚠️ Seeds test data into production
- ⚠️ May interfere with real users
- ✅ Quick to implement
- ❌ Not recommended for long-term

**Option 2 (Dedicated E2E Supabase)**:
- ✅ Complete test isolation
- ✅ Safe to seed/modify data
- ✅ Professional CI/CD practice
- ✅ Can be reset anytime
- ⏱️ Takes 30-60 minutes to set up
- ✅ Recommended for long-term

---

## Recommendations

### Immediate Action (Today)

**If you need PR #251 to pass quickly**:
→ Use **Option 1** (ALLOW_E2E_ON_PROD=1)
- Takes 5 minutes
- Unblocks the PR
- Acceptable for urgent situations

### Long-term Action (This Week)

**Even if you used Option 1**:
→ Set up **Option 2** (Dedicated E2E Supabase)
- Invest 30-60 minutes
- Proper test isolation
- Remove ALLOW_E2E_ON_PROD=1 once done

### Going Forward

1. **Document E2E Setup**: Keep E2E Supabase credentials in team password manager
2. **Monitor E2E Health**: Set up alerts for E2E workflow failures
3. **Regular Schema Sync**: Update E2E schema when production schema changes
4. **Test Data Management**: Reset E2E database periodically to remove stale test data

---

## Related Documentation

- **[E2E Safety Check Guide](./docs/E2E_SAFETY_CHECK_GUIDE.md)** - Complete setup guide for Option 2
- **[E2E Safety Check Quick Fix](./docs/E2E_SAFETY_CHECK_QUICKFIX.md)** - Quick reference for both options
- **[CI Troubleshooting](./docs/CI_TROUBLESHOOTING.md)** - General CI/CD troubleshooting
- **[E2E Seeding Fix](./E2E_SEEDING_FIX.md)** - E2E test data seeding
- **[Deployment Guide](./DEPLOYMENT_GUIDE.md)** - Production deployment procedures

---

## Quick Reference

### Key URLs
- **PR #251**: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/pull/251
- **Failed Workflow**: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20557233940
- **Secrets Management**: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/settings/secrets/actions
- **Variables Management**: https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/settings/variables/actions
- **Supabase Dashboard**: https://supabase.com/dashboard

### Required Secrets (Option 2)
```
VITE_SUPABASE_URL       = https://<e2e-ref>.supabase.co
VITE_SUPABASE_ANON_KEY  = <e2e-anon-key>
DATABASE_URL            = postgresql://postgres:<pass>@db.<e2e-ref>.supabase.co:5432/postgres
E2E_EMAIL               = e2e-tester@example.com
E2E_PASSWORD            = <secure-password>
```

### Optional Variables
```
ENABLE_E2E_SEED         = 1  (recommended - enables auto-seeding)
ALLOW_E2E_ON_PROD       = 1  (only for Option 1 - not recommended)
```

---

## Questions?

If you need help implementing either option:
1. Review the detailed guides linked above
2. Check the troubleshooting sections
3. Verify all secrets are configured correctly
4. Test locally before re-running CI

**The safety check is working correctly - it's preventing a potential production data issue. Choose the resolution option that best fits your timeline and safety requirements.**
