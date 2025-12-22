# E2E Test Failure - Comprehensive Root Cause Analysis & Fix

## Executive Summary

**Problem**: E2E test `deal-edit.spec.ts` times out at line 36 waiting for products in dropdown.  
**Root Cause**: Authentication timing race condition where `handle_new_user()` trigger overwrites `org_id` with NULL.  
**Status**: Multiple attempted fixes (seed UPSERT, `global.setup.ts` association) but race condition persists.

---

## Root Cause Timeline

```
1. CI Workflow: Seed E2E data
   └─> Creates E2E org (00000000-0000-0000-0000-0000000000e2)
   └─> Seeds products, vendors with E2E org_id
   └─> Attempts to associate test user with E2E org (via UPSERT)
   
2. Playwright: global.setup.ts authenticates
   └─> Calls Supabase auth.signInWithPassword()
   └─> ⚠️ Supabase trigger fires: handle_new_user()
   
3. Trigger Issue (migration 20250110120001):
   INSERT INTO user_profiles (...) VALUES (...)  // ❌ NO org_id field
   ON CONFLICT UPDATE user_profiles SET ...      // ❌ Doesn't preserve org_id
   
4. Result: Profile has NULL org_id
   └─> RLS policies block access to E2E org products
   └─> Dropdown remains empty
   └─> Test times out after 30s at line 36
```

---

## Failed Fix Attempts

### Attempt 1: Seed-time UPSERT (commit 3667b84)
**What**: Changed seed_e2e.sql from UPDATE to INSERT...ON CONFLICT  
**Why it failed**: Runs BEFORE authentication, gets overwritten by trigger  
**Evidence**: Seed logs show "✅ Seed applied successfully" but tests still timeout

### Attempt 2: Post-auth association in global.setup.ts (commit efcfb40)
**What**: Added `associateUserWithE2EOrg()` function to run after auth  
**Why it failed**: Runs AFTER trigger fires, but trigger already set org_id=NULL  
**Evidence**: Latest workflow run 20444904860 still shows 2.0m timeout

---

## The Core Problem: handle_new_user() Trigger

**File**: `supabase/migrations/20250110120001_user_profiles_relax_email_and_add_auth_user_id.sql`

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, auth_user_id, email, full_name, role, department, is_active)
  VALUES (...);  -- ❌ org_id NOT included
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.user_profiles 
    SET 
      auth_user_id = COALESCE(auth_user_id, NEW.id),
      email = NEW.email,
      -- ❌ org_id NOT updated, could be set to NULL
    WHERE id = NEW.id OR auth_user_id = NEW.id;
    RETURN NEW;
END;
$$;
```

**Problem**: 
- INSERT doesn't include `org_id` → defaults to NULL
- UPDATE doesn't preserve existing `org_id` → could overwrite with NULL
- No logic to prevent NULL overwrites

---

## Proposed Solution Options

### Option A: Fix the Trigger (RECOMMENDED)
**Strategy**: Modify `handle_new_user()` to preserve existing `org_id`

```sql
-- New migration: 20251223000000_fix_handle_new_user_preserve_org_id.sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  existing_org_id UUID;
BEGIN
  -- Check if profile already exists and has org_id
  SELECT org_id INTO existing_org_id 
  FROM public.user_profiles 
  WHERE id = NEW.id OR auth_user_id = NEW.id OR email = NEW.email
  LIMIT 1;

  INSERT INTO public.user_profiles (
    id, auth_user_id, email, full_name, role, department, is_active, org_id
  )
  VALUES (
    NEW.id,
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'staff'::public.user_role),
    COALESCE(NEW.raw_user_meta_data->>'department', 'General'),
    true,
    existing_org_id  -- ✅ Preserve existing org_id if found
  );
  RETURN NEW;
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.user_profiles 
    SET 
      auth_user_id = COALESCE(auth_user_id, NEW.id),
      email = NEW.email,
      full_name = COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      role = COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, role),
      department = COALESCE(NEW.raw_user_meta_data->>'department', department),
      org_id = COALESCE(org_id, existing_org_id),  -- ✅ Preserve org_id
      updated_at = CURRENT_TIMESTAMP
    WHERE id = NEW.id OR auth_user_id = NEW.id;
    RETURN NEW;
END;
$$;
```

**Pros**:
- Fixes root cause permanently
- Works for all future E2E runs and production
- No race conditions
- Backward compatible

**Cons**:
- Requires production database migration
- Needs testing in staging first

---

### Option B: Timing Workaround (FALLBACK)
**Strategy**: Ensure seed runs AFTER first authentication

**Changes**:
1. Remove seed from workflow's pre-test step
2. Add seed call INSIDE `global.setup.ts` AFTER authentication
3. Ensure seed includes the post-auth UPDATE

```typescript
// global.setup.ts
export default async function globalSetup() {
  // ... existing auth code ...
  
  // After auth completes:
  await page.goto(base + '/debug-auth');
  await page.getByTestId('session-user-id').waitFor({ state: 'visible' });
  
  // NOW seed (after profile exists):
  if (process.env.DATABASE_URL && process.env.E2E_EMAIL) {
    const { execSync } = require('child_process');
    execSync('pnpm run db:seed-e2e', { 
      env: { ...process.env },
      stdio: 'inherit'
    });
  }
  
  // ... rest of setup ...
}
```

**Pros**:
- No production migration needed
- Can be implemented immediately

**Cons**:
- Fragile timing dependency
- Slower test runs (seed per run)
- Doesn't fix production auth flows

---

## Recommended Action Plan

### Phase 1: Immediate Workaround (< 1 hour)
1. Update `global.setup.ts` to:
   - Authenticate first
   - Wait for profile creation (check /debug-auth)
   - Then call associateUserWithE2EOrg() with retry logic
   - Add 2-3 retry attempts with 1s delays
   
2. Update `associateUserWithE2EOrg()` to:
   - Query current org_id first
   - Only UPDATE if org_id is NULL or different
   - Add verification query after UPDATE
   - Log success/failure clearly

### Phase 2: Permanent Fix (Next Sprint)
1. Create migration to fix `handle_new_user()` trigger
2. Test in staging environment
3. Deploy to production during maintenance window
4. Remove workaround from `global.setup.ts`

---

## Verification Commands

```bash
# Check current trigger definition
psql $DATABASE_URL -c "SELECT prosrc FROM pg_proc WHERE proname='handle_new_user'"

# Verify E2E user's org_id
psql $DATABASE_URL -c "SELECT id, email, org_id FROM user_profiles WHERE email='$E2E_EMAIL'"

# Test authentication without breaking org association
# (run after implementing fix)
pnpm e2e --project=chromium e2e/deal-edit.spec.ts
```

---

## Success Criteria

- [ ] Test user profile has correct `org_id` after authentication
- [ ] `deal-edit.spec.ts` passes without timeout
- [ ] Products visible in dropdown (line 36 completes < 5s)
- [ ] E2E workflow passes consistently (3+ consecutive runs)
- [ ] No NULL `org_id` in production user profiles after auth

---

## Related Files

- **Trigger**: `supabase/migrations/20250110120001_user_profiles_relax_email_and_add_auth_user_id.sql`
- **Global Setup**: `global.setup.ts` (lines 173-235)
- **Seed SQL**: `scripts/sql/seed_e2e.sql` (lines 31-47)
- **Seed JS**: `scripts/seedE2E.js` (lines 36-58)
- **Failing Test**: `e2e/deal-edit.spec.ts` (line 36)
- **Workflow**: `.github/workflows/e2e.yml` (lines 54-87)

---

**Last Updated**: 2025-12-22  
**Status**: Analysis Complete, Awaiting Fix Implementation
