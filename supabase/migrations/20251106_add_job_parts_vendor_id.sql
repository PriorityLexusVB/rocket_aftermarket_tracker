-- Migration: Add per-line vendor support to job_parts
-- Date: 2025-11-06
-- Purpose: Enable vendor selection per line item and resolve PostgREST relationship error

-- Add vendor_id column to job_parts table
ALTER TABLE public.job_parts
ADD COLUMN IF NOT EXISTS vendor_id UUID REFERENCES public.vendors(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id ON public.job_parts(vendor_id);

-- Backfill vendor_id from products.vendor_id where job_parts.vendor_id is null
-- This ensures existing data has a vendor reference
UPDATE public.job_parts jp
SET vendor_id = p.vendor_id
FROM public.products p
WHERE jp.product_id = p.id
  AND jp.vendor_id IS NULL
  AND p.vendor_id IS NOT NULL;

-- Add RLS policy: Allow vendors to view job parts with their vendor_id
DO $$
BEGIN
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
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.vendor_id = job_parts.vendor_id
          AND up.is_active = true
      )
    );
  END IF;
END$$;

-- Add RLS policy: Allow vendors to manage job parts with their vendor_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
      AND tablename='job_parts' 
      AND policyname='vendors_can_manage_job_parts_via_per_line_vendor'
  ) THEN
    CREATE POLICY "vendors_can_manage_job_parts_via_per_line_vendor"
    ON public.job_parts FOR ALL TO authenticated
    USING (
      vendor_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.vendor_id = job_parts.vendor_id
          AND up.is_active = true
      )
    )
    WITH CHECK (
      vendor_id IS NOT NULL AND EXISTS (
        SELECT 1
        FROM public.user_profiles up
        WHERE up.id = auth.uid()
          AND up.vendor_id = job_parts.vendor_id
          AND up.is_active = true
      )
    );
  END IF;
END$$;

-- Note: Existing job_parts policies tied to parent jobs remain active,
-- so both job-based and per-line vendor-based access patterns work.
