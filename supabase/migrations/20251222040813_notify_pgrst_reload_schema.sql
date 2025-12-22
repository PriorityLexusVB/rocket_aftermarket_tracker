-- Migration: Trigger PostgREST schema cache reload
-- Location: supabase/migrations/20251222040813_notify_pgrst_reload_schema.sql
-- Purpose: Ensure PostgREST recognizes recent schema changes from migrations:
--          - 20251218042008_job_parts_unique_constraint_vendor_time.sql
--          - 20251219120000_fix_job_parts_vendor_policies.sql
-- Related: CI workflow failure - Nightly RLS Drift & Health Check
--          https://github.com/PriorityLexusVB/rocket_aftermarket_tracker/actions/runs/20421300544
-- Integration Type: Maintenance - schema cache refresh only, no schema changes
-- Dependencies: None (safe to run at any time)

-- =============================================================================
-- EXPLANATION
-- =============================================================================
-- Recent migrations made changes to job_parts (unique constraints and RLS policies)
-- but did not include the required NOTIFY command to refresh PostgREST's schema cache.
-- 
-- Without this, PostgREST may not recognize:
-- - New unique constraints
-- - Updated RLS policies
-- - FK relationships
--
-- This causes health endpoint failures in CI and potential relationship query errors.
--
-- This migration simply triggers a schema cache reload to fix the issue.
-- =============================================================================

-- Trigger PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';

-- Log success
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ PostgREST Schema Cache Reload Complete';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Command: NOTIFY pgrst, ''reload schema''';
  RAISE NOTICE '✓ Purpose: Recognize recent job_parts schema changes';
  RAISE NOTICE '✓ Affected: Unique constraints and RLS policies';
  RAISE NOTICE '========================================';
END$$;
