-- Comprehensive setup script for dropdowns and deals hardening
-- Run this via Supabase SQL Editor or MCP tool
-- All operations are idempotent and safe to run multiple times

BEGIN;

-- =============================================================================
-- PART 1: Organization Setup and E2E User Attachment
-- =============================================================================

-- Create organization if it doesn't exist
INSERT INTO public.organizations (name)
VALUES ('Priority Lexus VB')
ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
RETURNING id;

-- Ensure E2E user profile exists and is attached to organization
-- This handles both new profile creation and updating existing profiles
DO $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  -- Get org ID
  SELECT id INTO v_org_id FROM public.organizations WHERE name = 'Priority Lexus VB';
  
  -- Get user ID from auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'rob.brasco@priorityautomotive.com' LIMIT 1;
  
  IF v_user_id IS NOT NULL THEN
    -- Upsert user profile
    INSERT INTO public.user_profiles (id, email, full_name, is_active, department, role, org_id)
    VALUES (v_user_id, 'rob.brasco@priorityautomotive.com', 'Rob Brasco', true, 'Sales Consultants', 'staff', v_org_id)
    ON CONFLICT (id) DO UPDATE SET
      org_id = EXCLUDED.org_id,
      is_active = true,
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      department = EXCLUDED.department,
      role = EXCLUDED.role;
    
    RAISE NOTICE '✓ E2E user profile updated: org_id=%', v_org_id;
  ELSE
    RAISE WARNING 'User with email rob.brasco@priorityautomotive.com not found in auth.users';
  END IF;
END$$;

-- =============================================================================
-- PART 2: Optional DB Remediation (Schema Columns and Constraints)
-- =============================================================================

-- Add vendor_id column to job_parts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'vendor_id'
  ) THEN
    ALTER TABLE public.job_parts ADD COLUMN vendor_id UUID;
    RAISE NOTICE '✓ Added vendor_id column to job_parts';
  ELSE
    RAISE NOTICE '✓ vendor_id column already exists in job_parts';
  END IF;
END$$;

-- Add scheduled_start_time column to job_parts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'scheduled_start_time'
  ) THEN
    ALTER TABLE public.job_parts ADD COLUMN scheduled_start_time TIMESTAMPTZ;
    RAISE NOTICE '✓ Added scheduled_start_time column to job_parts';
  ELSE
    RAISE NOTICE '✓ scheduled_start_time column already exists in job_parts';
  END IF;
END$$;

-- Add scheduled_end_time column to job_parts if missing
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_parts'
      AND column_name = 'scheduled_end_time'
  ) THEN
    ALTER TABLE public.job_parts ADD COLUMN scheduled_end_time TIMESTAMPTZ;
    RAISE NOTICE '✓ Added scheduled_end_time column to job_parts';
  ELSE
    RAISE NOTICE '✓ scheduled_end_time column already exists in job_parts';
  END IF;
END$$;

-- Add foreign key constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'job_parts' AND constraint_name = 'job_parts_vendor_id_fkey'
  ) THEN
    ALTER TABLE public.job_parts
    ADD CONSTRAINT job_parts_vendor_id_fkey
    FOREIGN KEY (vendor_id) REFERENCES public.vendors(id)
    ON DELETE SET NULL
    DEFERRABLE INITIALLY DEFERRED;
    RAISE NOTICE '✓ Added job_parts_vendor_id_fkey constraint';
  ELSE
    RAISE NOTICE '✓ job_parts_vendor_id_fkey constraint already exists';
  END IF;
END$$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_job_parts_vendor_id ON public.job_parts(vendor_id);
CREATE INDEX IF NOT EXISTS idx_job_parts_scheduled_start_time ON public.job_parts(scheduled_start_time);
CREATE INDEX IF NOT EXISTS idx_job_parts_scheduled_end_time ON public.job_parts(scheduled_end_time);

-- =============================================================================
-- PART 3: Verification
-- =============================================================================

-- Verify E2E user has org_id
DO $$
DECLARE
  v_org_id UUID;
  v_email TEXT;
BEGIN
  SELECT org_id, email INTO v_org_id, v_email
  FROM public.user_profiles
  WHERE email = 'rob.brasco@priorityautomotive.com'
  LIMIT 1;
  
  IF v_org_id IS NOT NULL THEN
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ E2E USER VERIFICATION COMPLETE';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Email: %', v_email;
    RAISE NOTICE 'Org ID: %', v_org_id;
    RAISE NOTICE '========================================';
  ELSE
    RAISE WARNING 'E2E user org_id is NULL - check user_profiles table';
  END IF;
END$$;

-- Verify schema columns
DO $$
DECLARE
  vendor_col_exists BOOLEAN;
  start_time_exists BOOLEAN;
  end_time_exists BOOLEAN;
  fk_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_parts' AND column_name = 'vendor_id'
  ) INTO vendor_col_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_parts' AND column_name = 'scheduled_start_time'
  ) INTO start_time_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'job_parts' AND column_name = 'scheduled_end_time'
  ) INTO end_time_exists;
  
  SELECT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'job_parts' AND constraint_name = 'job_parts_vendor_id_fkey'
  ) INTO fk_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ SCHEMA VERIFICATION COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'job_parts.vendor_id: %', CASE WHEN vendor_col_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
  RAISE NOTICE 'job_parts.scheduled_start_time: %', CASE WHEN start_time_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
  RAISE NOTICE 'job_parts.scheduled_end_time: %', CASE WHEN end_time_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
  RAISE NOTICE 'job_parts_vendor_id_fkey: %', CASE WHEN fk_exists THEN '✓ EXISTS' ELSE '✗ MISSING' END;
  RAISE NOTICE '========================================';
END$$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- Final instructions
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 SETUP COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Refresh your app at /debug-auth';
  RAISE NOTICE '2. Verify session shows non-null org_id';
  RAISE NOTICE '3. Check dropdown counts are visible';
  RAISE NOTICE '4. Test Deals page loads without 400 errors';
  RAISE NOTICE '========================================';
END$$;
