-- scripts/repair-job-parts-vendor-fk.sql
-- Idempotent repair script for job_parts ↔ vendors relationship
-- Can be run safely multiple times
-- Usage: supabase db execute --file scripts/repair-job-parts-vendor-fk.sql

-- =============================================================================
-- STEP 1: Ensure vendor_id column exists
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.job_parts ADD COLUMN vendor_id UUID;
    RAISE NOTICE '✓ Added vendor_id column to job_parts';
  ELSE
    RAISE NOTICE '✓ Column vendor_id already exists';
  END IF;
END$$;

-- =============================================================================
-- STEP 2: Ensure foreign key constraint exists
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint
    WHERE conname = 'job_parts_vendor_id_fkey'
      AND conrelid = 'public.job_parts'::regclass
  ) THEN
    ALTER TABLE public.job_parts
    ADD CONSTRAINT job_parts_vendor_id_fkey
    FOREIGN KEY (vendor_id)
    REFERENCES public.vendors(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
    RAISE NOTICE '✓ Added foreign key constraint job_parts_vendor_id_fkey';
  ELSE
    RAISE NOTICE '✓ Foreign key constraint already exists';
  END IF;
END$$;

-- =============================================================================
-- STEP 3: Ensure index exists
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id 
ON public.job_parts(vendor_id);

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
  END IF;
END$$;

-- =============================================================================
-- STEP 4: Optional backfill from products.vendor_id
-- =============================================================================
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
    RAISE NOTICE '✓ Backfilled vendor_id for % job_parts rows', updated_count;
  ELSE
    RAISE NOTICE '✓ No backfill needed';
  END IF;
END$$;

-- =============================================================================
-- STEP 5: Reload PostgREST schema cache
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- Success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ Repair script completed successfully';
  RAISE NOTICE 'Next: Test REST query or run verify-schema-cache.sh';
  RAISE NOTICE '========================================';
END$$;
