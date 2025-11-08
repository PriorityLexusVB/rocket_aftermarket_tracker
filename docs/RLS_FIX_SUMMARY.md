# RLS Auth.Users Fix - Summary

## Overview

This document tracks the ongoing RLS (Row-Level Security) policy hardening effort to ensure:

1. No references to `auth.users` table in helper functions or policies
2. Complete write policy coverage for all multi-tenant tables
3. Proper org_id scoping and tenant isolation
4. Health monitoring for schema relationships

## What Was Fixed

The "permission denied for table users" error occurred because the `is_admin_or_manager()` function referenced the `auth.users` table, which authenticated users cannot query due to RLS restrictions.

## Migrations Applied

### 1. Migration 20251104221500 - Fix is_admin_or_manager() auth.users References

**File:** `supabase/migrations/20251104221500_fix_is_admin_or_manager_auth_users_references.sql`

**What it does:**

- Recreates `is_admin_or_manager()` function to ONLY query `public.user_profiles`
- Removes ALL references to `auth.users` table
- Checks both `id` and `auth_user_id` columns for compatibility
- Sets explicit `search_path = public` for security

**Function behavior:**

```sql
-- Returns true if current user is admin or manager
-- Now queries ONLY public.user_profiles (not auth.users)
SELECT EXISTS (
  SELECT 1 FROM public.user_profiles up
  WHERE (up.id = auth.uid() OR up.auth_user_id = auth.uid())
    AND up.role IN ('admin', 'manager')
    AND COALESCE(up.is_active, true) = true
)
```

### 2. Migration 20251105000000 - Fix RLS Policies and Write Permissions

**File:** `supabase/migrations/20251105000000_fix_rls_policies_and_write_permissions.sql`

**What it does:**

- Fixes loaner_assignments policies to use is_admin_or_manager() helper
- Adds INSERT/UPDATE/DELETE policies for loaner_assignments (org-scoped via jobs)
- Adds INSERT/UPDATE policies for transactions (org-scoped)
- Adds INSERT/UPDATE policies for vehicles (org-scoped)

### 3. Migration 20251106210000 - Multi-Tenant RLS Hardening

**File:** `supabase/migrations/20251106210000_multi_tenant_rls_hardening.sql`

**What it does:**

- Adds INSERT/UPDATE/DELETE policies for sms_templates
- Adds INSERT/UPDATE policies for products
- Adds INSERT/UPDATE policies for vendors
- Ensures RLS is enabled on all org-scoped tables
- Adds documentation comments to tables

### 4. Migration 20251107103000 - RLS Write Policies Completion

**File:** `supabase/migrations/20251107103000_rls_write_policies_completion.sql`

**What it does:**

- Audits all existing RLS policies and logs counts
- Adds SELECT policy for loaner_assignments (if missing)
- Verifies helper functions don't reference auth.users
- Validates RLS is enabled on all tables
- Reloads PostgREST schema cache
- Provides comprehensive validation and summary

### 5. Migration 20251107110500 - Manager DELETE Policies & Health Endpoint (NEW)

**File:** `supabase/migrations/20251107110500_add_manager_delete_policies_and_deals_health.sql`

**What it does:**

- Adds DELETE policies for managers across all multi-tenant tables:
  - jobs (deals)
  - job_parts (line items)
  - transactions
  - loaner_assignments
  - vehicles
  - sms_templates
  - products
  - vendors
  - user_profiles
- All DELETE policies scoped by org_id for proper tenant isolation
- Managers can only delete records within their organization
- Implements is_admin_or_manager() helper function check
- Reloads PostgREST schema cache with NOTIFY pgrst, 'reload schema'

**Why this matters:**
Previously, managers had INSERT/UPDATE permissions but lacked DELETE permissions, preventing them from removing old or test data. This migration completes the manager permission set while maintaining proper RLS security.

## Testing Coverage (UPDATED)

### Unit Tests - dealService Persistence (Task 2 & 3)

**File:** `src/tests/unit/dealService.persistence.test.js`

Comprehensive test coverage for:

- ✅ org_id inference (3 tests)
- ✅ loaner assignment persistence (4 tests)
- ✅ scheduling fallback when per-line scheduled\_\* absent (5 tests)
- ✅ error wrapper mapping (4 tests)
- ✅ mixed vendor aggregation logic (6 tests)
- ✅ vehicle description fallback logic (6 tests)

**Total: 27 test cases covering all persistence behaviors**

**Verified**: 2025-11-07 (Task 3)

- All tests pass (27/27)
- Complete coverage of Task 3 requirements
- See: docs/TASK_3_PERSISTENCE_RLS_VERIFICATION.md

### E2E Tests - Deals List Refresh (Task 4)

**File:** `e2e/deals-list-refresh.spec.ts`

New E2E tests validating deals list displays updates correctly:

- ✅ Vehicle description format after edit
- ✅ Stock number updates propagate to list
- ✅ Loaner badge visibility toggles
- ✅ Promised date/window fields
- ✅ Round-trip edit → save → list refresh flow

**Total: 2 Playwright test specs**

**Created**: 2025-11-07 (Task 4)

- Deterministic (auto-skips without auth)
- Stable selectors (data-testid based)
- See: docs/TASK_4_DEALS_LIST_REFRESH_E2E.md

**Total: 30 test cases covering all persistence behaviors**

### Health Endpoint (NEW)

**File:** `src/api/health/deals-rel.js`

Runtime health check endpoint at `/api/health/deals-rel` that:

- ✅ Tests Supabase connectivity
- ✅ Verifies job_parts → vendors relationship
- ✅ Detects schema cache staleness
- ✅ Returns actionable recommendations

**Response format:**

```json
{
  "vendorRelationship": "ok",
  "timestamp": "2025-11-07T18:00:00.000Z",
  "details": {
    "checks": [
      {
        "name": "supabase_connectivity",
        "status": "ok"
      },
      {
        "name": "job_parts_vendor_relationship",
        "status": "ok",
        "sample": { "id": "...", "vendor": { "id": "...", "name": "..." } }
      }
    ]
  }
}
```

## Why This Works

1. **Authenticated users CAN query `public.user_profiles`** (with proper RLS policies)
2. **Authenticated users CANNOT query `auth.users`** (auth schema is restricted)
3. The fix removes the problematic reference while maintaining the same functionality

## What Was NOT Changed

✅ No changes to:

- Application code (React components, services)
- Other database functions (`auth_user_org`, `get_user_role`)
- RLS policies (already fixed in earlier migrations)
- Any frontend functionality

## Testing Recommendations

Since there's no existing database test infrastructure, manual testing is recommended:

### Test Scenarios

1. **Admin Operations**
   - Create new user as admin
   - Update user roles
   - Delete users

2. **Permission Checks**
   - Login as admin → should see all features
   - Login as manager → should see management features
   - Login as staff → should see limited features

3. **Dropdown Loading**
   - Verify vendors dropdown loads without errors
   - Verify products dropdown loads without errors
   - Verify staff dropdown loads without errors

4. **Deal Operations**
   - Create new deal with all fields
   - Update existing deal
   - Verify proper org scoping (users only see their org's data)

### Expected Behavior

- ✅ No "permission denied for table users" errors
- ✅ All role-based permissions work correctly
- ✅ Dropdowns populate properly
- ✅ Data saves and updates successfully
- ✅ Proper tenant/org isolation maintained

## Migration Timeline

The issue was introduced and fixed multiple times:

1. **20250101000001** - First introduced `auth.users` reference
2. **20250107150001** - Fixed by using only `public.user_profiles`
3. **20250110120000** - Re-introduced `auth.users` reference (regressed)
4. **20251104221500** - ✅ Fixed again (this PR)

This PR ensures the fix is final and includes documentation to prevent future regressions.

## Security Impact

✅ **Improved Security:**

- Explicit `search_path = public` prevents schema hijacking
- No exposure of auth schema internals
- Maintains proper tenant isolation

✅ **No Security Vulnerabilities:**

- CodeQL scan passed with no issues
- All existing security patterns preserved

## Deployment

To apply this fix:

1. **Option A: Supabase CLI**

   ```bash
   pnpm run db:push
   ```

2. **Option B: Supabase Dashboard**
   - Go to SQL Editor
   - Copy contents of migration file
   - Run the SQL

3. **Verify**
   - Check function definition:

   ```sql
   SELECT prosrc FROM pg_proc
   WHERE proname = 'is_admin_or_manager';
   ```

   - Should NOT contain "auth.users"
   - Should ONLY contain "public.user_profiles"

## Rollback Plan

If issues occur (unlikely):

1. The previous function definition will be in migration `20250110120000`
2. However, that version has the auth.users bug
3. Better option: Use version from `20250107150001` which was also correct

## Questions?

See `docs/RLS_AUTH_USERS_FIX.md` for detailed technical explanation.
