-- Optional: Materialized View for Overdue Jobs
-- Purpose: Replace expensive get_overdue_jobs_enhanced RPC with faster MV
-- Date: 2025-11-10
-- Note: This is OPTIONAL - only implement if get_overdue_jobs_enhanced shows poor performance

-- IMPORTANT:
-- This file is intentionally NOT located under supabase/migrations.
-- It is not safe to apply automatically as-is (it assumes schema fields that may not exist).
-- If you want to use this MV, adapt it to your current schema and apply manually.

-- =====================================================================
-- Rationale
-- =====================================================================
-- If get_overdue_jobs_enhanced RPC is slow (>1 second), consider using
-- a materialized view that is refreshed periodically instead of computed
-- on every request.
--
-- Benefits:
-- - Faster query response (pre-computed results)
-- - Reduced CPU load on database
-- - Predictable query performance
--
-- Trade-offs:
-- - Data may be stale (up to refresh interval)
-- - Requires refresh strategy (manual, scheduled, or event-driven)
-- - Additional storage for MV
--
-- When to Use:
-- - Query takes >1 second consistently
-- - Data changes infrequently (minutes to hours)
-- - Staleness is acceptable for the use case
-- - High query frequency justifies pre-computation

-- =====================================================================
-- Step 1: Create Materialized View
-- =====================================================================

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_overdue_jobs AS
SELECT 
  j.id,
  j.job_number,
  j.title,
  j.job_status,
  j.customer_name,
  j.customer_phone,
  j.assigned_to,
  j.org_id,
  p.id as part_id,
  p.description as part_description,
  p.promised_date,
  p.requires_scheduling,
  NOW()::date - p.promised_date AS days_overdue,
  -- Add any other fields needed by the UI
  j.created_at,
  j.updated_at
FROM jobs j
INNER JOIN job_parts p ON p.job_id = j.id
WHERE 
  p.requires_scheduling = true 
  AND p.promised_date < NOW()::date
  AND j.job_status NOT IN ('completed', 'cancelled')
ORDER BY 
  p.promised_date ASC;

-- =====================================================================
-- Step 2: Create Indexes on Materialized View
-- =====================================================================

-- Primary index on promised_date (most common sort)
CREATE INDEX IF NOT EXISTS idx_mv_overdue_jobs_promised 
ON mv_overdue_jobs(promised_date);

-- Composite index for org-specific queries
CREATE INDEX IF NOT EXISTS idx_mv_overdue_jobs_org_promised 
ON mv_overdue_jobs(org_id, promised_date);

-- Index on job_status for filtering
CREATE INDEX IF NOT EXISTS idx_mv_overdue_jobs_status 
ON mv_overdue_jobs(job_status);

-- Index on days_overdue for severity filtering
CREATE INDEX IF NOT EXISTS idx_mv_overdue_jobs_days_overdue 
ON mv_overdue_jobs(days_overdue);

-- =====================================================================
-- Step 3: Refresh Strategies
-- =====================================================================

-- OPTION A: Manual Refresh (via Admin UI or API)
-- Trigger this from /api/admin/refresh-overdue-jobs endpoint
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overdue_jobs;

-- OPTION B: Scheduled Refresh (requires pg_cron extension)
-- Refresh every 15 minutes during business hours
-- SELECT cron.schedule(
--   'refresh-overdue-jobs',
--   '*/15 6-20 * * 1-5',  -- Every 15 min, 6am-8pm, Mon-Fri
--   $$REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overdue_jobs$$
-- );

-- OPTION C: Event-Driven Refresh (trigger on data changes)
-- Create trigger function
CREATE OR REPLACE FUNCTION refresh_overdue_jobs_mv()
RETURNS TRIGGER AS $$
BEGIN
  -- Refresh asynchronously to avoid blocking writes
  -- Note: This requires pg_background or similar extension
  -- For synchronous refresh, use: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_overdue_jobs;
  
  -- For now, log the trigger and refresh manually or via scheduled job
  RAISE NOTICE 'Overdue jobs MV needs refresh due to % on %', TG_OP, TG_TABLE_NAME;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to relevant tables
-- CREATE TRIGGER trg_refresh_overdue_jobs_on_job_parts
-- AFTER INSERT OR UPDATE OR DELETE ON job_parts
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION refresh_overdue_jobs_mv();

-- CREATE TRIGGER trg_refresh_overdue_jobs_on_jobs
-- AFTER UPDATE OF job_status ON jobs
-- FOR EACH STATEMENT
-- EXECUTE FUNCTION refresh_overdue_jobs_mv();

-- =====================================================================
-- Step 4: Create API Endpoint or Function to Query MV
-- =====================================================================

-- Simple function to query the materialized view
CREATE OR REPLACE FUNCTION get_overdue_jobs_from_mv(
  p_org_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 100
)
RETURNS SETOF mv_overdue_jobs
LANGUAGE sql
STABLE
AS $$
  SELECT * 
  FROM mv_overdue_jobs
  WHERE (p_org_id IS NULL OR org_id = p_org_id)
  ORDER BY promised_date ASC
  LIMIT p_limit;
$$;

-- Grant access to authenticated users
GRANT SELECT ON mv_overdue_jobs TO authenticated;

-- =====================================================================
-- Monitoring and Maintenance
-- =====================================================================

-- Check MV size
SELECT pg_size_pretty(pg_relation_size('mv_overdue_jobs'));

-- Check MV last refresh time
SELECT 
  schemaname,
  matviewname,
  hasindexes,
  ispopulated,
  definition
FROM pg_matviews
WHERE matviewname = 'mv_overdue_jobs';

-- Check index usage on MV
SELECT 
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename = 'mv_overdue_jobs';
