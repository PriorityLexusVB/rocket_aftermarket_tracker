-- Migration: Move pg_trgm extension from public to extensions schema
-- Date: 2025-11-26
-- Purpose: Fix db lint error "extension_in_public" on pg_trgm
-- Context: Supabase DB Hardening - Step 2

-- =============================================================================
-- STEP 1: Create extensions schema if not exists
-- =============================================================================

CREATE SCHEMA IF NOT EXISTS extensions;

-- =============================================================================
-- STEP 2: Drop dependent trigram indexes first
-- =============================================================================

-- Drop existing trigram indexes that depend on pg_trgm extension
DROP INDEX IF EXISTS idx_user_profiles_department_trgm;
DROP INDEX IF EXISTS idx_jobs_title_trgm;
DROP INDEX IF EXISTS idx_jobs_job_number_trgm;
DROP INDEX IF EXISTS idx_vendors_name_trgm;
DROP INDEX IF EXISTS idx_vehicles_make_trgm;
DROP INDEX IF EXISTS idx_vehicles_model_trgm;
DROP INDEX IF EXISTS idx_vehicles_vin_trgm;
DROP INDEX IF EXISTS idx_products_name_trgm;

-- =============================================================================
-- STEP 3: Drop pg_trgm from public schema and recreate in extensions
-- =============================================================================

-- Drop if exists in public (now safe since dependent indexes are dropped)
DROP EXTENSION IF EXISTS pg_trgm;

-- Create in extensions schema
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- =============================================================================
-- STEP 4: Add extensions schema to search_path for future sessions
-- Note: This is typically configured in config.toml api.extra_search_path
-- but we ensure the extension is accessible via schema prefix if needed
-- =============================================================================

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching. Relocated to extensions schema per db lint recommendation.';

-- =============================================================================
-- STEP 5: Recreate trigram indexes that were dropped
-- These indexes use gin_trgm_ops from the pg_trgm extension
-- Using extensions.gin_trgm_ops ensures they reference the relocated extension
-- =============================================================================

-- jobs table - title search
CREATE INDEX IF NOT EXISTS idx_jobs_title_trgm 
  ON public.jobs USING GIN (title extensions.gin_trgm_ops);

-- jobs table - job_number search
CREATE INDEX IF NOT EXISTS idx_jobs_job_number_trgm 
  ON public.jobs USING GIN (job_number extensions.gin_trgm_ops);

-- vendors table - name search
CREATE INDEX IF NOT EXISTS idx_vendors_name_trgm 
  ON public.vendors USING GIN (name extensions.gin_trgm_ops);

-- vehicles table - make/model search
CREATE INDEX IF NOT EXISTS idx_vehicles_make_trgm 
  ON public.vehicles USING GIN (make extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_vehicles_model_trgm 
  ON public.vehicles USING GIN (model extensions.gin_trgm_ops);

-- vehicles table - VIN search
CREATE INDEX IF NOT EXISTS idx_vehicles_vin_trgm 
  ON public.vehicles USING GIN (vin extensions.gin_trgm_ops);

-- products table - name search
CREATE INDEX IF NOT EXISTS idx_products_name_trgm 
  ON public.products USING GIN (name extensions.gin_trgm_ops);

-- user_profiles table - department search
CREATE INDEX IF NOT EXISTS idx_user_profiles_department_trgm 
  ON public.user_profiles USING GIN (department extensions.gin_trgm_ops);

-- =============================================================================
-- STEP 6: Validation
-- =============================================================================

DO $$
DECLARE
  ext_schema TEXT;
  trgm_idx_count INT;
BEGIN
  -- Verify extension is in extensions schema
  SELECT n.nspname INTO ext_schema
  FROM pg_extension e
  JOIN pg_namespace n ON n.oid = e.extnamespace
  WHERE e.extname = 'pg_trgm';

  -- Count trigram indexes
  SELECT COUNT(*) INTO trgm_idx_count
  FROM pg_indexes
  WHERE schemaname = 'public' 
  AND indexdef LIKE '%gin_trgm_ops%';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'pg_trgm Extension Configuration:';
  RAISE NOTICE '  Extension Schema: %', ext_schema;
  RAISE NOTICE '  Trigram Index Count: %', trgm_idx_count;
  RAISE NOTICE '========================================';

  IF ext_schema != 'extensions' THEN
    RAISE WARNING 'pg_trgm extension is not in extensions schema. Found: %', ext_schema;
  END IF;
END $$;

-- =============================================================================
-- Notes:
-- =============================================================================
-- 1. pg_trgm is used for ILIKE optimization via trigram indexes
-- 2. Moving to extensions schema follows Supabase best practices
-- 3. Indexes use extensions.gin_trgm_ops to explicitly reference the extension
-- 4. Search path (api.extra_search_path in config.toml) includes 'extensions'
-- 5. This migration is safe to run multiple times (idempotent)
