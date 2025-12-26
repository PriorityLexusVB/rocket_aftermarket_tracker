# Deal Deletion Fix - Verification Guide

## Overview
This fix addresses the issue where managers were incorrectly getting "You do not have permission to delete deals." errors when attempting to delete deals. The root cause was missing DELETE RLS policies on the `jobs` and `job_parts` tables.

## Changes Made

### 1. Database Migration (Required)
**File:** `supabase/migrations/20251226220653_add_jobs_and_job_parts_delete_policies.sql`

Added two new RLS policies:
- `managers can delete jobs` - Allows managers/admins to delete jobs in their org
- `managers can delete job_parts via jobs` - Allows managers/admins to delete job_parts for jobs in their org

Both policies use:
- `is_admin_or_manager()` function to check user role
- `auth_user_org()` function to verify org scoping

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

## Manual Verification (After Migration)

### Prerequisites
1. **Apply the migration** to your Supabase database using the Supabase CLI:
   ```bash
   supabase db push
   ```
   
   Or manually run the migration SQL file in your Supabase SQL editor:
   - Open Supabase Dashboard → SQL Editor
   - Copy contents of `supabase/migrations/20251226220653_add_jobs_and_job_parts_delete_policies.sql`
   - Execute the migration

2. **Verify policies were created:**
   ```sql
   -- Check jobs DELETE policy
   SELECT * FROM pg_policies 
   WHERE schemaname='public' 
   AND tablename='jobs' 
   AND policyname='managers can delete jobs';
   
   -- Check job_parts DELETE policy
   SELECT * FROM pg_policies 
   WHERE schemaname='public' 
   AND tablename='job_parts' 
   AND policyname='managers can delete job_parts via jobs';
   ```
   
   **Expected Result:** Both queries should return 1 row each

### Test Scenarios

#### Scenario 1: Manager Can Delete Deal (Success Case)
**Setup:**
1. Start the development server: `pnpm start`
2. Navigate to http://localhost:5173
3. Sign in with a user account that has role='manager' or role='admin'

**Steps:**
1. Navigate to the Deals page
2. Find any existing deal or create a new test deal
3. Click the delete icon/button for the deal
4. Confirm the deletion in the modal

**Expected Result:**
- ✅ Deal is deleted successfully
- ✅ Success message appears (or deals list refreshes without the deleted deal)
- ✅ No "You do not have permission to delete deals." error

#### Scenario 2: Non-Manager Cannot Delete (If UI Allows)
**Setup:**
1. Sign in with a user account that has role='staff' or other non-manager role

**Steps:**
1. Navigate to the Deals page
2. Check if delete button is visible

**Expected Result:**
- ✅ Delete button should be hidden/disabled for non-managers
- ✅ If somehow triggered, should receive "You do not have permission to delete deals." error

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
```bash
git revert 5ea13c8  # Revert the commit
git push origin copilot/fix-deal-deletion-permission-error
```

### 2. Remove Database Policies (Manual)
Run this SQL in Supabase SQL Editor:
```sql
-- Drop the added policies
DROP POLICY IF EXISTS "managers can delete jobs" ON public.jobs;
DROP POLICY IF EXISTS "managers can delete job_parts via jobs" ON public.job_parts;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
```

## Performance Impact
- **Minimal:** RLS policy checks are indexed and cached
- **No schema changes:** Only added policies, no columns or indexes modified
- **No data migration:** No existing data is modified

## Security Impact
- **Improved:** More granular control over delete operations
- **Org-scoped:** Policies enforce org isolation even for admins
- **Role-based:** Only manager/admin roles can delete (consistent with other delete policies)

## Common Issues & Troubleshooting

### Issue: "You do not have permission to delete deals." still appears
**Possible Causes:**
1. Migration not applied yet
2. User profile role is not 'manager' or 'admin'
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
- ✅ Managers can delete deals without permission errors
- ✅ Non-managers cannot delete deals (UI prevents + server enforces)
- ✅ Accurate error messages (not found vs permission denied)
- ✅ Cascade deletion works (child records deleted)
- ✅ All automated tests pass
- ✅ No build or lint errors
- ✅ Org scoping is maintained (users can only delete deals in their org)
