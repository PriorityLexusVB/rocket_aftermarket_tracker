# Implementation Summary: Job Parts Unique Constraint

**Date**: December 18, 2025  
**Branch**: `copilot/add-migration-guardrail-duplicate-job-parts`  
**Related**: PR #225 (separate scope but related job_parts work)

## Overview

Implemented a database-level guardrail to prevent duplicate `job_parts` rows by enforcing uniqueness on the logical key combination of job, product, vendor, and scheduling information.

## Changes Made

### 1. Migration File

**File**: `supabase/migrations/20251218042008_job_parts_unique_constraint_vendor_time.sql`

**Key Features**:

- **Deduplication**: Removes existing duplicates using CTE with ROW_NUMBER
  - Keeps newest row (highest `created_at`)
  - Breaks ties by lowest `id`
- **Unique Index**: Creates `job_parts_unique_job_product_vendor_time`
  - Logical key: (job_id, product_id, vendor_id, promised_date, scheduled_start_time, scheduled_end_time)
- **NULL Handling**: Version-aware approach
  - PostgreSQL 15+: Uses `NULLS NOT DISTINCT` clause
  - PostgreSQL <15: Uses `COALESCE` with sentinel values
- **Idempotency**: Checks for existing index before creation
- **Verification**: Built-in verification step to ensure success

**Migration Structure**:

```
STEP 1: Remove existing duplicates (keeping newest row)
STEP 2: Create unique index on logical key
STEP 3: Verification (check index exists, confirm no duplicates)
```

### 2. Documentation

**File**: `docs/db-lint/job_parts_unique_constraint.md`

**Contents**:

- Overview of the constraint
- Logical key components table
- NULL handling explanation
- Index details
- Deduplication strategy
- Verification queries (2 SQL snippets)
- Rollback instructions
- Application code impact guidance
- Maintenance notes
- Related documentation links

### 3. Test File

**File**: `src/tests/migration.job_parts_unique_constraint.test.js`

**Test Coverage** (10 test cases):

1. ✅ Contains deduplication logic with ROW_NUMBER
2. ✅ Creates unique index with exact name
3. ✅ Includes all logical key columns
4. ✅ Handles NULL vendor_id safely
5. ✅ Includes PostgreSQL version detection
6. ✅ Is idempotent with IF EXISTS checks
7. ✅ Includes verification step
8. ✅ Checks for duplicates after cleanup
9. ✅ References PR #225 in comments
10. ✅ Includes created_at column check

## Technical Details

### Logical Key

The unique constraint enforces uniqueness on this 6-column combination:

| Column               | Type        | Nullable | Purpose                  |
| -------------------- | ----------- | -------- | ------------------------ |
| job_id               | UUID        | NO       | Link to jobs table       |
| product_id           | UUID        | NO       | Link to products table   |
| vendor_id            | UUID        | YES      | Per-line vendor override |
| promised_date        | DATE        | YES      | Promised completion date |
| scheduled_start_time | TIMESTAMPTZ | YES      | Time window start        |
| scheduled_end_time   | TIMESTAMPTZ | YES      | Time window end          |

### NULL Handling Strategy

**PostgreSQL 15+**:

```sql
CREATE UNIQUE INDEX job_parts_unique_job_product_vendor_time
  ON public.job_parts (
    job_id, product_id, vendor_id,
    promised_date, scheduled_start_time, scheduled_end_time
  ) NULLS NOT DISTINCT;
```

**PostgreSQL <15**:

```sql
CREATE UNIQUE INDEX job_parts_unique_job_product_vendor_time
  ON public.job_parts (
    job_id, product_id,
    COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(promised_date, '1970-01-01'::date),
    COALESCE(scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz),
    COALESCE(scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz)
  );
```

### Deduplication Logic

```sql
WITH duplicates AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        job_id, product_id,
        COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
        promised_date, scheduled_start_time, scheduled_end_time
      ORDER BY
        created_at DESC,  -- Keep newest
        id ASC            -- Break ties by lowest id
    ) AS rn
  FROM public.job_parts
)
DELETE FROM public.job_parts
WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);
```

## Verification

### Post-Migration Checks

**1. Verify no duplicates remain**:

```sql
SELECT COUNT(*) FROM (
  SELECT
    job_id, product_id,
    COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    promised_date, scheduled_start_time, scheduled_end_time,
    COUNT(*) AS dup_count
  FROM public.job_parts
  GROUP BY
    job_id, product_id,
    COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
    promised_date, scheduled_start_time, scheduled_end_time
  HAVING COUNT(*) > 1
) AS duplicates;
```

**Expected**: 0

**2. Verify index exists**:

```sql
SELECT indexname
FROM pg_indexes
WHERE tablename = 'job_parts'
  AND indexname = 'job_parts_unique_job_product_vendor_time';
```

**Expected**: 1 row

## Rollback

If needed:

```sql
DROP INDEX IF EXISTS public.job_parts_unique_job_product_vendor_time;
```

## Impact

### Database

- ✅ Prevents duplicate job_parts insertions
- ✅ Improves data integrity
- ✅ Provides query performance benefits (unique index)

### Application Code

- ⚠️ Will fail if attempting to insert duplicate logical key
- ℹ️ Should use upsert pattern or check-before-insert
- ℹ️ Error: `duplicate key value violates unique constraint "job_parts_unique_job_product_vendor_time"`

### Performance

- ✅ Minimal overhead (unique index already helps with lookups)
- ✅ Deduplication runs once during migration

## Related Work

- **PR #225**: Related job_parts work (separate scope)
- **Migration 20251212190000**: Earlier job_parts dedupe attempt (different approach)
- **Migration 20251212200000**: Earlier unique index attempt (simpler version)

## Status

✅ **COMPLETE**

- [x] Migration file created
- [x] Documentation written
- [x] Test file added
- [x] All requirements met
- [x] PR description updated with verification snippets
- [x] No app-layer code changes
- [x] No RLS changes
- [x] Migration-only (plus docs and tests)

## Next Steps

1. Review PR and merge when approved
2. Apply migration to staging/production
3. Run verification queries post-migration
4. Monitor application logs for constraint violations
5. Update app code to handle duplicates gracefully (if needed)

## Files Changed

```
supabase/migrations/20251218042008_job_parts_unique_constraint_vendor_time.sql
docs/db-lint/job_parts_unique_constraint.md
src/tests/migration.job_parts_unique_constraint.test.js
```

## Commit History

```
30b081c Add job_parts unique constraint migration and documentation
  - Created migration 20251218042008 to enforce uniqueness on job_parts logical key
  - Deduplication keeps newest row (highest created_at, break ties by lowest id)
  - Unique index name: job_parts_unique_job_product_vendor_time
  - Handles NULL vendor_id safely with PostgreSQL version detection
  - Migration is idempotent with IF EXISTS checks
  - Added comprehensive documentation to docs/db-lint/
  - Added test file following existing migration test patterns
```
