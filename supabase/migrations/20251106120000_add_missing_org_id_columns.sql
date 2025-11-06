-- Migration: Add missing org_id columns to tables for multi-tenant support
-- Date: 2025-11-06
-- Purpose: Fix schema mismatch where RLS policies expect org_id but columns don't exist

-- Add org_id to vendors table
ALTER TABLE public.vendors
ADD COLUMN IF NOT EXISTS org_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add org_id to products table
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS org_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add org_id to sms_templates table
ALTER TABLE public.sms_templates
ADD COLUMN IF NOT EXISTS org_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add org_id to transactions table
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS org_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Add org_id to vehicles table
ALTER TABLE public.vehicles
ADD COLUMN IF NOT EXISTS org_id UUID NULL REFERENCES public.organizations(id) ON DELETE CASCADE;

-- Note: jobs table already has org_id from previous migrations
-- Note: job_parts inherits org from parent job, so no direct org_id needed

-- Create indexes for performance on org_id columns
CREATE INDEX IF NOT EXISTS idx_vendors_org_id ON public.vendors(org_id);
CREATE INDEX IF NOT EXISTS idx_products_org_id ON public.products(org_id);
CREATE INDEX IF NOT EXISTS idx_sms_templates_org_id ON public.sms_templates(org_id);
CREATE INDEX IF NOT EXISTS idx_transactions_org_id ON public.transactions(org_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_org_id ON public.vehicles(org_id);

-- Backfill org_id for existing records
-- Set to the default organization (Priority Lexus VB) if available
DO $$
DECLARE
  default_org_id UUID;
BEGIN
  -- Get the default organization ID
  SELECT id INTO default_org_id FROM public.organizations WHERE name = 'Priority Lexus VB' LIMIT 1;
  
  -- Only proceed with backfill if default org exists
  IF default_org_id IS NOT NULL THEN
    -- Backfill vendors
    UPDATE public.vendors SET org_id = default_org_id WHERE org_id IS NULL;
    
    -- Backfill products
    UPDATE public.products SET org_id = default_org_id WHERE org_id IS NULL;
    
    -- Backfill sms_templates
    UPDATE public.sms_templates SET org_id = default_org_id WHERE org_id IS NULL;
    
    -- Backfill transactions
    UPDATE public.transactions SET org_id = default_org_id WHERE org_id IS NULL;
    
    -- Backfill vehicles
    UPDATE public.vehicles SET org_id = default_org_id WHERE org_id IS NULL;
  END IF;
END $$;
