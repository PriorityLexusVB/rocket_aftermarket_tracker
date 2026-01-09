# Database Function Hardening Summary

**Date**: 2025-12-10  
**Purpose**: Harden SECURITY DEFINER functions and cleanup/validation logic for improved safety  
**Migrations**: 20251210173000 through 20251210173300

---

## Overview

This hardening effort addresses safety concerns in database functions identified through Supabase AI audit, focusing on:

1. **Permission tightening** for high-risk SECURITY DEFINER functions
2. **NOT IN → NOT EXISTS** conversion to handle NULL values correctly
3. **Sequence verification** and generator function error handling
4. **SELECT \* elimination** and NULL guard additions

All changes follow strict guardrails:

- ✅ No destructive SQL executed directly
- ✅ All changes via timestamped migrations under `supabase/migrations/`
- ✅ No schema changes (only function logic updates)
- ✅ Rollback plans documented in each migration file

---

## Phase 1: EXECUTE Permission Tightening

**Migration**: `20251210173000_harden_security_definer_permissions.sql`

### Changes

Revoked broad EXECUTE permissions from high-risk SECURITY DEFINER functions:

| Function                               | Risk Level | Previous Access             | New Access | Rationale                              |
| -------------------------------------- | ---------- | --------------------------- | ---------- | -------------------------------------- |
| `cleanup_orphaned_profiles()`          | High       | public, anon, authenticated | Revoked    | Deletes user_profiles; admin-only      |
| `cleanup_illegitimate_users()`         | High       | public, anon, authenticated | Revoked    | Bulk deletes across tables; admin-only |
| `cleanup_priority_automotive_admins()` | High       | public, anon, authenticated | Revoked    | Deletes from auth.users; admin-only    |
| `delete_job_cascade(uuid)`             | High       | authenticated               | Revoked    | Cascading deletes; needs RLS check     |
| `create_user_with_profile(...)`        | High       | public, anon, authenticated | Revoked    | Inserts auth.users; admin-only         |

### Impact

- **Application**: No immediate impact if these functions aren't called via PostgREST API
- **Admin Tools**: Functions still work with proper role/context
- **Rollback**: See migration header for GRANT statements to restore previous permissions

### Rationale

These functions are SECURITY DEFINER (run with elevated privileges) and perform destructive or sensitive operations. They should only be:

- Called by admin tooling with explicit permission
- Invoked via trusted server-side logic (not client API)
- Used in maintenance scripts or migrations

---

## Phase 2: Cleanup Functions - NOT IN → NOT EXISTS

**Migration**: `20251210173100_fix_cleanup_functions_not_in_patterns.sql`

### Problem

`NOT IN` with subqueries can fail silently when NULL values are present:

```sql
-- UNSAFE: Returns no rows if any auth.users.id is NULL
DELETE FROM user_profiles
WHERE id NOT IN (SELECT id FROM auth.users);

-- SAFE: Handles NULLs correctly
DELETE FROM user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au WHERE au.id = up.id
);
```

### Functions Updated

#### 1. `cleanup_orphaned_profiles()`

**Before**: Used `NOT IN` pattern  
**After**: Uses `NOT EXISTS` with explicit correlation

```sql
DELETE FROM public.user_profiles up
WHERE NOT EXISTS (
  SELECT 1 FROM auth.users au WHERE au.id = up.id
);
```

**Benefits**:

- Handles NULL values correctly (no false negatives)
- Often faster execution (better query plan)
- More explicit correlation (easier to understand)

#### 2. `cleanup_illegitimate_users()`

**Before**: Used `NOT IN` patterns in dependency checks  
**After**: Uses array-based deletion with `ANY()` (NULL-safe)

**Improvements**:

- Collects user IDs into array first (explicit list)
- Uses `= ANY(array)` for deletions (NULL-safe)
- Added proper array length validation
- Improved logging with counts

#### 3. `cleanup_priority_automotive_admins()`

**Before**: Array-based but lacked NULL checks  
**After**: Added explicit NULL/empty array checks

**Improvements**:

- Validates array is not NULL before use
- Checks array length before deletion
- Provides clear notice when no users found
- Better error messages on foreign key violations

### Rollback

Each function's original definition is preserved in its source migration file (noted in header).

---

## Phase 3: Sequences & Generator Functions

**Migration**: `20251210173200_harden_sequences_and_generators.sql`

### Changes

#### 1. Sequence Verification

Ensured required sequences exist:

```sql
CREATE SEQUENCE IF NOT EXISTS public.job_number_seq
  START WITH 1000
  INCREMENT BY 1
  NO CYCLE;

CREATE SEQUENCE IF NOT EXISTS public.transaction_number_seq
  START WITH 1001
  INCREMENT BY 1
  NO CYCLE;
```

**NO CYCLE** ensures sequences fail explicitly when exhausted (no silent wraparound).

#### 2. `generate_job_number()` Hardening

**Before**: Simple SQL function with no error handling

```sql
SELECT 'JOB-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' ||
  LPAD(NEXTVAL('job_number_seq')::TEXT, 6, '0');
```

**After**: PL/pgSQL function with explicit validation

```sql
DECLARE
  seq_value BIGINT;
BEGIN
  seq_value := NEXTVAL('public.job_number_seq');

  IF seq_value IS NULL THEN
    RAISE EXCEPTION 'job_number_seq returned NULL';
  END IF;

  -- Build and validate job number
  -- ...

  IF job_number IS NULL OR LENGTH(job_number) < 16 THEN
    RAISE EXCEPTION 'Generated invalid job number: %', job_number;
  END IF;

  RETURN job_number;
END;
```

**Benefits**:

- Detects sequence corruption
- Validates output format
- Raises clear errors (no silent failures)
- Consistent TEXT return type

#### 3. `generate_transaction_number()` Hardening

Same improvements as `generate_job_number()`:

- NULL checks on sequence value
- Output validation (length, format)
- Clear error messages

#### 4. Diagnostic Helper

Added `check_sequence_health()` function for monitoring:

```sql
SELECT * FROM public.check_sequence_health();
```

Returns:

- Current sequence value
- Max value
- Usage percentage
- Whether cycling is enabled

Granted to `authenticated` role (read-only diagnostic).

### Rollback

Revert to original SQL-based functions from `20250922170950_automotive_aftermarket_system.sql`.

---

## Phase 4: Targeted Logic Safety

**Migration**: `20251210173300_fix_function_select_star_and_null_checks.sql`

### Changes

#### 1. `validate_deal_line_items()` - SELECT \* Elimination

**Problem**: `SELECT * INTO record` breaks when table schema changes

**Before**:

```sql
SELECT * INTO job_record FROM public.jobs WHERE id = NEW.job_id;
-- No NULL check
IF job_record.vendor_id IS NOT NULL THEN ...
```

**After**:

```sql
SELECT
  j.id,
  j.vendor_id,
  j.scheduled_start_time,
  j.service_type,
  j.org_id
INTO job_record
FROM public.jobs j
WHERE j.id = NEW.job_id;

IF NOT FOUND OR job_record.id IS NULL THEN
  RAISE EXCEPTION 'Job % not found', NEW.job_id;
END IF;
```

**Benefits**:

- Explicit column list (schema-change resilient)
- NOT FOUND check catches missing records
- Clear error messages with context
- Only fetches needed columns (performance)

#### 2. `auto_enqueue_status_sms()` - NULL-Safe Timestamp Formatting

**Problem**: Calling `TO_CHAR()` on NULL timestamps causes errors

**Before**:

```sql
to_char(NEW.scheduled_start_time AT TIME ZONE 'America/New_York', 'Mon DD')
-- Crashes if scheduled_start_time is NULL
```

**After**:

```sql
IF NEW.scheduled_start_time IS NOT NULL THEN
  scheduled_start := TO_CHAR(
    NEW.scheduled_start_time AT TIME ZONE 'America/New_York',
    'Mon DD'
  );
ELSE
  scheduled_start := 'TBD';
END IF;

-- Use COALESCE for inline fallbacks
'TIME', COALESCE(
  TO_CHAR(NEW.scheduled_start_time AT TIME ZONE 'America/New_York', 'HH12:MI AM'),
  'TBD'
)
```

**Benefits**:

- No crashes on NULL timestamps
- Graceful degradation (shows 'TBD' instead)
- Function doesn't break job status updates
- Better user experience (partial data still works)

#### 3. `set_deal_dates_and_calendar()` - NULL Guards

**Improvements**:

- NULL check before setting `promised_date`
- NULL check before generating `calendar_event_id`
- Safe timestamp extraction with EXTRACT (not vulnerable to NULL)

### Rollback

Revert to original functions from `20250103200000_enhance_deal_management.sql` and `20241231000000_calendar_first_sms_system.sql`.

---

## Testing & Verification

### Recommended Tests

#### 1. Permission Verification

```sql
-- Verify cleanup functions are not callable by authenticated users
SELECT current_user;
-- Should fail with permission denied:
SELECT public.cleanup_orphaned_profiles();
```

#### 2. Cleanup Function Tests

```sql
-- Test cleanup_orphaned_profiles with NULL scenario
-- (Create test data with auth.users having NULL id - should not break)

-- Verify NOT EXISTS handles NULLs correctly
SELECT COUNT(*) FROM public.user_profiles up
WHERE NOT EXISTS (SELECT 1 FROM auth.users au WHERE au.id = up.id);
```

#### 3. Sequence Health Check

```sql
-- Check sequence status
SELECT * FROM public.check_sequence_health();

-- Test generator functions
SELECT public.generate_job_number();
SELECT public.generate_transaction_number();

-- Verify format consistency
SELECT
  public.generate_job_number() ~ '^JOB-[0-9]{4}-[0-9]{6}$' as job_format_valid,
  public.generate_transaction_number() ~ '^TXN-[0-9]{8}-[0-9]{4}$' as txn_format_valid;
```

#### 4. NULL Safety Tests

```sql
-- Test validate_deal_line_items with missing job
INSERT INTO job_parts (job_id, product_id, quantity_used)
VALUES ('00000000-0000-0000-0000-000000000000', NULL, 1);
-- Should raise: "Job ... not found"

-- Test auto_enqueue_status_sms with NULL scheduled times
UPDATE jobs
SET job_status = 'scheduled', scheduled_start_time = NULL
WHERE id = '<test_job_id>';
-- Should not crash, should log notice about missing phone/time
```

### Manual Verification

1. **Check function permissions**:

   ```sql
   SELECT
     p.proname,
     pg_catalog.pg_get_function_identity_arguments(p.oid) as args,
     p.prosecdef as is_security_definer
   FROM pg_proc p
   JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'cleanup_orphaned_profiles',
       'cleanup_illegitimate_users',
       'delete_job_cascade',
       'generate_job_number'
     );
   ```

2. **Test job number generation** (via application):
   - Create new job/deal
   - Verify job_number format: `JOB-2025-NNNNNN`
   - Verify numbers increment correctly

3. **Test SMS enqueue** (if SMS system active):
   - Update job status with NULL scheduled_start_time
   - Verify no crashes
   - Check notification_outbox for queued SMS (should have 'TBD' fallbacks)

---

## Deferred Items / Known Limitations

### 1. Trigger Functions Still SECURITY DEFINER

Functions like `handle_new_user()`, `validate_user_legitimacy()`, and other trigger functions remain SECURITY DEFINER. This is necessary for:

- Cross-schema access (auth.users)
- Consistent execution context

**Mitigation**: Triggers fire automatically; no direct user invocation.

### 2. SMS Opt-Out Table Dependency

`auto_enqueue_status_sms()` assumes `public.sms_opt_outs` table exists. If missing, function will fail.

**Mitigation**: Migration includes existence check. Consider adding:

```sql
IF NOT EXISTS (SELECT 1 FROM information_schema.tables
               WHERE table_schema = 'public'
               AND table_name = 'sms_opt_outs') THEN
  RETURN NEW;
END IF;
```

### 3. No Application-Level Authorization

Revoking EXECUTE permissions prevents direct PostgREST calls, but application code calling these functions via service role will still work.

**Next Steps**:

- Add admin-only wrappers for cleanup functions
- Implement audit logging for sensitive function calls
- Consider adding RLS-like checks within functions (check `auth.uid()` role)

### 4. Sequence Exhaustion Handling

Sequences use `NO CYCLE`, so they'll fail when maxvalue is reached (default: 9223372036854775807).

**Monitoring**:

- Use `check_sequence_health()` to track usage
- Alert when usage_percent > 80%
- Plan for sequence reset strategy if needed (requires downtime)

---

## Rollback Plans

### Full Rollback (Undo All Changes)

```sql
-- Phase 1: Re-grant permissions
GRANT EXECUTE ON FUNCTION public.cleanup_orphaned_profiles() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_illegitimate_users() TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_priority_automotive_admins() TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_job_cascade(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_user_with_profile(text, text, text, user_role, text) TO authenticated;

-- Phase 2-4: Revert function definitions
-- Run the original CREATE OR REPLACE FUNCTION statements from:
-- - 20250103210000_fix_user_profiles_auth_integration.sql
-- - 20250113190000_final_staff_cleanup_delivery_finance.sql
-- - 20250930235002_fix_priority_automotive_admin_authentication.sql
-- - 20250922170950_automotive_aftermarket_system.sql
-- - 20250103200000_enhance_deal_management.sql
-- - 20241231000000_calendar_first_sms_system.sql

-- Drop new diagnostic function
DROP FUNCTION IF EXISTS public.check_sequence_health();
```

### Partial Rollback (Phase-Specific)

See individual migration file headers for detailed rollback SQL.

---

## Performance Impact

### Positive

- `NOT EXISTS` often faster than `NOT IN` (better query plans)
- Explicit column lists reduce data transfer
- Early NULL checks prevent unnecessary processing

### Negligible

- PL/pgSQL overhead in generator functions (microseconds)
- Additional validation checks (worth the safety)

### None

- Trigger functions execute same logic (just safer)
- Sequence operations unchanged (just verified)

---

## Security Improvements Summary

| Category                 | Before                                                   | After                                  | Benefit                                    |
| ------------------------ | -------------------------------------------------------- | -------------------------------------- | ------------------------------------------ |
| **Function Permissions** | 5 high-risk functions callable by any authenticated user | Permissions revoked; admin-only access | Prevents accidental/malicious bulk deletes |
| **NULL Handling**        | NOT IN queries fail silently with NULLs                  | NOT EXISTS handles NULLs correctly     | Reliable cleanup operations                |
| **Error Detection**      | Silent failures in generators                            | Explicit exceptions with context       | Early detection of sequence issues         |
| **Schema Stability**     | SELECT \* breaks on schema changes                       | Explicit columns + NULL checks         | Resilient to migrations                    |
| **Timestamp Safety**     | Crashes on NULL timestamps                               | Graceful fallbacks (TBD)               | Functions don't break operations           |

---

## Maintenance Notes

### When Adding New Functions

1. **Default to NOT SECURITY DEFINER** unless cross-schema access required
2. **Revoke EXECUTE permissions** immediately after creation for sensitive functions
3. **Use explicit column lists** (never SELECT \*)
4. **Add NULL checks** for all external inputs
5. **Document rollback** in migration header

### When Modifying Existing Functions

1. **Check current permissions** before changes
2. **Test with NULL values** explicitly
3. **Verify dependent code** (application, triggers)
4. **Update this document** with changes

### Monitoring

- Run `check_sequence_health()` monthly
- Review function execution logs for errors
- Monitor `RAISE NOTICE` messages in application logs

---

## References

- **Guardrails**: `.github/copilot-instructions.md` sections 2, 5, 6, 7, 20.7
- **Original Issue**: GitHub issue describing hardening requirements
- **Migration Files**: `supabase/migrations/20251210173*.sql`

---

## Summary

This hardening effort improves database function safety without breaking existing functionality:

✅ **Permissions tightened** on 5 high-risk SECURITY DEFINER functions  
✅ **NOT IN patterns replaced** with NULL-safe NOT EXISTS in 3 cleanup functions  
✅ **Sequences verified** and generator functions hardened with error handling  
✅ **SELECT \* eliminated** from validation functions with explicit columns + NULL checks  
✅ **All changes via migrations** with documented rollback plans  
✅ **No schema modifications** - only function logic improvements

The database is now more resilient to:

- NULL values in subqueries
- Schema changes
- Missing/malformed data
- Sequence corruption
- Accidental API access to destructive functions

**Next Steps**: Deploy migrations to staging, run verification queries, monitor logs for 48 hours, then promote to production.
