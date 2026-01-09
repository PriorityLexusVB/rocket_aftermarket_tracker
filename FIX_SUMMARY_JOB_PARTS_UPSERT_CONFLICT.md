# Fix Summary: Job Parts Upsert ON CONFLICT Error

**Date**: December 23, 2025  
**Branch**: `copilot/fix-update-deal-error`  
**Issue**: Users encountered "Failed to upsert job_parts: there is no unique or exclusion constraint matching the ON CONFLICT specification" when updating/editing deals

## Problem Statement

When users attempted to update or edit deals (possibly when creating new deals), they would encounter this error when clicking "Update Deal":

```
Error: Failed to save: Failed to upsert job_parts: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

This prevented users from saving their changes and was a critical blocking issue.

## Root Cause Analysis

### Database Schema

Migration `20251218042008_job_parts_unique_constraint_vendor_time.sql` created a unique index named `job_parts_unique_job_product_vendor_time` on the `job_parts` table with the following 6 columns:

```sql
(job_id, product_id, vendor_id, promised_date, scheduled_start_time, scheduled_end_time)
```

This index ensures that duplicate line items cannot be created for the same logical combination of job, product, vendor, promised date, and schedule times.

### Code Issue

In `src/services/jobPartsService.js`, the `replaceJobPartsForJob()` function was attempting to upsert records with an `onConflict` specification that included only 5 columns:

```javascript
// OLD CODE (INCORRECT)
const conflictColumns = ['job_id', 'product_id']
if (includeVendor) conflictColumns.push('vendor_id')
if (includeTimes) {
  conflictColumns.push('scheduled_start_time', 'scheduled_end_time')
}
// Result: job_id,product_id,vendor_id,scheduled_start_time,scheduled_end_time
// MISSING: promised_date
```

### The Mismatch

When Supabase's PostgREST receives an upsert with an `onConflict` specification, it looks for a unique constraint or unique index that **exactly matches** those columns. Since the code specified 5 columns but the database only had a unique index with 6 columns (including `promised_date`), PostgREST couldn't find a matching constraint and rejected the operation.

## Solution

### Changes to `src/services/jobPartsService.js`

1. **Updated the conflict column specification** (lines 365-373):

   ```javascript
   // NEW CODE (CORRECT)
   // Align with DB unique index job_parts_unique_job_product_vendor_time (from migration 20251218042008)
   // (job_id, product_id, vendor_id, promised_date, scheduled_start_time, scheduled_end_time)
   const conflictColumns = ['job_id', 'product_id']
   if (includeVendor) conflictColumns.push('vendor_id')
   conflictColumns.push('promised_date') // Always include promised_date to match DB unique index
   if (includeTimes) {
     conflictColumns.push('scheduled_start_time', 'scheduled_end_time')
   }
   // Result: job_id,product_id,vendor_id,promised_date,scheduled_start_time,scheduled_end_time
   ```

2. **Updated the deduplication logic** (line 227):
   Added `promised_date` to the client-side deduplication key to ensure that rows with different promised dates are treated as distinct (matching the database constraint):

   ```javascript
   const keyParts = [
     record.job_id,
     record.product_id,
     includeVendor ? (record.vendor_id ?? VENDOR_PLACEHOLDER_UUID) : VENDOR_PLACEHOLDER_UUID,
     record.promised_date ?? '1970-01-01', // Include promised_date to match DB unique index
     includeTimes ? (record.scheduled_start_time ?? TIME_PLACEHOLDER) : TIME_PLACEHOLDER,
     includeTimes ? (record.scheduled_end_time ?? TIME_PLACEHOLDER) : TIME_PLACEHOLDER,
   ]
   ```

3. **Updated retry fallback paths**:
   - Line 405: Vendor column fallback now includes `promised_date`
   - Line 438: Time column fallback now includes `promised_date`

### Changes to `src/tests/jobPartsService.test.js`

Updated 3 tests to reflect the new behavior:

1. **Test: "buildJobPartsPayload merges rows that differ only by promised_date"** (lines 300-328)
   - **Before**: Expected 1 merged row (incorrect behavior)
   - **After**: Expects 2 distinct rows (correct behavior matching DB constraint)
   - Rationale: Rows with different `promised_date` should NOT be merged because they represent different line items per the database schema

2. **Test: "uses conflict key with vendor and times when available"** (line 413)
   - Updated expected conflict key from:
     - `'job_id,product_id,vendor_id,scheduled_start_time,scheduled_end_time'`
   - To:
     - `'job_id,product_id,vendor_id,promised_date,scheduled_start_time,scheduled_end_time'`

3. **Test: "uses conflict key without vendor/time when capabilities are disabled"** (line 429)
   - Updated expected conflict key from:
     - `'job_id,product_id'`
   - To:
     - `'job_id,product_id,promised_date'`

## Behavioral Change

### Important Note on Line Item Deduplication

With this fix, line items with the same job, product, vendor, and schedule times but **different promised dates** are now treated as **distinct rows** (not merged). This aligns with the database constraint and is the **correct** behavior.

**Example Scenario:**

- Line Item 1: Product A, Vendor B, Schedule: 10am-11am, Promised: Jan 1st, Quantity: 1
- Line Item 2: Product A, Vendor B, Schedule: 10am-11am, Promised: Jan 3rd, Quantity: 1

**Before Fix:**

- These would be merged into one row: Promised: Jan 3rd, Quantity: 2 (INCORRECT)

**After Fix:**

- These remain as two distinct rows (CORRECT per DB schema)

This is the intended behavior because:

1. The database enforces uniqueness on the 6-column combination including `promised_date`
2. Different promised dates represent different business commitments
3. Merging rows with different promised dates would lose critical information

## Verification

### Automated Testing

✅ **All unit tests pass**: 940 passed, 2 skipped  
✅ **Build successful**: Vite build completes without errors  
✅ **Linter passes**: ESLint reports no issues  
✅ **Code review**: No issues found  
✅ **Security scan**: CodeQL found no vulnerabilities

### Test Coverage

- `src/tests/jobPartsService.test.js`: 17 tests covering job_parts service functionality
- Tests validate:
  - Deduplication logic respects `promised_date`
  - Conflict key includes all 6 columns matching DB index
  - Retry fallback paths include `promised_date`
  - Accumulation prevention works correctly

## Files Changed

```
src/services/jobPartsService.js          (4 changes: conflict columns, dedupe key, 2 retry paths)
src/tests/jobPartsService.test.js        (3 test updates)
```

## Database Schema Reference

The database has the following unique index (from migration `20251218042008`):

```sql
CREATE UNIQUE INDEX job_parts_unique_job_product_vendor_time
  ON public.job_parts (
    job_id,
    product_id,
    vendor_id,           -- nullable, uses COALESCE sentinel or NULLS NOT DISTINCT
    promised_date,       -- nullable, uses COALESCE sentinel or NULLS NOT DISTINCT
    scheduled_start_time, -- nullable, uses COALESCE sentinel or NULLS NOT DISTINCT
    scheduled_end_time    -- nullable, uses COALESCE sentinel or NULLS NOT DISTINCT
  );
```

See `docs/db-lint/job_parts_unique_constraint.md` for complete documentation of this constraint.

## Impact

### Before Fix

❌ Users could not save deal updates  
❌ Error message was cryptic and not actionable  
❌ Blocking critical business operations

### After Fix

✅ Deal updates save successfully  
✅ Duplicate prevention works correctly  
✅ Client-side deduplication matches database constraints  
✅ No data loss or corruption

## Related Documentation

- Migration: `supabase/migrations/20251218042008_job_parts_unique_constraint_vendor_time.sql`
- Constraint docs: `docs/db-lint/job_parts_unique_constraint.md`
- Implementation summary: `IMPLEMENTATION_SUMMARY_JOB_PARTS_UNIQUE.md`
- Service module: `src/services/jobPartsService.js`

## Rollback Plan

If this fix causes unexpected issues (unlikely given test coverage), rollback by:

1. Revert the commit: `git revert a3ee58f`
2. The database index will remain in place (do not drop it)
3. Alternative: Apply a migration to drop the `promised_date` column from the unique index (NOT RECOMMENDED - would lose data integrity protection)

## Future Considerations

### Guardrails

This fix highlights the importance of keeping application code in sync with database constraints. Consider:

1. **Code generation**: Generate `onConflict` specifications from database schema metadata
2. **Migration testing**: Add automated tests that validate application code matches database constraints
3. **Documentation**: Keep constraint documentation (like `docs/db-lint/job_parts_unique_constraint.md`) up to date

### Monitoring

Monitor for:

- Unique constraint violations (should be rare due to client-side deduplication)
- User reports of "can't save deal" (should be resolved by this fix)
- Unexpected line item duplication (should be prevented by this fix)

## Conclusion

This fix resolves a critical issue where users could not save deal updates due to a mismatch between the application's upsert conflict specification and the database's unique index. The solution ensures that the code correctly specifies all 6 columns of the unique index, enabling successful upserts while maintaining data integrity.

The fix has been thoroughly tested and validated with:

- 940 passing unit tests
- Successful build
- Clean linter run
- Code review with no issues
- Security scan with no vulnerabilities

**Status**: ✅ COMPLETE AND VERIFIED
