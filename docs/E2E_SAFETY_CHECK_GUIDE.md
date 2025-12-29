# E2E Safety Check Guide

## Overview

The E2E workflow includes a **safety check** that prevents accidental execution of E2E tests against production Supabase databases. This is a critical security feature that protects your production data from test operations.

## Current Issue

**Workflow Run** (historical context; see current workflow in `.github/workflows/e2e.yml`): https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20557233940/job/59045279378

**Error**: The workflow failed at step 10: "Safety check - block E2E against production Supabase"

**Root Cause**: The safety check detected that either:
1. `VITE_SUPABASE_URL` contains the production reference `ogjtmtndgiqqdtwatsue`, OR
2. `DATABASE_URL` contains the production reference `ogjtmtndgiqqdtwatsue`, AND
3. `ALLOW_E2E_ON_PROD` is not set to "1"

## The Safety Check Mechanism

**Location**: `.github/workflows/e2e.yml` (lines 96-121 for smoke job, lines 272-296 for full job)

```yaml
- name: Safety check - block E2E against production Supabase
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

## Solution Options

### Option 1: Set ALLOW_E2E_ON_PROD=1 (Quick Fix - For Testing Only)

**⚠️ WARNING**: This option bypasses the safety check and allows E2E tests to run against production. **Use only for temporary testing or if you're certain you want to run E2E tests against production.**

**Steps**:
1. Go to GitHub repository → Settings → Secrets and variables → Actions → Variables tab
2. Click "New repository variable"
3. Name: `ALLOW_E2E_ON_PROD`
4. Value: `1`
5. Click "Add variable"

**Risks**:
- E2E tests will seed test data into your production database
- E2E tests will create, update, and delete records in production
- May interfere with real user data

**When to use**:
- You have proper data isolation in your production Supabase (e.g., test organization/tenant)
- You want to test against production temporarily
- You're confident the test data won't interfere with real users

---

### Option 2: Configure Separate E2E/Staging Supabase Project (RECOMMENDED)

**✅ RECOMMENDED**: This is the safest and most professional approach.

**Benefits**:
- Complete isolation from production data
- Can safely seed, modify, and delete test data
- Matches production schema without risk
- Can be reset/wiped at any time

**Steps**:

#### 2.1. Create E2E Supabase Project

1. Go to https://supabase.com/dashboard
2. Click "New Project"
3. Name it something like "Rocket Aftermarket Tracker - E2E"
4. Choose a region (preferably same as production for consistency)
5. Set a strong database password
6. Wait for project to be created

#### 2.2. Set Up E2E Project Schema

Option A: **Copy Schema from Production** (if you have access)
```bash
# Export production schema
pg_dump -h <prod-host> -U postgres -s -n public > schema.sql

# Import to E2E project
psql -h <e2e-host> -U postgres -d postgres -f schema.sql
```

Option B: **Run Supabase Migrations**
```bash
# If you have migrations in supabase/migrations/
cd supabase
supabase link --project-ref <e2e-project-ref>
supabase db push
```

Option C: **Manual Schema Setup**
- Copy tables/policies/functions from production Supabase dashboard
- Or use the Supabase CLI to replicate schema

#### 2.3. Create E2E Test User

1. In E2E Supabase dashboard → Authentication → Users
2. Click "Add user" → "Create new user"
3. Email: `e2e-tester@example.com` (or your preferred test email)
4. Password: Set a secure password (e.g., generate with password manager)
5. Confirm email: Enable "Email confirmed" checkbox
6. Click "Create user"

#### 2.4. Set Up Test Organization/Tenant

Run this SQL in your E2E Supabase SQL Editor:

**Note**: Verify these table names match your actual schema. The example assumes standard `organizations` and `user_profiles` tables. Check your schema documentation or run `\dt` in the SQL editor to confirm table names.

```sql
-- Create E2E organization
INSERT INTO organizations (id, name, created_at, updated_at)
VALUES (
  'e2e-test-org-id',  -- Use a fixed ID for consistency
  'E2E Test Organization',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  updated_at = NOW();

-- Associate E2E user with E2E organization
INSERT INTO user_profiles (
  id,  -- Same as auth.users.id
  email,
  full_name,
  org_id,
  created_at,
  updated_at
)
VALUES (
  '<e2e-user-auth-id>',  -- Get from auth.users table
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

1. Go to GitHub repository → Settings → Secrets and variables → Actions → Secrets tab
2. Update/create these secrets:

   **VITE_SUPABASE_URL**
   - Value: `https://<e2e-project-ref>.supabase.co`
   - Get from: E2E Supabase Dashboard → Settings → API

   **VITE_SUPABASE_ANON_KEY**
   - Value: Your E2E project's anon/public key
   - Get from: E2E Supabase Dashboard → Settings → API → anon/public

   **DATABASE_URL**
   - Value: `postgresql://postgres:[password]@db.<e2e-project-ref>.supabase.co:5432/postgres`
   - Get from: E2E Supabase Dashboard → Settings → Database → Connection string (URI)
   - Replace `[password]` with your E2E database password

   **E2E_EMAIL**
   - Value: `e2e-tester@example.com` (or whatever you set in 2.3)

   **E2E_PASSWORD**
   - Value: The password you set in 2.3

#### 2.6. Enable E2E Seeding (Optional but Recommended)

1. Go to GitHub repository → Settings → Secrets and variables → Actions → Variables tab
2. Create a new variable:
   - Name: `ENABLE_E2E_SEED`
   - Value: `1`
3. Click "Add variable"

This will enable automatic seeding of test data (products, vendors, etc.) before each E2E run.

#### 2.7. Verify Configuration

1. Go to your PR → Actions tab
2. Find the failed E2E workflow run
3. Click "Re-run jobs" → "Re-run all jobs"
4. The safety check should now pass ✅

---

### Option 3: Modify Safety Check (Not Recommended)

You could modify the workflow to use a different production reference or disable the check entirely, but this is **strongly discouraged** as it removes an important safety guard.

---

## Testing Your Configuration

After setting up Option 1 or Option 2, test your configuration:

### 1. Verify Secrets Are Set

Check the workflow run logs for the "Check for required secrets" step. You should see:
```
VITE_SUPABASE_URL=PRESENT
VITE_SUPABASE_ANON_KEY=PRESENT
E2E_EMAIL=PRESENT
E2E_PASSWORD=PRESENT
DATABASE_URL=PRESENT
```

### 2. Verify Safety Check Passes

Look for the "Safety check - block E2E against production Supabase" step:
- **Option 1**: Should show warning: "ALLOW_E2E_ON_PROD=1 set; skipping prod safety block"
- **Option 2**: Should pass silently (no errors about production reference)

### 3. Run a Test PR

Create a small test commit and push to your PR branch to trigger the E2E workflow:
```bash
# Make a trivial change
echo "# E2E test" >> README.md
git add README.md
git commit -m "Test E2E configuration"
git push
```

Watch the workflow run and verify:
- ✅ Safety check passes
- ✅ Tests run successfully
- ✅ No production data is affected

---

## Troubleshooting

### "Secrets not available" in PR from fork
**Issue**: GitHub Actions doesn't expose secrets to PRs from forked repositories for security reasons.

**Solution**: 
- For internal team: Ensure PR is from a branch in the main repository, not a fork
- For external contributors: Maintainers must run E2E tests after merging to main

### "column does not exist" errors during tests
**Issue**: E2E Supabase project schema doesn't match production.

**Solution**: Ensure you've properly replicated the schema (see Option 2, Step 2.2)

### Tests fail with "No products available"
**Issue**: E2E database is empty or seeding didn't run.

**Solution**: 
1. Verify `DATABASE_URL` is set correctly
2. Enable `ENABLE_E2E_SEED=1` variable
3. Manually run: `pnpm run db:seed-e2e` (requires `DATABASE_URL` env var)

### "permission denied for table" errors
**Issue**: RLS (Row Level Security) policies in E2E Supabase are blocking test user.

**Solution**: Review and adjust RLS policies in E2E Supabase to allow test user access

---

## Best Practices

1. **Keep E2E and Production Separate**: Never share databases between test and production
2. **Regular Schema Sync**: Update E2E schema when production schema changes
3. **Isolate Test Data**: Use distinct org IDs, email patterns, or naming conventions for test data
4. **Document E2E Setup**: Keep this guide updated as your E2E configuration evolves
5. **Monitor E2E Health**: Set up alerts for E2E workflow failures

---

## Related Documentation

- [CI Troubleshooting Guide](./CI_TROUBLESHOOTING.md) - General CI/CD issues
- [E2E Seeding Fix](../E2E_SEEDING_FIX.md) - Test data seeding
- [Deployment Guide](../DEPLOYMENT_GUIDE.md) - Production deployment
- [README](../README.md) - General setup

---

## Quick Reference

### Repository Secrets (Option 2 - E2E Supabase)
```
VITE_SUPABASE_URL         → https://<e2e-ref>.supabase.co
VITE_SUPABASE_ANON_KEY    → E2E anon key
DATABASE_URL              → postgresql://postgres:...@db.<e2e-ref>.supabase.co:5432/postgres
E2E_EMAIL                 → e2e-tester@example.com
E2E_PASSWORD              → <secure-password>
```

### Repository Variables
```
ENABLE_E2E_SEED           → 1 (optional, enables auto-seeding)
ALLOW_E2E_ON_PROD         → 1 (only if using Option 1 - NOT RECOMMENDED)
```

### Safety Check Logic
```bash
PROD_REF="ogjtmtndgiqqdtwatsue"

# Bypass if ALLOW_E2E_ON_PROD=1
[ "$ALLOW_E2E_ON_PROD" = "1" ] && exit 0

# Block if VITE_SUPABASE_URL contains PROD_REF
echo "$VITE_SUPABASE_URL" | grep -q "$PROD_REF" && exit 1

# Block if DATABASE_URL contains PROD_REF
echo "$DATABASE_URL" | grep -q "$PROD_REF" && exit 1

# Pass if neither contains PROD_REF
exit 0
```
