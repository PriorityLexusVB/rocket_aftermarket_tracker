-- Note: This migration has been intentionally converted to a NO-OP.
-- The original draft was not safe for automated apply because it assumed
-- columns that are not present in all environments (e.g., jobs.customer_name).
--
-- If you want to use an Overdue Jobs materialized view, adapt the SQL to the
-- current schema and apply it manually from:
--   supabase/optional-migrations/20251110023500_optional_materialized_view_overdue_jobs.sql

SELECT 1;
-- DROP MATERIALIZED VIEW IF EXISTS mv_overdue_jobs CASCADE;

-- Drop function
-- DROP FUNCTION IF EXISTS get_overdue_jobs_from_mv(UUID, INT);

-- Drop trigger function
-- DROP FUNCTION IF EXISTS refresh_overdue_jobs_mv() CASCADE;

-- =====================================================================
-- Decision Matrix: When to Implement
-- =====================================================================
-- 
-- Implement MV if ALL of these are true:
-- [x] get_overdue_jobs_enhanced takes >1 second
-- [x] Query is called frequently (>10 times/minute)
-- [x] Data staleness of 5-15 minutes is acceptable
-- [x] Overdue jobs result set is <10,000 rows
-- 
-- Continue using RPC if ANY of these are true:
-- [x] Query is fast enough (<500ms)
-- [x] Real-time data is critical
-- [x] Query is called infrequently (<1 time/minute)
-- [x] Overdue jobs result set is >50,000 rows (MV may be slower)
-- 
-- Performance Testing:
-- 1. Measure current RPC performance with EXPLAIN ANALYZE
-- 2. Create MV in staging/test environment
-- 3. Compare query times and resource usage
-- 4. Monitor refresh time and impact on write operations
-- 5. Make decision based on data, not assumptions

-- =====================================================================
-- Notes
-- =====================================================================
-- - CONCURRENTLY allows queries during refresh (requires unique index)
-- - For CONCURRENTLY to work, create unique index:
--   CREATE UNIQUE INDEX idx_mv_overdue_jobs_unique ON mv_overdue_jobs(id, part_id);
-- - Without CONCURRENTLY, refresh locks the MV for writes
-- - Refresh time depends on data volume and complexity
-- - Consider partitioning if MV grows very large
-- - Monitor disk space usage as MV stores a copy of data
