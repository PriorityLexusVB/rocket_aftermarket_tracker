# E2E Test Fix - User Instructions

## What Was Fixed

**Problem**: E2E test `deal-edit.spec.ts` was timing out after 2 minutes waiting for products to appear in the dropdown.

**Root Cause**: Supabase's `handle_new_user()` trigger creates user profiles with `NULL org_id` during authentication, which breaks RLS (Row Level Security) policies. Since the test user had no `org_id`, they couldn't see the E2E org's products.

**Solution**: Enhanced `global.setup.ts` with retry logic to ensure the user-org association persists after the trigger completes.

---

## Changes Made (Commit 02708b3)

### 1. Enhanced `global.setup.ts`
- Added retry loop (5 attempts, 1s delays)
- Added profile existence check before UPDATE
- Added verification query after UPDATE
- Added 2s initial delay for trigger completion
- Added comprehensive debug logging

### 2. Created Documentation
- `E2E_COMPREHENSIVE_FIX_ANALYSIS.md` - Complete root cause analysis
- `scripts/verify-e2e-fix.sh` - Verification script for local testing

---

## What To Expect

### In CI Workflow Logs

When the E2E workflow runs, you should now see in step 9 ("Run E2E smoke tests"):

```
[global.setup] Waiting 2s for profile creation to settle...
[global.setup] Attempt 1: Profile found - org_id: NULL
[global.setup] ✅ User profile associated with E2E org:
[global.setup]   Email: your-test-user@example.com
[global.setup]   Name: Test User
[global.setup]   Org ID: 00000000-0000-0000-0000-0000000000e2
[global.setup] ✅ Verified: org_id persisted correctly
```

Then the test should complete successfully without timing out.

---

## How To Verify Locally

### Prerequisites
1. Set environment variables:
   ```bash
   export DATABASE_URL="postgresql://postgres.[project]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres"
   export E2E_EMAIL="your-test-user@example.com"
   export E2E_PASSWORD="your-password"
   export VITE_SUPABASE_URL="https://[project].supabase.co"
   export VITE_SUPABASE_ANON_KEY="your-anon-key"
   ```

2. Ensure test user exists in Supabase:
   - Go to Supabase Dashboard → Authentication → Users
   - Create user with the email from `E2E_EMAIL` if not exists

### Run Verification Script
```bash
bash scripts/verify-e2e-fix.sh
```

Expected output:
```
=== E2E Test Fix Verification ===

1. Checking environment variables...
   ✅ DATABASE_URL is set
   ✅ E2E_EMAIL is set (your-test-user@example.com)

2. Checking if E2E user exists in Supabase auth...
   ✅ User exists in auth.users

3. Checking user profile...
   ✅ Profile exists
      Name: Test User
      Role: staff
      ⚠️  org_id: NULL (will be fixed by global.setup.ts)

4. Checking E2E organization...
   ✅ E2E org exists: E2E Org

5. Checking E2E test products...
   ✅ Found 2 E2E products

=== Verification Summary ===

Environment ready for E2E tests!
```

### Run E2E Test
```bash
# Seed E2E data first
pnpm run db:seed-e2e

# Run the failing test
pnpm e2e --project=chromium e2e/deal-edit.spec.ts
```

Expected result: Test passes in ~10-15 seconds (previously timed out at 120s).

---

## If Tests Still Fail

### Check Workflow Logs
1. Go to Actions tab → E2E Tests workflow
2. Open "Run E2E smoke tests" step
3. Look for the `[global.setup]` log messages

### Common Issues

#### Issue 1: DATABASE_URL Not Available
**Symptoms**: Logs show "DATABASE_URL not set - skipping user-org association"

**Fix**: Ensure `DATABASE_URL` is set as a **Repository secret** (not Environment secret):
1. Go to Settings → Secrets and variables → Actions
2. Under "Repository secrets", click "New repository secret"
3. Name: `DATABASE_URL`
4. Value: Your Postgres connection string

#### Issue 2: Profile Not Found After Multiple Retries
**Symptoms**: Logs show "Failed: Profile not created after 5 attempts"

**Fix**: The user may not exist in `auth.users`. Create it in Supabase Dashboard → Authentication → Users.

#### Issue 3: org_id Not Persisting
**Symptoms**: Logs show "Verification failed: org_id=NULL"

**Possible causes**:
1. Another process/trigger is overwriting org_id
2. RLS policy blocking the UPDATE
3. Transaction isolation issue

**Debug**: Run manually:
```sql
-- Check current org_id
SELECT id, email, org_id FROM user_profiles WHERE email = 'your-test-user@example.com';

-- Manually set org_id
UPDATE user_profiles 
SET org_id = '00000000-0000-0000-0000-0000000000e2' 
WHERE email = 'your-test-user@example.com';

-- Verify
SELECT org_id FROM user_profiles WHERE email = 'your-test-user@example.com';
```

---

## Phase 2: Permanent Fix (Future)

This current fix is a **workaround**. For a permanent solution, we need to modify the `handle_new_user()` trigger in Supabase to preserve existing `org_id` values.

**Planned changes**:
1. Create new migration: `20251223000000_fix_handle_new_user_preserve_org_id.sql`
2. Modify trigger to check for existing `org_id` before INSERT/UPDATE
3. Test in staging environment
4. Deploy to production
5. Remove workaround from `global.setup.ts`

See `E2E_COMPREHENSIVE_FIX_ANALYSIS.md` for detailed plan.

---

## Summary

- **Commit**: 02708b3
- **Status**: Workaround implemented, awaiting CI verification
- **Next Step**: Monitor next CI run for success
- **Follow-up**: Plan Phase 2 migration to fix trigger permanently

---

**Questions?** Check the full analysis in `E2E_COMPREHENSIVE_FIX_ANALYSIS.md` or ping @copilot.
