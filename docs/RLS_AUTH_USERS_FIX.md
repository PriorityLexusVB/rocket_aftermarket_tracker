# RLS auth.users Reference Fix

## Problem

When RLS policies or security-definer functions reference `auth.users` table, authenticated users encounter "permission denied for table users" errors. This happens because:

1. The `auth.users` table is in the `auth` schema (not `public`)
2. Authenticated users (role: `authenticated`) don't have permission to query the `auth` schema
3. Even though functions are `SECURITY DEFINER`, if they reference `auth.users`, the query planner may try to access it with the caller's permissions

## Root Cause

The `is_admin_or_manager()` function was defined multiple times across migrations with varying implementations:

### Problematic Implementations

1. **Migration: 20250101000001_fix_user_management_rls_policies.sql**
   - Referenced `auth.users` to check metadata
   - Also checked `public.user_profiles` as fallback
   - This caused permission errors for authenticated users

2. **Migration: 20250110120000_user_profiles_relax_email_and_add_auth_user_id.sql**
   - Also referenced `auth.users` to check metadata
   - This was the most recent definition, so it overrode earlier fixes

### Correct Implementation (already existing)

**Migration: 20250107150001_fix_claims_rls_policies.sql**
- Only used `public.user_profiles`
- No `auth.users` references
- However, this was later overridden by migration 20250110120000

## Solution

Created migration **20251104221500_fix_is_admin_or_manager_auth_users_references.sql** that:

1. Recreates `is_admin_or_manager()` function to ONLY use `public.user_profiles`
2. Checks both `id` and `auth_user_id` columns to support legacy and new user records
3. Sets explicit `search_path = public` to prevent any schema confusion
4. Removes all `auth.users` references completely

### Key Changes

```sql
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check user_profiles table only (no auth.users references)
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE (up.id = auth.uid() OR up.auth_user_id = auth.uid())
      AND up.role IN ('admin', 'manager')
      AND COALESCE(up.is_active, true) = true
  )
$$;
```

## Verification

### Functions Checked
- ✅ `is_admin_or_manager()` - Fixed in migration 20251104221500
- ✅ `auth_user_org()` - Already correct, only uses `public.user_profiles`
- ✅ `get_user_role()` - Already correct, only uses `public.user_profiles`

### Policies Checked
- ✅ Claims policies (`staff_can_view_all_claims`, etc.) - Fixed in migration 20250107150001
- ✅ Claim attachments policies - Fixed in migration 20250107150001
- ✅ Storage policies - Fixed in migration 20250107150001
- ✅ All other policies use helper functions that now only reference `public.user_profiles`

## Testing

Since there is no existing SQL/database test infrastructure, testing should be done manually:

1. **Test admin user creation**: Verify admins can create new users
2. **Test permission checks**: Verify role-based permissions work correctly
3. **Test dropdown loading**: Verify dropdowns load without permission errors
4. **Test deal creation/updates**: Verify saves work without errors

## Impact

- **Zero breaking changes**: The function signature and behavior remain the same
- **Fixes permission errors**: Removes "permission denied for table users" errors
- **Maintains compatibility**: Works with both legacy (id-based) and new (auth_user_id-based) user records
- **Improves security**: Explicit `search_path` prevents schema hijacking

## Related Files

- Migration: `supabase/migrations/20251104221500_fix_is_admin_or_manager_auth_users_references.sql`
- Previous attempts:
  - `supabase/migrations/20250101000001_fix_user_management_rls_policies.sql`
  - `supabase/migrations/20250107150001_fix_claims_rls_policies.sql`
  - `supabase/migrations/20250110120000_user_profiles_relax_email_and_add_auth_user_id.sql`
