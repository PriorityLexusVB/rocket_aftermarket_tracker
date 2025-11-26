-- Migration: Add indexes for unindexed foreign keys
-- Date: 2025-11-26
-- Purpose: Fix db lint warnings "unindexed_foreign_key" by adding missing indexes
-- Context: Supabase DB Hardening - Step 6

-- =============================================================================
-- FOREIGN KEYS NEEDING INDEXES (from db lint)
-- =============================================================================
-- 1. activity_history_performed_by_fkey -> activity_history(performed_by)
-- 2. claim_attachments_uploaded_by_fkey -> claim_attachments(uploaded_by)
-- 3. communications_job_id_fkey -> communications(job_id)
-- 4. communications_sent_by_fkey -> communications(sent_by)
-- 5. jobs_created_by_fkey -> jobs(created_by)

-- =============================================================================
-- CREATE MISSING INDEXES
-- =============================================================================

-- 1. activity_history(performed_by)
CREATE INDEX IF NOT EXISTS idx_activity_history_performed_by
  ON public.activity_history (performed_by);

-- 2. claim_attachments(uploaded_by)
CREATE INDEX IF NOT EXISTS idx_claim_attachments_uploaded_by
  ON public.claim_attachments (uploaded_by);

-- 3. communications(job_id)
CREATE INDEX IF NOT EXISTS idx_communications_job_id
  ON public.communications (job_id);

-- 4. communications(sent_by)
CREATE INDEX IF NOT EXISTS idx_communications_sent_by
  ON public.communications (sent_by);

-- 5. jobs(created_by)
CREATE INDEX IF NOT EXISTS idx_jobs_created_by
  ON public.jobs (created_by);

-- =============================================================================
-- UPDATE STATISTICS
-- =============================================================================

ANALYZE public.activity_history;
ANALYZE public.claim_attachments;
ANALYZE public.communications;
ANALYZE public.jobs;

-- =============================================================================
-- VERIFICATION
-- =============================================================================

DO $$
DECLARE
  idx_count INT;
BEGIN
  SELECT COUNT(*) INTO idx_count
  FROM pg_indexes
  WHERE schemaname = 'public'
  AND indexname IN (
    'idx_activity_history_performed_by',
    'idx_claim_attachments_uploaded_by',
    'idx_communications_job_id',
    'idx_communications_sent_by',
    'idx_jobs_created_by'
  );

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Foreign Key Index Creation Complete';
  RAISE NOTICE '  New indexes created: %/5', idx_count;
  RAISE NOTICE '========================================';
  
  IF idx_count < 5 THEN
    RAISE WARNING 'Some indexes may not have been created';
  END IF;
END $$;

-- =============================================================================
-- Notes:
-- =============================================================================
-- 1. Foreign key indexes improve JOIN performance and DELETE cascades
-- 2. All indexes use standard naming: idx_{tablename}_{column}
-- 3. IF NOT EXISTS ensures idempotent execution
-- 4. ANALYZE updates query planner statistics
-- 5. Run `supabase db lint` after applying to verify fixes
