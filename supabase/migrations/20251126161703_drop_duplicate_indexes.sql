-- Migration: Drop duplicate indexes
-- Date: 2025-11-26
-- Purpose: Fix db lint warnings "duplicate_index" by removing redundant indexes
-- Context: Supabase DB Hardening - Step 5

-- =============================================================================
-- ANALYSIS
-- =============================================================================
-- Duplicate indexes identified:
-- 1. loaner_assignments(job_id): idx_loaner_assignments_job_id vs loaner_assignments_job_id_idx
-- 2. transactions(job_id): idx_transactions_job_id (created multiple times with IF NOT EXISTS)
--    Note: IF NOT EXISTS prevents actual duplicates, but we should verify

-- =============================================================================
-- DROP REDUNDANT INDEXES
-- =============================================================================

-- loaner_assignments: Keep idx_loaner_assignments_job_id (standard naming), drop the other
DROP INDEX IF EXISTS public.loaner_assignments_job_id_idx;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  loaner_idx_count INT;
  trans_idx_count INT;
BEGIN
  -- Count indexes on loaner_assignments(job_id)
  SELECT COUNT(*) INTO loaner_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename = 'loaner_assignments'
  AND indexdef LIKE '%job_id%';
  
  -- Count indexes on transactions(job_id)
  SELECT COUNT(*) INTO trans_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND tablename = 'transactions'
  AND indexdef LIKE '%job_id%';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Duplicate Index Cleanup Complete';
  RAISE NOTICE '  loaner_assignments job_id indexes: %', loaner_idx_count;
  RAISE NOTICE '  transactions job_id indexes: %', trans_idx_count;
  RAISE NOTICE '========================================';
  
  IF loaner_idx_count > 1 THEN
    RAISE WARNING 'Multiple indexes still exist on loaner_assignments(job_id)';
  END IF;
  
  IF trans_idx_count > 1 THEN
    RAISE WARNING 'Multiple indexes still exist on transactions(job_id)';
  END IF;
END $$;

-- =============================================================================
-- Notes:
-- =============================================================================
-- 1. Standard naming convention: idx_{tablename}_{column}
-- 2. Only truly duplicate indexes are dropped
-- 3. Indexes that cover different columns or have different types are preserved
-- 4. Run `supabase db lint` after applying to verify fixes
-- 5. See docs/db-lint/README.md for policy on unused indexes
