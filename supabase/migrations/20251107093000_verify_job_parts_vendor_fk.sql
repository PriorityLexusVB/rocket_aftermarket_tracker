-- Migration: Comprehensive verification and correction of job_parts ↔ vendors relationship
-- Location: supabase/migrations/20251107093000_verify_job_parts_vendor_fk.sql
-- Purpose: Idempotent migration to guarantee FK relationship in all environments
-- Root Cause Prevention: Ensures FK exists even if partial state from previous migrations
-- Drift Protection: Uses catalog checks to verify and create missing components
-- Dependencies: vendors table (existing), job_parts table (existing)

-- =============================================================================
-- STEP A: Ensure vendor_id column exists (idempotent)
-- =============================================================================
DO $$
BEGIN
  -- Check if vendor_id column exists in job_parts table
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'vendor_id'
  ) THEN
    -- Add the column without inline REFERENCES (FK added separately below)
    ALTER TABLE public.job_parts ADD COLUMN vendor_id UUID;
    RAISE NOTICE '✓ Added vendor_id column to job_parts';
  ELSE
    RAISE NOTICE '✓ Column vendor_id already exists in job_parts';
  END IF;
END$$;

-- =============================================================================
-- STEP B: Ensure foreign key constraint exists (CRITICAL - the main fix)
-- =============================================================================
DO $$
BEGIN
  -- Check if FK constraint exists using catalog query
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint
    WHERE conname = 'job_parts_vendor_id_fkey'
      AND conrelid = 'public.job_parts'::regclass
  ) THEN
    -- Add the named FK constraint with proper CASCADE behavior
    ALTER TABLE public.job_parts
    ADD CONSTRAINT job_parts_vendor_id_fkey
    FOREIGN KEY (vendor_id)
    REFERENCES public.vendors(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
    RAISE NOTICE '✓ Added foreign key constraint job_parts_vendor_id_fkey';
  ELSE
    RAISE NOTICE '✓ Foreign key constraint job_parts_vendor_id_fkey already exists';
  END IF;
END$$;

-- =============================================================================
-- STEP C: Ensure index exists for performance (idempotent)
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id 
ON public.job_parts(vendor_id);

-- Verify index creation
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
      AND tablename = 'job_parts' 
      AND indexname = 'idx_job_parts_vendor_id'
  ) THEN
    RAISE NOTICE '✓ Index idx_job_parts_vendor_id exists';
  ELSE
    RAISE WARNING '⚠ Index idx_job_parts_vendor_id was not created (unexpected)';
  END IF;
END$$;

-- =============================================================================
-- STEP D: Backfill vendor_id from products.vendor_id (idempotent, safe)
-- =============================================================================
-- This ensures existing line items without vendor_id get it from their product
-- Only updates rows where vendor_id is NULL and product has a vendor
-- Performance note: Uses existing FK index on jp.product_id
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  WITH updates AS (
    UPDATE public.job_parts jp
    SET vendor_id = p.vendor_id
    FROM public.products p
    WHERE jp.product_id = p.id
      AND jp.vendor_id IS NULL
      AND p.vendor_id IS NOT NULL
    RETURNING jp.id
  )
  SELECT COUNT(*) INTO updated_count FROM updates;
  
  IF updated_count > 0 THEN
    RAISE NOTICE '✓ Backfilled vendor_id for % existing job_parts rows', updated_count;
  ELSE
    RAISE NOTICE '✓ No job_parts rows required backfill (already populated or no products with vendors)';
  END IF;
END$$;

-- =============================================================================
-- STEP E: Verify relationship exists in catalog (drift detection)
-- =============================================================================
DO $$
DECLARE
  fk_count INTEGER;
  col_exists BOOLEAN;
BEGIN
  -- Count FK constraints matching our requirement
  SELECT COUNT(*) INTO fk_count
  FROM information_schema.table_constraints AS tc
  JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
  JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
  WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_name = 'job_parts'
    AND kcu.column_name = 'vendor_id'
    AND ccu.table_name = 'vendors';
  
  -- Check column exists
  SELECT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'vendor_id'
  ) INTO col_exists;
  
  IF fk_count > 0 AND col_exists THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ VERIFICATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✓ Column: job_parts.vendor_id exists';
    RAISE NOTICE '✓ FK Constraint: job_parts → vendors exists';
    RAISE NOTICE '✓ Index: idx_job_parts_vendor_id exists';
    RAISE NOTICE '✓ Ready for PostgREST relationship queries';
    RAISE NOTICE '========================================';
  ELSE
    RAISE EXCEPTION 'CRITICAL: Relationship verification failed. Column exists: %, FK count: %', col_exists, fk_count;
  END IF;
END$$;

-- =============================================================================
-- STEP F: Reload PostgREST schema cache (CRITICAL for API to recognize relationship)
-- =============================================================================
-- This notification tells PostgREST to reload its schema cache so the REST API
-- immediately recognizes the job_parts → vendors relationship for nested selects
-- like: job_parts?select=id,vendor:vendors(id,name)
NOTIFY pgrst, 'reload schema';

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 Migration 20251107093000 completed successfully';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '   1. Run: ./scripts/verify-schema-cache.sh';
  RAISE NOTICE '   2. Test REST query: /rest/v1/job_parts?select=id,vendor:vendors(id,name)&limit=1';
  RAISE NOTICE '   3. Verify Deals page loads without errors';
  RAISE NOTICE '========================================';
END$$;
