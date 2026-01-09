# Supabase Migration CI Fix Summary

## Issue Analysis

The Supabase migration CI failed on migration `20251126161701_move_pg_trgm_extension.sql` with the error:

```
ERROR: cannot drop extension pg_trgm because other objects depend on it (SQLSTATE 2BP01)
```

This occurred because the migration tried to drop the `pg_trgm` extension while trigram indexes were still dependent on it.

## Root Cause

The migration attempted to:

1. Drop `pg_trgm` extension from the `public` schema
2. Recreate it in the `extensions` schema
3. Recreate the dependent indexes

However, it failed at step 1 because PostgreSQL prevents dropping an extension when other objects depend on it.

## Fix Applied

Modified `supabase/migrations/20251126161701_move_pg_trgm_extension.sql` to:

1. **STEP 2**: Drop all dependent trigram indexes first:
   - `idx_user_profiles_department_trgm`
   - `idx_jobs_title_trgm`
   - `idx_jobs_job_number_trgm`
   - `idx_vendors_name_trgm`
   - `idx_vehicles_make_trgm`
   - `idx_vehicles_model_trgm`
   - `idx_vehicles_vin_trgm`
   - `idx_products_name_trgm`

2. **STEP 3**: Drop and recreate the extension safely
3. **STEP 5**: Recreate all the indexes using `extensions.gin_trgm_ops`

## Workflow Status

✅ **Dry-Run Workflow**: Already manually runnable via `workflow_dispatch`
✅ **Production Workflow**: Will apply migrations automatically on `main` branch push
✅ **Config**: `supabase/config.toml` already includes `extensions` in `extra_search_path`

## Next Steps

1. **Test the fix**: Run the dry-run workflow manually from GitHub Actions UI
2. **Validate migrations**: Ensure all pending migrations pass the dry-run
3. **Apply to production**: Push to main branch to trigger automatic migration
4. **Monitor**: Check that the `pg_trgm` extension is properly relocated to the `extensions` schema

## Validation Commands

After the migration applies successfully, you can validate with:

```sql
-- Check extension location
SELECT n.nspname as schema_name
FROM pg_extension e
JOIN pg_namespace n ON n.oid = e.extnamespace
WHERE e.extname = 'pg_trgm';

-- Count trigram indexes
SELECT COUNT(*) as trigram_index_count
FROM pg_indexes
WHERE schemaname = 'public'
AND indexdef LIKE '%gin_trgm_ops%';
```

Expected results:

- Extension should be in `extensions` schema
- All 8 trigram indexes should be recreated successfully

## Files Modified

- `supabase/migrations/20251126161701_move_pg_trgm_extension.sql` - Fixed dependency order

## Migration Safety

This fix is safe because:

- Uses `DROP INDEX IF EXISTS` for idempotency
- Uses `CREATE INDEX IF NOT EXISTS` for safe recreation
- Does not change any data, only indexes and extension location
- Maintains the same search functionality via `extensions` schema in search path
