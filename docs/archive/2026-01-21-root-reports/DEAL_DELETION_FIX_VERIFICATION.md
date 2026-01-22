# Deal Deletion Fix - Verification Guide

## Overview

This fix addresses deal deletion failures caused by overly restrictive/missing DELETE RLS policies on deal-related tables. The end state for this repo is: **any authenticated user in the same org can delete deals** (no role gating).

## Changes Made

### 1. Database Migrations (Required)

**Files:**

- `supabase/migrations/20251226220653_add_jobs_and_job_parts_delete_policies.sql` (manager-only DELETE for jobs/job_parts)
- `supabase/migrations/20251227090000_add_org_scoped_delete_policies.sql` (**org-scoped DELETE** for jobs/job_parts/transactions/communications)

The latest migration adds these RLS policies (additive):

- `org can delete jobs`
- `org can delete job_parts via jobs`
- `org can delete transactions`
- `org can delete communications via jobs`

Notes:

- Policies are additive (Postgres ORs policies for the same command), so leaving the existing manager-only DELETE policies in place is safe.
- All policies are tenant-scoped via `auth_user_org()` and/or parent job org checks.

### 2. Application Code Improvements

**File:** `src/services/dealService.js`

Enhanced `deleteDeal()` function to:

- Verify deal exists before attempting deletion (better error messages)
- Distinguish between "deal not found" vs "permission denied"
- Maintain existing cascade delete logic (no architectural changes)

### 3. Test Coverage

**File:** `src/tests/dealService.delete.test.js`

Added 7 comprehensive unit tests covering:

- Missing deal ID validation
- Deal not found scenarios
- Permission denied errors
- Successful deletions
- Missing optional tables
- Non-permission errors

## Automated Verification

### Run Tests

```bash
# Run all unit tests
pnpm test

# Run only deletion tests
pnpm test src/tests/dealService.delete.test.js
```

**Expected Result:** All tests should pass (7/7)

### Lint Check

```bash
pnpm lint
```

**Expected Result:** No errors (warnings in unrelated files are acceptable)

### Build Check

```bash
pnpm build
```

**Expected Result:** Build completes successfully with no errors

## Manual Verification (After Migrations)

### Prerequisites

1. **Apply migrations** to your Supabase database using the Supabase CLI:

   ```bash
   supabase db push
   ```

   Or manually run the migration SQL files in your Supabase SQL editor:
   - Open Supabase Dashboard → SQL Editor
   - Copy + execute the contents of:
     - `supabase/migrations/20251226220653_add_jobs_and_job_parts_delete_policies.sql`
     - `supabase/migrations/20251227090000_add_org_scoped_delete_policies.sql`

2. **Verify policies were created:**

   ```sql
    SELECT schemaname, tablename, policyname, cmd
    FROM pg_policies
    WHERE schemaname='public'
       AND policyname IN (
          'org can delete jobs',
          'org can delete job_parts via jobs',
          'org can delete transactions',
          'org can delete communications via jobs'
       )
    ORDER BY tablename, policyname;
   ```

   **Expected Result:** 4 rows (one per policy)

### Test Scenarios

#### Scenario 1: Any Org User Can Delete Deal (Success Case)

**Setup:**

1. Start the development server: `pnpm start`
2. Navigate to <http://localhost:5173>
3. Sign in with any authenticated user in the org

**Steps:**

1. Navigate to the Deals page
2. Find any existing deal or create a new test deal
3. Click the delete icon/button for the deal
4. Confirm the deletion in the modal

**Expected Result:**

- ✅ Deal is deleted successfully
- ✅ Success message appears (or deals list refreshes without the deleted deal)
- ✅ No "You do not have permission to delete deals." error

#### Scenario 2: Org Scoping Is Enforced (Different Org)

**Setup:**

1. Sign in with a user account that belongs to a different org than the target deal

**Steps:**

1. Attempt to delete a deal in another org

**Expected Result:**

- ✅ Delete fails due to org scoping (RLS)

#### Scenario 3: Deal Not Found (Edge Case)

**Setup:**

1. Sign in as manager/admin
2. Manually construct a URL or API call to delete a non-existent deal ID

**Steps:**

1. Attempt to delete a deal with ID that doesn't exist (e.g., via browser console):

   ```javascript
   // In browser console on deals page
   import { deleteDeal } from './services/dealService'
   await deleteDeal('00000000-0000-0000-0000-000000000000')
   ```

**Expected Result:**

- ✅ Error message: "Deal not found or you do not have access to it."
- ✅ NOT: "You do not have permission to delete deals."

#### Scenario 4: Cascade Deletion Verification

**Setup:**

1. Create a test deal with:
   - Line items (job_parts)
   - Transactions
   - Loaner assignment (if available)

**Steps:**

1. Note the deal ID
2. Delete the deal via UI
3. Verify child records are also deleted:

   ```sql
   -- Check no orphaned job_parts
   SELECT * FROM job_parts WHERE job_id = '<deleted-deal-id>';

   -- Check no orphaned transactions
   SELECT * FROM transactions WHERE job_id = '<deleted-deal-id>';

   -- Check no orphaned loaner_assignments
   SELECT * FROM loaner_assignments WHERE job_id = '<deleted-deal-id>';
   ```

**Expected Result:**

- ✅ All queries return 0 rows (all child records deleted)

### Browser Console Testing (Quick Verification)

Open the browser console on the Deals page and run:

```javascript
// Test delete with mock ID (should fail gracefully)
const testDeleteNonExistent = async () => {
  const { deleteDeal } = await import('./src/services/dealService.js')
  try {
    await deleteDeal('00000000-0000-0000-0000-000000000000')
  } catch (err) {
    console.log('Expected error:', err.message)
    // Should be "Deal not found..." not "permission denied..."
  }
}

testDeleteNonExistent()
```

## Rollback Plan (If Issues Occur)

### 1. Revert Code Changes

Revert the application code commit(s) that introduced the deletion behavior changes.

### 2. Remove Database Policies (Manual)

Run this SQL in Supabase SQL Editor:

```sql
-- Drop the org-scoped policies
DROP POLICY IF EXISTS "org can delete jobs" ON public.jobs;
DROP POLICY IF EXISTS "org can delete job_parts via jobs" ON public.job_parts;
DROP POLICY IF EXISTS "org can delete transactions" ON public.transactions;
DROP POLICY IF EXISTS "org can delete communications via jobs" ON public.communications;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

## Performance Impact

- **Minimal:** RLS policy checks are indexed and cached
- **No schema changes:** Only added policies, no columns or indexes modified
- **No data migration:** No existing data is modified

## Security Impact

- **Intentional broadening:** Any authenticated org member can delete deals.
- **Org-scoped:** Policies enforce org isolation.

## Common Issues & Troubleshooting

### Issue: "You do not have permission to delete deals." still appears

**Possible Causes:**

1. Migration not applied yet
2. User is not in the same org as the deal
3. Schema cache not reloaded

**Solutions:**

1. Verify migration was applied (check pg_policies)
2. Check user role: `SELECT role FROM user_profiles WHERE id = auth.uid();`
3. Reload schema cache: `NOTIFY pgrst, 'reload schema';`

### Issue: "Deal not found or you do not have access to it."

**Possible Causes:**

1. Deal doesn't exist
2. Deal belongs to different org than user
3. SELECT RLS policy blocking read access

**Solutions:**

1. Verify deal exists and org_id matches user's org_id
2. Check SELECT RLS policies on jobs table

## Success Criteria

- ✅ Any org member can delete deals without permission errors
- ✅ Org scoping is maintained (users can only delete deals in their org)
- ✅ Accurate error messages (not found vs permission denied)
- ✅ Cascade deletion works (child records deleted)
- ✅ All automated tests pass
- ✅ No build or lint errors
