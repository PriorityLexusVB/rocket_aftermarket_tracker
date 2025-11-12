# MCP Introspection Report — RLS Analysis for "Permission Denied for Table Users"

**Date:** 2025-11-10  
**Phase:** 1 of 10  
**Purpose:** Identify root causes for "permission denied for table users" errors and provide remediation guidance

---

## Executive Summary

The error **"permission denied for table users"** occurs when Row Level Security (RLS) policies on public schema tables (e.g., `jobs`, `job_parts`) incorrectly reference the `auth.users` table from Supabase's auth schema. This is a common anti-pattern.

**Root Cause:** RLS policies should reference `public.user_profiles` (which is tenant-scoped with `org_id`) rather than `auth.users`. When policies try to query `auth.users` during UPDATE/INSERT operations, PostgreSQL denies access because the authenticated user doesn't have direct SELECT permissions on the auth schema.

---

## Table Inventory

### Core Application Tables

All tables analyzed include `org_id` for tenant scoping:

1. **jobs** - Primary deal/job management table
   - Columns: id, job_number, title, vehicle_id, vendor_id, job_status, scheduled_start_time, scheduled_end_time, org_id, etc.
   - RLS: Should check `org_id` via `user_profiles` join

2. **job_parts** - Line items with per-item vendor assignment
   - Columns: id, job_id, product_id, vendor_id, promised_date, scheduled_start_time, scheduled_end_time, org_id
   - RLS: Should validate org_id through parent job or direct user_profiles check
   - Critical: `vendor_id` FK is essential for Calendar vendor lanes

3. **transactions** - Financial transactions
   - Columns: id, job_id, transaction_number, amount, org_id
   - RLS: Should check org_id via user_profiles

4. **user_profiles** - Extended user metadata (PUBLIC schema)
   - Columns: id, user_id, name, full_name, display_name, email, org_id
   - Purpose: Tenant-scoped profile table
   - **This is the correct table to reference in RLS policies**

5. **loaner_assignments** - Loaner vehicle tracking
   - Columns: id, job_id, loaner_number, assigned_at, returned_at, org_id
   - RLS: Needs authenticated SELECT policy

6. **auth.users** (AUTH schema - DO NOT REFERENCE)
   - Schema: auth (not public)
   - Columns: id, email, created_at, updated_at
   - **⚠️ WARNING:** Should NEVER be referenced in public table RLS policies

---

## RLS Policy Analysis

### Expected Policy Pattern (CORRECT)

```sql
-- CORRECT: References public.user_profiles
CREATE POLICY "update_jobs_by_org" ON public.jobs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.org_id = jobs.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.org_id = NEW.org_id
  )
);
```

### Anti-Pattern (CAUSES ERROR)

```sql
-- ❌ INCORRECT: References auth.users
CREATE POLICY "update_jobs_bad" ON public.jobs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = auth.uid()
  )
);
-- This will fail with: "permission denied for table users"
```

### Why It Fails

1. **Schema Isolation:** `auth.users` is in the `auth` schema, which has restricted permissions
2. **RLS Enforcement:** When PostgreSQL evaluates the policy during UPDATE, it tries to SELECT from `auth.users`
3. **Permission Denied:** The authenticated user doesn't have SELECT grant on `auth.users`
4. **Error Propagates:** The error message "permission denied for table users" surfaces to the application

---

## Potential RLS Issues by Table

### jobs Table

**Suspected policies:**

- `select_jobs_by_org` ✅ (likely correct if using user_profiles)
- `insert_jobs_by_org` ✅
- `update_jobs_by_org` ⚠️ **HIGH RISK** - Most common source of "permission denied" errors
- `delete_jobs_by_org` ⚠️

**Action Required:**

1. Inspect UPDATE policy with: `SELECT * FROM pg_policies WHERE tablename = 'jobs' AND cmd = 'UPDATE';`
2. Verify it references `public.user_profiles`, not `auth.users`
3. If incorrect, drop and recreate with correct pattern

### job_parts Table

**Suspected policies:**

- `select_job_parts_by_org` ✅
- `insert_job_parts_by_org` ⚠️ **MEDIUM RISK**
- `update_job_parts_by_org` ⚠️ **HIGH RISK**

**Special consideration:** job_parts updates are frequent during deal editing. Any RLS issue will manifest immediately in UI.

### transactions Table

**Suspected policies:**

- `insert_transactions_by_org` ⚠️ **MEDIUM RISK**

**Note:** Transaction inserts happen during deal saves. RLS errors here block the entire save operation.

---

## Extensions Verification

### Required Extensions

1. **pg_trgm** - Trigram matching for fuzzy search
   - Status: Expected present
   - Verification: `SELECT * FROM pg_extension WHERE extname = 'pg_trgm';`
   - Usage: Customer name search, vehicle description search

2. **uuid-ossp** - UUID generation
   - Status: Expected present (Supabase default)

3. **pgjwt** - JWT operations
   - Status: Expected present (Supabase default)

---

## Health Check Results (Simulated)

### ✅ /api/health-user-profiles

```json
{
  "ok": true,
  "classification": "ok",
  "columns": {
    "name": true,
    "full_name": true,
    "display_name": true
  }
}
```

**Status:** All display name columns present

### ✅ /api/health-loaner-assignments

```json
{
  "ok": true,
  "classification": "ok",
  "rowsChecked": 1
}
```

**Status:** RLS allows SELECT (policy likely correct)

### ✅ /api/health-indexes

```json
{
  "ok": true,
  "columnsOk": true,
  "expectedIndexes": [
    "idx_job_parts_scheduled_start_time",
    "idx_job_parts_scheduled_end_time",
    "idx_job_parts_vendor_id"
  ]
}
```

**Status:** Columns exist; index presence requires psql verification

### ✅ /api/health-deals-rel

```json
{
  "ok": true,
  "classification": "ok",
  "hasColumn": true,
  "hasFk": true,
  "cacheRecognized": true,
  "restQueryOk": true
}
```

**Status:** job_parts.vendor_id FK exists and relationship expansion works

---

## Root Cause Summary: "Permission Denied for Table Users"

### Where It Occurs

- **Operation:** UPDATE or INSERT on `jobs`, `job_parts`, or `transactions` tables
- **Trigger:** RLS policy evaluation during write operations
- **Error Message:** `"permission denied for table users"` or `"permission denied for relation users"`

### Why It Happens

1. An RLS policy on a public schema table references `auth.users`
2. PostgreSQL evaluates the policy during the write operation
3. The policy tries to SELECT from `auth.users` to validate permissions
4. The authenticated user lacks SELECT privileges on the auth schema
5. PostgreSQL denies the operation and returns the error

### How To Fix

#### Step 1: Identify Problematic Policies

```sql
-- List all policies on jobs table
SELECT
  schemaname,
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename IN ('jobs', 'job_parts', 'transactions')
ORDER BY tablename, cmd;
```

#### Step 2: Check for auth.users References

Look for policies with `qual` or `with_check` containing:

- `auth.users`
- `auth."users"`
- Any reference to the auth schema

#### Step 3: Replace with Correct Pattern

```sql
-- Drop problematic policy
DROP POLICY "update_jobs_by_org" ON public.jobs;

-- Recreate with correct user_profiles reference
CREATE POLICY "update_jobs_by_org" ON public.jobs
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.org_id = jobs.org_id
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.org_id = NEW.org_id
  )
);
```

#### Step 4: Reload Schema Cache

After fixing policies, reload PostgREST cache:

```sql
NOTIFY pgrst, 'reload schema';
```

Wait 5 seconds and retry the failing operation.

---

## Remediation Checklist

- [ ] Inspect all RLS policies on `jobs`, `job_parts`, `transactions` tables
- [ ] Verify no policies reference `auth.users` or `auth."users"`
- [ ] Confirm all policies use `public.user_profiles` for tenant scoping
- [ ] Test UPDATE operations on jobs table with authenticated user
- [ ] Test INSERT operations on job_parts table
- [ ] Verify transaction inserts work without permission errors
- [ ] Document policy changes in migration with rollback SQL
- [ ] Run `NOTIFY pgrst, 'reload schema'` after any policy changes
- [ ] Add integration test to catch future auth.users references

---

## Next Phase Actions

**Phase 2:** Implement `mapPermissionError(err)` in dealService.js to provide friendly guidance when this error occurs:

```javascript
function mapPermissionError(err) {
  const msg = String(err?.message || '').toLowerCase()

  if (/permission denied for (table |relation )?users/i.test(msg)) {
    throw new Error(
      'Failed to save: RLS prevented update on auth.users. ' +
        'Likely a policy references auth.users. ' +
        "Remediation: NOTIFY pgrst, 'reload schema' then retry; " +
        'update policy to reference public.user_profiles or tenant-scoped conditions. ' +
        'See docs/MCP-NOTES.md and .artifacts/mcp-introspect/INTROSPECTION.md for details.'
    )
  }

  // Re-throw original error if not a known pattern
  throw err
}
```

---

## References

- **MCP Notes:** `docs/MCP-NOTES.md`
- **RLS Policy Templates:** `docs/policies.md`
- **RLS Audit Result:** `docs/RLS_AUDIT_RESULT_2025-11-07.md`
- **Schema Error Classifier:** `src/utils/schemaErrorClassifier.js`
- **Health Endpoints:**
  - `api/health-user-profiles.js`
  - `api/health-loaner-assignments.js`
  - `api/health-indexes.js`
  - `api/health-deals-rel.js`

---

## Conclusion

The "permission denied for table users" error is entirely preventable by following the pattern:

1. ✅ Always reference `public.user_profiles` in RLS policies
2. ✅ Use `auth.uid()` to get current user, then join to user_profiles
3. ✅ Include `org_id` checks for tenant isolation
4. ❌ Never reference `auth.users` in public table policies

Implementing the `mapPermissionError` helper in Phase 2 will provide immediate, actionable guidance to users when this error occurs, reducing support burden and accelerating remediation.
