-- Migration: Add per-line-item scheduling time windows to job_parts
-- Location: supabase/migrations/20250117000000_add_job_parts_scheduling_times.sql
-- Purpose: Idempotent migration to add scheduled_start_time and scheduled_end_time columns
-- Dependencies: job_parts table (existing), 20250116000000_add_line_item_scheduling_fields.sql
-- Schema Analysis: Enhances existing per-line-item scheduling with specific time windows

-- =============================================================================
-- STEP A: Add scheduled_start_time column (idempotent)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'scheduled_start_time'
  ) THEN
    ALTER TABLE public.job_parts ADD COLUMN scheduled_start_time TIMESTAMPTZ;
    RAISE NOTICE '✓ Added scheduled_start_time column to job_parts';
  ELSE
    RAISE NOTICE '✓ Column scheduled_start_time already exists in job_parts';
  END IF;
END$$;

-- =============================================================================
-- STEP B: Add scheduled_end_time column (idempotent)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'scheduled_end_time'
  ) THEN
    ALTER TABLE public.job_parts ADD COLUMN scheduled_end_time TIMESTAMPTZ;
    RAISE NOTICE '✓ Added scheduled_end_time column to job_parts';
  ELSE
    RAISE NOTICE '✓ Column scheduled_end_time already exists in job_parts';
  END IF;
END$$;

-- =============================================================================
-- STEP C: Add indexes for performance (idempotent)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_job_parts_scheduled_start_time 
ON public.job_parts(scheduled_start_time);

CREATE INDEX IF NOT EXISTS idx_job_parts_scheduled_end_time 
ON public.job_parts(scheduled_end_time);

-- =============================================================================
-- STEP D: Verification
-- =============================================================================
DO $$
DECLARE
  start_col_exists BOOLEAN;
  end_col_exists BOOLEAN;
BEGIN
  -- Check columns exist
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'scheduled_start_time'
  ) INTO start_col_exists;
  
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'scheduled_end_time'
  ) INTO end_col_exists;
  
  IF start_col_exists AND end_col_exists THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ VERIFICATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Column: job_parts.scheduled_start_time exists';
    RAISE NOTICE '✓ Column: job_parts.scheduled_end_time exists';
    RAISE NOTICE '✓ Indexes: created for performance';
    RAISE NOTICE '✓ Ready for per-line-item time window scheduling';
    RAISE NOTICE '========================================';
  ELSE
    RAISE EXCEPTION 'CRITICAL: Column verification failed. start_time: %, end_time: %', start_col_exists, end_col_exists;
  END IF;
END$$;

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 Migration 20250117000000 completed successfully';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '   1. App will automatically detect these columns via capability flags';
  RAISE NOTICE '   2. dealService.js will include scheduled_* fields when JOB_PARTS_HAS_PER_LINE_TIMES=true';
  RAISE NOTICE '   3. Test by creating/editing deals with specific time windows per line item';
  RAISE NOTICE '========================================';
END$$;
