# E2E Profile UPSERT Fix (Dec 22, 2025)

## Issue
After adding the organization association fix in commit 957b57b, E2E tests were STILL timing out at `deal-edit.spec.ts:8` (product dropdown wait).

## Root Cause Analysis

### The UPDATE Problem
The previous fix used:
```sql
update public.user_profiles
set org_id = '00000000-0000-0000-0000-0000000000e2'
where email = $E2E_EMAIL$;
```

**This failed because:**
1. `user_profiles` table has `id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE`
2. Profile rows must be explicitly created with the auth user's ID
3. When a user first authenticates, Supabase creates an `auth.users` entry
4. But `user_profiles` is a separate table - rows aren't auto-created
5. The UPDATE statement affected 0 rows if no profile existed yet
6. Test user had no org_id → RLS blocked all queries → empty dropdowns

### Why It Seemed Like It Should Work
- The test authenticates (creates `auth.users` entry)
- Application might create `user_profiles` entries on first login
- But in E2E environment, profile might not exist before seed runs
- Timing race condition: seed runs before profile is created

## Solution

### Changed from UPDATE to UPSERT

**File**: `scripts/sql/seed_e2e.sql` (lines 31-42)

```sql
-- Before (UPDATE only - fails if no profile exists):
update public.user_profiles
set org_id = '00000000-0000-0000-0000-0000000000e2'
where email = $E2E_EMAIL$;

-- After (UPSERT - creates profile if missing):
insert into public.user_profiles (id, email, full_name, role, org_id, is_active)
select 
  id, 
  email,
  coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) as full_name,
  'staff' as role,
  '00000000-0000-0000-0000-0000000000e2' as org_id,
  true as is_active
from auth.users
where email = $E2E_EMAIL$
on conflict (id) do update 
set org_id = excluded.org_id,
    is_active = excluded.is_active;
```

### How UPSERT Works
1. **SELECT FROM auth.users**: Finds the authenticated user's ID and metadata by email
2. **INSERT INTO user_profiles**: Creates profile with:
   - `id`: From auth.users (satisfies FK constraint)
   - `email`: From auth.users
   - `full_name`: Extracted from user metadata (or falls back to email)
   - `role`: 'staff' (standard test user role)
   - `org_id`: E2E org UUID
   - `is_active`: true
3. **ON CONFLICT (id) DO UPDATE**: If profile already exists, just update org_id and is_active
4. **Result**: Profile guaranteed to exist with correct org association

### Added Verification Logging

**File**: `scripts/seedE2E.js`

```javascript
// After seeding, verify the profile was created/updated
const result = await client.query(
  `SELECT id, email, org_id, full_name FROM public.user_profiles WHERE email = $1`,
  [e2eEmail]
)

if (result.rows.length > 0) {
  const profile = result.rows[0]
  console.log(`[seedE2E] ✅ Seed applied successfully.`)
  console.log(`[seedE2E] Test user profile:`)
  console.log(`[seedE2E]   Email: ${profile.email}`)
  console.log(`[seedE2E]   Name: ${profile.full_name}`)
  console.log(`[seedE2E]   Org ID: ${profile.org_id}`)
  console.log(`[seedE2E]   Profile ID: ${profile.id}`)
} else {
  console.warn(`[seedE2E] ⚠️ Warning: User profile for ${e2eEmail} was not found after seeding.`)
  console.warn(`[seedE2E] The user may not exist in auth.users yet.`)
}
```

## Technical Details

### Why user_profiles Rows Aren't Auto-Created
```sql
-- Schema from 20250922170950_automotive_aftermarket_system.sql:
CREATE TABLE public.user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL UNIQUE,
    full_name TEXT NOT NULL,
    ...
);
```

- Foreign key references `auth.users(id)` but has no trigger to auto-create
- Application code or manual SQL must create profiles
- In E2E environment, profile creation timing is unpredictable

### RLS Policy Example
```sql
-- From migrations: Only show products in user's org
CREATE POLICY "products_select_policy" 
ON public.products FOR SELECT
USING (
  org_id = (SELECT org_id FROM public.user_profiles WHERE id = auth.uid())
);
```

**If user_profiles row doesn't exist:**
- Subquery returns NULL
- `NULL = 'org-uuid'` is FALSE
- All rows filtered out
- Empty dropdown

## Verification

### Expected Seed Output
```
[seedE2E] ✅ Seed applied successfully.
[seedE2E] Test user profile:
[seedE2E]   Email: test@example.com
[seedE2E]   Name: Test User
[seedE2E]   Org ID: 00000000-0000-0000-0000-0000000000e2
[seedE2E]   Profile ID: 12345678-1234-1234-1234-123456789abc
```

### Expected Test Behavior
- Test navigates to `/deals/new`
- Product dropdown waits up to 30s for options to appear
- Dropdown populates with E2E Product 1, E2E Product 2
- Test selects a product and continues
- Test completes within 120s total timeout

### Failure Indicators
If seed shows:
```
[seedE2E] ⚠️ Warning: User profile for test@example.com was not found after seeding.
[seedE2E] The user may not exist in auth.users yet.
```

**Meaning**: E2E_EMAIL doesn't match any user in `auth.users` table.

**Causes**:
1. User hasn't authenticated yet (no auth entry created)
2. E2E_EMAIL doesn't match the actual test user email
3. Auth user was deleted but tests still reference it

**Fix**:
1. Ensure user with E2E_EMAIL exists in Supabase Auth
2. Or update E2E_EMAIL to match an existing user
3. Check Supabase Dashboard → Authentication → Users

## Related Changes
- Commit 957b57b: Initial org association fix (UPDATE only)
- This commit: Changed to UPSERT with verification logging

## Rollback
If this causes issues, revert to UPDATE-only approach:

```sql
-- Revert to simple UPDATE (assumes profile exists):
update public.user_profiles
set org_id = '00000000-0000-0000-0000-0000000000e2'
where email = $E2E_EMAIL$;
```

Remove verification query from `scripts/seedE2E.js`.

**Note**: Original issue will return if profiles don't exist yet.

## Prevention
- Always use INSERT...ON CONFLICT for test fixtures that depend on auth users
- Verify FK constraints and table relationships in seed scripts
- Add verification queries after critical data setup
- Log seed results for debugging CI failures
- Document auth dependencies in test setup guides
