-- Performance Index Verification Script
-- Purpose: Verify that all performance indexes from migration 20251110023000 are created
-- Usage: npx supabase db query ./scripts/sql/verify_performance_indexes.sql
-- Date: 2025-11-10

\echo '========================================='
\echo 'Performance Index Verification Report'
\echo '========================================='
\echo ''

-- Check 1: Verify pg_trgm extension
\echo 'Check 1: pg_trgm Extension'
\echo '-----------------------------------------'
SELECT 
  extname AS extension_name,
  extversion AS version,
  'Enabled' AS status
FROM pg_extension 
WHERE extname = 'pg_trgm';

\echo ''
\echo 'Expected: 1 row showing pg_trgm extension'
\echo ''

-- Check 2: List all indexes on key tables
\echo 'Check 2: All Indexes on Key Tables'
\echo '-----------------------------------------'
SELECT 
  schemaname,
  tablename,
  indexname,
  CASE 
    WHEN indexdef LIKE '%USING gin%' THEN 'GIN (trigram)'
    WHEN indexdef LIKE '%btree%' THEN 'B-tree'
    ELSE 'Other'
  END AS index_type
FROM pg_indexes 
WHERE schemaname = 'public'
  AND tablename IN ('jobs', 'job_parts', 'vendors', 'vehicles', 'products', 'user_profiles', 'loaner_assignments')
ORDER BY tablename, indexname;

\echo ''
\echo 'Expected: Multiple rows showing indexes per table'
\echo ''

-- Check 3: Verify specific performance indexes
\echo 'Check 3: Critical Performance Indexes'
\echo '-----------------------------------------'
WITH expected_indexes AS (
  SELECT unnest(ARRAY[
    'idx_jobs_title_trgm',
    'idx_jobs_job_number_trgm',
    'idx_jobs_status_created',
    'idx_jobs_org_id',
    'idx_jobs_vehicle_id',
    'idx_jobs_assigned_to',
    'idx_job_parts_vendor_id',
    'idx_job_parts_job_id',
    'idx_job_parts_promised_sched',
    'idx_vendors_name_trgm',
    'idx_vehicles_make_trgm',
    'idx_vehicles_model_trgm',
    'idx_vehicles_vin_trgm',
    'idx_products_name_trgm',
    'idx_user_profiles_role_dept'
  ]) AS index_name
)
SELECT 
  e.index_name,
  CASE 
    WHEN i.indexname IS NOT NULL THEN '✓ EXISTS'
    ELSE '✗ MISSING'
  END AS status,
  COALESCE(i.tablename, 'N/A') AS table_name
FROM expected_indexes e
LEFT JOIN pg_indexes i ON i.indexname = e.index_name AND i.schemaname = 'public'
ORDER BY 
  CASE WHEN i.indexname IS NULL THEN 0 ELSE 1 END,
  e.index_name;

\echo ''
\echo 'Expected: All indexes show ✓ EXISTS'
\echo ''

-- Check 4: Index usage statistics
\echo 'Check 4: Index Usage Statistics (Top 10)'
\echo '-----------------------------------------'
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan AS scans,
  idx_tup_read AS tuples_read,
  idx_tup_fetch AS tuples_fetched,
  CASE 
    WHEN idx_scan = 0 THEN 'Unused'
    WHEN idx_scan < 100 THEN 'Low usage'
    WHEN idx_scan < 1000 THEN 'Moderate usage'
    ELSE 'High usage'
  END AS usage_level
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('jobs', 'job_parts', 'vendors', 'vehicles')
ORDER BY idx_scan DESC
LIMIT 10;

\echo ''
\echo 'Expected: Indexes showing scan counts (may be 0 if recently created)'
\echo ''

-- Check 5: Table statistics
\echo 'Check 5: Table Statistics'
\echo '-----------------------------------------'
SELECT 
  schemaname,
  relname AS table_name,
  n_live_tup AS row_count,
  n_dead_tup AS dead_rows,
  last_analyze,
  last_autoanalyze,
  CASE 
    WHEN last_analyze IS NULL AND last_autoanalyze IS NULL THEN 'Never analyzed'
    WHEN last_analyze > last_autoanalyze OR last_autoanalyze IS NULL THEN 'Manual analyze'
    ELSE 'Auto analyze'
  END AS analyze_method
FROM pg_stat_user_tables
WHERE schemaname = 'public'
  AND relname IN ('jobs', 'job_parts', 'vendors', 'vehicles', 'products')
ORDER BY n_live_tup DESC;

\echo ''
\echo 'Expected: All tables showing last_analyze or last_autoanalyze timestamp'
\echo ''

-- Check 6: Materialized view (optional)
\echo 'Check 6: Materialized View (Optional)'
\echo '-----------------------------------------'
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated,
  CASE 
    WHEN ispopulated THEN 'Ready'
    ELSE 'Needs REFRESH'
  END AS status
FROM pg_matviews
WHERE schemaname = 'public'
  AND matviewname = 'mv_overdue_jobs';

\echo ''
\echo 'Expected: 0 or 1 row (materialized view is optional)'
\echo ''

-- Check 7: Index sizes
\echo 'Check 7: Index Sizes (Top 10 Largest)'
\echo '-----------------------------------------'
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND tablename IN ('jobs', 'job_parts', 'vendors', 'vehicles')
ORDER BY pg_relation_size(indexrelid) DESC
LIMIT 10;

\echo ''
\echo 'Expected: Indexes showing reasonable sizes (varies by data volume)'
\echo ''

-- Summary
\echo '========================================='
\echo 'Verification Summary'
\echo '========================================='
\echo ''
\echo '1. pg_trgm extension should be enabled'
\echo '2. All critical indexes should exist (✓ EXISTS)'
\echo '3. Tables should have been analyzed (last_analyze timestamp)'
\echo '4. Index usage will accumulate over time'
\echo '5. Materialized view is optional (only if RPC is slow)'
\echo ''
\echo 'Next Steps:'
\echo '- If indexes are missing, run migration: npx supabase db push'
\echo '- If tables not analyzed, run: ANALYZE;'
\echo '- Monitor index usage over time via pg_stat_user_indexes'
\echo '- Check query plans with EXPLAIN ANALYZE for slow queries'
\echo ''
\echo 'Report completed at:' 
SELECT NOW();
