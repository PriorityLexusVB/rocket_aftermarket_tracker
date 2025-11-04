# RLS Auth.Users Fix - Summary

## What Was Fixed

The "permission denied for table users" error occurred because the `is_admin_or_manager()` function referenced the `auth.users` table, which authenticated users cannot query due to RLS restrictions.

## Changes Made

### 1. New Migration
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

### 2. Documentation
**File:** `docs/RLS_AUTH_USERS_FIX.md`

Comprehensive documentation including:
- Problem explanation
- Root cause analysis
- Solution details
- Verification checklist
- Testing recommendations

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
