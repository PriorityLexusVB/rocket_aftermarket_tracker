-- Migration: Fix job_parts vendor_id foreign key constraint
-- Location: supabase/migrations/20251107000000_fix_job_parts_vendor_fkey.sql
-- Root Cause: Previous migration 20251106000000 used ADD COLUMN IF NOT EXISTS with inline REFERENCES
--             When column already exists, the REFERENCES clause is skipped, leaving no FK constraint
--             PostgREST requires a named FK constraint to recognize relationships for nested selects
-- Fix: Add FK constraint separately using catalog checks (idempotent, safe to re-run)
-- Dependencies: vendors table (existing), job_parts table with vendor_id column (existing)

-- Step 1: Add vendor_id column if it doesn't exist (safe, but FK will be added separately)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.job_parts ADD COLUMN vendor_id UUID;
    RAISE NOTICE 'Added vendor_id column to job_parts';
  ELSE
    RAISE NOTICE 'vendor_id column already exists in job_parts';
  END IF;
END$$;

-- Step 2: Add foreign key constraint if it doesn't exist (CRITICAL FIX)
-- This is the key fix: ensures FK exists even if column was added without constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'job_parts_vendor_id_fkey'
      AND conrelid = 'public.job_parts'::regclass
  ) THEN
    ALTER TABLE public.job_parts
    ADD CONSTRAINT job_parts_vendor_id_fkey
    FOREIGN KEY (vendor_id)
    REFERENCES public.vendors(id)
    ON UPDATE CASCADE
    ON DELETE SET NULL;
    RAISE NOTICE 'Added foreign key constraint job_parts_vendor_id_fkey';
  ELSE
    RAISE NOTICE 'Foreign key constraint job_parts_vendor_id_fkey already exists';
  END IF;
END$$;

-- Step 3: Create index on vendor_id if it doesn't exist (performance)
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id ON public.job_parts(vendor_id);

-- Step 4: Backfill vendor_id from products.vendor_id for existing records (idempotent)
-- This ensures existing line items show vendor names (derived from product)
-- Only update rows where vendor_id is NULL and product has a vendor
-- Note: This query relies on existing FK index on jp.product_id (created with table)
-- Performance: Typically fast due to FK index; if job_parts is very large (>100k rows),
--              consider running during off-peak hours
UPDATE public.job_parts jp
SET vendor_id = p.vendor_id
FROM public.products p
WHERE jp.product_id = p.id
  AND jp.vendor_id IS NULL
  AND p.vendor_id IS NOT NULL;

-- Step 5: Notify PostgREST to reload schema cache (CRITICAL)
-- This makes the REST API recognize the new foreign key relationship immediately
-- Without this, queries using vendor:vendors(...) will fail with "relationship not found"
NOTIFY pgrst, 'reload schema';
