# Job Parts Unique Constraint Documentation

## Overview

This document describes the unique constraint enforcement on the `job_parts` table to prevent duplicate rows for the same logical combination of job, product, vendor, and scheduling information.

## Migration

**File**: `supabase/migrations/20251218042008_job_parts_unique_constraint_vendor_time.sql`  
**Date**: December 18, 2025  
**Related**: PR #225 (separate scope but related job_parts work)

## What Duplicates Are Prevented

The unique constraint prevents duplicate `job_parts` rows with the same logical key:

```
(job_id, product_id, vendor_id, promised_date, scheduled_start_time, scheduled_end_time)
```

### Logical Key Components

| Column                 | Type        | Nullable | Description                                             |
| ---------------------- | ----------- | -------- | ------------------------------------------------------- |
| `job_id`               | UUID        | NO       | Foreign key to jobs table                               |
| `product_id`           | UUID        | NO       | Foreign key to products table                           |
| `vendor_id`            | UUID        | YES      | Foreign key to vendors table (per-line vendor override) |
| `promised_date`        | DATE        | YES      | Promised completion date for this line item             |
| `scheduled_start_time` | TIMESTAMPTZ | YES      | Scheduled start time window                             |
| `scheduled_end_time`   | TIMESTAMPTZ | YES      | Scheduled end time window                               |

### NULL Handling

The constraint handles NULL values safely using one of two approaches depending on PostgreSQL version:

- **PostgreSQL 15+**: Uses `NULLS NOT DISTINCT` clause, which treats NULL values as equal for uniqueness purposes
- **PostgreSQL <15**: Uses `COALESCE` with sentinel values:
  - `vendor_id`: `'00000000-0000-0000-0000-000000000000'::uuid`
  - `promised_date`: `'1970-01-01'::date`
  - `scheduled_start_time`: `'1970-01-01 00:00:00+00'::timestamptz`
  - `scheduled_end_time`: `'1970-01-01 00:00:00+00'::timestamptz`

## Index Details

**Index Name**: `job_parts_unique_job_product_vendor_time` (exact)

**Type**: UNIQUE INDEX

**Columns** (in order):

1. `job_id`
2. `product_id`
3. `vendor_id` (with NULL handling)
4. `promised_date` (with NULL handling)
5. `scheduled_start_time` (with NULL handling)
6. `scheduled_end_time` (with NULL handling)

## Deduplication Strategy

When the migration runs, it removes existing duplicates using the following logic:

1. **Partition** rows by the logical key
2. **Order** within each partition by:
   - `created_at DESC` (keep newest)
   - `id ASC` (break ties by lowest id)
3. **Keep** the first row in each partition (ROW_NUMBER = 1)
4. **Delete** all other rows (ROW_NUMBER > 1)

This ensures that the **newest** row (by `created_at`) is preserved, with deterministic tie-breaking.

## Verification

### Check for Duplicates

Run this query to verify there are no duplicate rows:

```sql
-- Should return 0 rows
SELECT
  job_id,
  product_id,
  COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid) AS vendor_id_norm,
  promised_date,
  scheduled_start_time,
  scheduled_end_time,
  COUNT(*) AS dup_count
FROM public.job_parts
GROUP BY
  job_id,
  product_id,
  COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
  promised_date,
  scheduled_start_time,
  scheduled_end_time
HAVING COUNT(*) > 1;
```

**Expected Result**: 0 rows (no duplicates)

### Confirm Index Exists

Run this query to verify the index was created:

```sql
-- Should return 1 row with the index name
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'job_parts'
  AND indexname = 'job_parts_unique_job_product_vendor_time';
```

**Expected Result**: 1 row showing:

- `schemaname`: `public`
- `tablename`: `job_parts`
- `indexname`: `job_parts_unique_job_product_vendor_time`
- `indexdef`: Full CREATE UNIQUE INDEX statement

### Count Total Job Parts

Sanity check to see total rows after cleanup:

```sql
SELECT COUNT(*) AS total_job_parts FROM public.job_parts;
```

## Rollback

If you need to remove the unique constraint, run:

```sql
DROP INDEX IF EXISTS public.job_parts_unique_job_product_vendor_time;
```

**WARNING**: This will allow duplicate rows to be inserted again. Only rollback if you have a specific reason and understand the implications.

### Rollback Migration File

To create a rollback migration, add a new timestamped file:

```sql
-- supabase/migrations/YYYYMMDDHHMMSS_rollback_job_parts_unique_constraint.sql
DROP INDEX IF EXISTS public.job_parts_unique_job_product_vendor_time;
```

## Impact on Application Code

### Writes

Any application code that inserts or updates `job_parts` rows must ensure the logical key is unique. Violations will result in a PostgreSQL error:

```
ERROR: duplicate key value violates unique constraint "job_parts_unique_job_product_vendor_time"
```

### Best Practices

1. **Before Insert**: Check if a row with the same logical key already exists
2. **Upsert Pattern**: Use `INSERT ... ON CONFLICT DO UPDATE` if you need to update existing rows
3. **Error Handling**: Catch unique constraint violations and handle gracefully (e.g., update instead of insert)

Example upsert pattern (PostgreSQL 15+):

```sql
INSERT INTO public.job_parts (
  job_id,
  product_id,
  vendor_id,
  promised_date,
  scheduled_start_time,
  scheduled_end_time,
  quantity_used,
  unit_price
) VALUES (
  $1, $2, $3, $4, $5, $6, $7, $8
)
ON CONFLICT (
  job_id,
  product_id,
  vendor_id,
  promised_date,
  scheduled_start_time,
  scheduled_end_time
) NULLS NOT DISTINCT
DO UPDATE SET
  quantity_used = EXCLUDED.quantity_used,
  unit_price = EXCLUDED.unit_price;
```

## Related Documentation

- [Job Parts Vendor Relationship Fix](./RUNBOOK_JOB_PARTS_VENDOR_FK.md)
- [ERD - Entity Relationship Diagram](./ERD.md)
- [RLS Policies](./policies.md)

## Maintenance

### Monitoring

Periodically check for attempted duplicate insertions by monitoring PostgreSQL logs for constraint violation errors.

### Performance

The unique index provides query performance benefits for lookups by the logical key, in addition to enforcing uniqueness.

## Questions or Issues

If you encounter problems with this constraint:

1. Check the migration logs for error messages
2. Verify the index exists using the verification queries above
3. Review application error logs for constraint violation errors
4. Consult the rollback section if you need to temporarily remove the constraint

## Changelog

| Date       | Change                                   | Author        |
| ---------- | ---------------------------------------- | ------------- |
| 2025-12-18 | Initial unique constraint implementation | Copilot Agent |
