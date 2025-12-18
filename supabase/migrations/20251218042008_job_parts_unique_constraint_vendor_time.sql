-- Migration: Enforce uniqueness on job_parts logical key with vendor and time fields
-- Location: supabase/migrations/20251218042008_job_parts_unique_constraint_vendor_time.sql
-- Purpose: Remove duplicate job_parts rows and create unique constraint
-- Related: PR #225 (separate scope but related job_parts work)
-- Schema Analysis: job_parts table has columns: job_id, product_id, vendor_id, 
--                  promised_date, scheduled_start_time, scheduled_end_time
-- Integration Type: Modificative - cleanup + unique index enforcement
-- Dependencies: job_parts table (existing with all required columns)

-- =============================================================================
-- STEP 1: Remove existing duplicates, keeping newest row
-- =============================================================================
-- Use CTE with ROW_NUMBER to identify duplicates based on logical key:
-- (job_id, product_id, vendor_id, promised_date, scheduled_start_time, scheduled_end_time)
-- Keep row with highest created_at; break ties by lowest id
DO $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Check if created_at column exists (sanity check)
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'created_at'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: job_parts.created_at column not found. Cannot proceed with deduplication.';
  END IF;

  -- Perform deduplication
  WITH duplicates AS (
    SELECT 
      id,
      ROW_NUMBER() OVER (
        PARTITION BY 
          job_id,
          product_id,
          COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
          COALESCE(promised_date, '1970-01-01'::date),
          COALESCE(scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz),
          COALESCE(scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz)
        ORDER BY 
          created_at DESC,  -- Keep newest
          id ASC            -- Break ties by lowest id
      ) AS rn
    FROM public.job_parts
  )
  DELETE FROM public.job_parts
  WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
  );

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  IF deleted_count > 0 THEN
    RAISE NOTICE '✓ Removed % duplicate job_parts rows', deleted_count;
  ELSE
    RAISE NOTICE '✓ No duplicate job_parts rows found';
  END IF;
END$$;

-- =============================================================================
-- STEP 2: Create unique index on logical key
-- =============================================================================
-- Index name: job_parts_unique_job_product_vendor_time (exact as specified)
-- Handle NULL vendor_id using NULLS NOT DISTINCT (PostgreSQL 15+)
-- For compatibility with older versions, use COALESCE with sentinel value
DO $$
DECLARE
  pg_version_num INTEGER;
  supports_nulls_not_distinct BOOLEAN := false;
BEGIN
  -- Check PostgreSQL version
  SELECT current_setting('server_version_num')::integer INTO pg_version_num;
  
  -- PostgreSQL 15+ supports NULLS NOT DISTINCT
  IF pg_version_num >= 150000 THEN
    supports_nulls_not_distinct := true;
  END IF;

  -- Drop index if it already exists (for idempotency)
  IF EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'job_parts_unique_job_product_vendor_time'
  ) THEN
    EXECUTE 'DROP INDEX public.job_parts_unique_job_product_vendor_time';
    RAISE NOTICE '✓ Dropped existing index job_parts_unique_job_product_vendor_time';
  END IF;

  -- Create unique index with appropriate NULL handling
  IF supports_nulls_not_distinct THEN
    -- PostgreSQL 15+: Use NULLS NOT DISTINCT for cleaner NULL handling
    EXECUTE 'CREATE UNIQUE INDEX job_parts_unique_job_product_vendor_time ' ||
            'ON public.job_parts (job_id, product_id, vendor_id, promised_date, ' ||
            'scheduled_start_time, scheduled_end_time) NULLS NOT DISTINCT';
    RAISE NOTICE '✓ Created unique index with NULLS NOT DISTINCT (PostgreSQL 15+)';
  ELSE
    -- PostgreSQL <15: Use COALESCE with sentinel values for NULL handling
    EXECUTE 'CREATE UNIQUE INDEX job_parts_unique_job_product_vendor_time ' ||
            'ON public.job_parts (' ||
            'job_id, product_id, ' ||
            'COALESCE(vendor_id, ''00000000-0000-0000-0000-000000000000''::uuid), ' ||
            'COALESCE(promised_date, ''1970-01-01''::date), ' ||
            'COALESCE(scheduled_start_time, ''1970-01-01 00:00:00+00''::timestamptz), ' ||
            'COALESCE(scheduled_end_time, ''1970-01-01 00:00:00+00''::timestamptz))';
    RAISE NOTICE '✓ Created unique index with COALESCE sentinel values (PostgreSQL <15)';
  END IF;
END$$;

-- =============================================================================
-- STEP 3: Verification
-- =============================================================================
DO $$
DECLARE
  index_exists BOOLEAN;
  duplicate_count INTEGER;
BEGIN
  -- Verify index was created
  SELECT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'job_parts_unique_job_product_vendor_time'
  ) INTO index_exists;

  IF NOT index_exists THEN
    RAISE EXCEPTION 'CRITICAL: Index job_parts_unique_job_product_vendor_time was not created';
  END IF;

  -- Check for remaining duplicates
  WITH duplicate_check AS (
    SELECT 
      job_id,
      product_id,
      COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid) AS vendor_id_norm,
      COALESCE(promised_date, '1970-01-01'::date) AS promised_date_norm,
      COALESCE(scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz) AS start_time_norm,
      COALESCE(scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz) AS end_time_norm,
      COUNT(*) AS dup_count
    FROM public.job_parts
    GROUP BY 
      job_id,
      product_id,
      COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid),
      COALESCE(promised_date, '1970-01-01'::date),
      COALESCE(scheduled_start_time, '1970-01-01 00:00:00+00'::timestamptz),
      COALESCE(scheduled_end_time, '1970-01-01 00:00:00+00'::timestamptz)
    HAVING COUNT(*) > 1
  )
  SELECT COUNT(*) INTO duplicate_count FROM duplicate_check;

  IF duplicate_count > 0 THEN
    RAISE EXCEPTION 'CRITICAL: % duplicate groups still exist after cleanup', duplicate_count;
  END IF;

  -- Success
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ MIGRATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE '✓ Index: job_parts_unique_job_product_vendor_time created';
  RAISE NOTICE '✓ Duplicates: removed successfully';
  RAISE NOTICE '✓ Constraint: enforced on (job_id, product_id, vendor_id, promised_date, scheduled_start_time, scheduled_end_time)';
  RAISE NOTICE '✓ NULL handling: automatic via PostgreSQL version detection';
  RAISE NOTICE '========================================';
END$$;
