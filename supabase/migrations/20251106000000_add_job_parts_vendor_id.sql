-- Migration: Add per-line vendor support to job_parts
-- Location: supabase/migrations/20251106000000_add_job_parts_vendor_id.sql
-- Schema Analysis: job_parts table currently lacks vendor_id; queries attempt vendor:vendors join causing relationship errors
-- Integration Type: Modificative - adding column with FK to existing table
-- Dependencies: vendors table (existing), job_parts table (existing)

-- Step 1: Add vendor_id column to job_parts table
-- Allows per-line vendor override; if null, derive from products.vendor_id
ALTER TABLE public.job_parts
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Step 2: Create index for vendor_id to improve query performance
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id ON public.job_parts(vendor_id);

-- Step 3: Backfill vendor_id from products.vendor_id for existing records
-- This ensures existing line items show vendor names (derived from product)
UPDATE public.job_parts jp
SET vendor_id = p.vendor_id
FROM public.products p
WHERE jp.product_id = p.id
  AND jp.vendor_id IS NULL
  AND p.vendor_id IS NOT NULL;

-- Step 4: Update RLS policies to allow vendor access via per-line vendor_id
-- Extend existing view policy to allow vendors to view job_parts associated with them
DO $$
BEGIN
  -- Check if policy already exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' 
      AND tablename='job_parts' 
      AND policyname='vendors_can_view_job_parts_via_per_line_vendor'
  ) THEN
    CREATE POLICY "vendors_can_view_job_parts_via_per_line_vendor"
    ON public.job_parts FOR SELECT TO authenticated
    USING (
      vendor_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.vendor_id = job_parts.vendor_id
          AND up.is_active = true
      )
    );
  END IF;
END$$;

-- Step 5: Allow vendors to insert their own job_parts
DO $$
BEGIN
  -- Check if policy already exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' 
      AND tablename='job_parts' 
      AND policyname='vendors_can_insert_their_job_parts'
  ) THEN
    CREATE POLICY "vendors_can_insert_their_job_parts"
    ON public.job_parts FOR INSERT TO authenticated
    WITH CHECK (
      vendor_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.vendor_id = vendor_id
          AND up.is_active = true
      )
    );
  END IF;
END$$;

DO $$
BEGIN
  -- Check if policy already exists before creating
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' 
      AND tablename='job_parts' 
      AND policyname='vendors_can_update_their_job_parts'
  ) THEN
    CREATE POLICY "vendors_can_update_their_job_parts"
    ON public.job_parts FOR UPDATE TO authenticated
    USING (
      vendor_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.vendor_id = vendor_id
          AND up.is_active = true
      )
    );
  END IF;
END$$;
