-- Migration: Fix Legacy org_id Data for Transactions and Jobs
-- Date: 2025-11-24
-- Purpose: Backfill NULL org_id values in jobs and transactions tables
--          to resolve RLS policy violations on legacy data
-- Context: Deals created before org scoping was implemented have NULL org_id,
--          which causes RLS policy violations when users try to edit them.
--
-- SAFETY: This migration is idempotent and uses safe UPDATE patterns.
--         It only updates rows where org_id IS NULL.
--
-- RUN MANUALLY: If this migration isn't auto-applied, run it in your
--               Supabase SQL editor or via supabase db push.

-- =============================================================================
-- SECTION 1: Identify the default organization
-- =============================================================================

-- Get the first organization (Priority Lexus VB or similar)
-- This is used as the fallback org for legacy data
DO $$
DECLARE
  default_org_id UUID;
  updated_jobs_from_profile INT := 0;
  updated_jobs_from_default INT := 0;
  updated_transactions_from_jobs INT := 0;
  updated_transactions_orphaned INT := 0;
  updated_vehicles_from_jobs INT := 0;
  updated_vehicles_from_default INT := 0;
BEGIN
  -- Find the default organization
  SELECT id INTO default_org_id
  FROM public.organizations
  WHERE name = 'Priority Lexus VB'
  LIMIT 1;

  -- If no named org found, use the first org
  IF default_org_id IS NULL THEN
    SELECT id INTO default_org_id
    FROM public.organizations
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF default_org_id IS NULL THEN
    RAISE NOTICE 'No organizations found. Skipping org_id backfill.';
    RETURN;
  END IF;

  RAISE NOTICE 'Using default org_id: %', default_org_id;

  -- =============================================================================
  -- SECTION 2: Backfill jobs.org_id from user_profiles if possible
  -- =============================================================================
  
  -- First, try to infer org_id from the assigned user's profile
  UPDATE public.jobs j
  SET org_id = up.org_id
  FROM public.user_profiles up
  WHERE j.org_id IS NULL
    AND j.assigned_to = up.id
    AND up.org_id IS NOT NULL;

  GET DIAGNOSTICS updated_jobs_from_profile = ROW_COUNT;
  RAISE NOTICE 'Updated % jobs from assigned_to user profile', updated_jobs_from_profile;

  -- For remaining jobs without org_id, use the default org
  UPDATE public.jobs
  SET org_id = default_org_id
  WHERE org_id IS NULL;

  GET DIAGNOSTICS updated_jobs_from_default = ROW_COUNT;
  RAISE NOTICE 'Updated % jobs with default org_id', updated_jobs_from_default;

  -- =============================================================================
  -- SECTION 3: Backfill transactions.org_id from linked jobs
  -- =============================================================================
  
  -- Set transaction org_id from the linked job's org_id
  UPDATE public.transactions t
  SET org_id = j.org_id
  FROM public.jobs j
  WHERE t.job_id = j.id
    AND t.org_id IS NULL
    AND j.org_id IS NOT NULL;

  GET DIAGNOSTICS updated_transactions_from_jobs = ROW_COUNT;
  RAISE NOTICE 'Updated % transactions from linked jobs', updated_transactions_from_jobs;

  -- For any orphaned transactions (no linked job), use the default org
  UPDATE public.transactions
  SET org_id = default_org_id
  WHERE org_id IS NULL;

  GET DIAGNOSTICS updated_transactions_orphaned = ROW_COUNT;
  RAISE NOTICE 'Updated % orphaned transactions with default org_id', updated_transactions_orphaned;

  -- =============================================================================
  -- SECTION 4: Backfill vehicles.org_id from linked jobs
  -- =============================================================================
  
  -- Set vehicle org_id from the first linked job's org_id
  UPDATE public.vehicles v
  SET org_id = (
    SELECT j.org_id
    FROM public.jobs j
    WHERE j.vehicle_id = v.id
      AND j.org_id IS NOT NULL
    ORDER BY j.created_at DESC
    LIMIT 1
  )
  WHERE v.org_id IS NULL;

  GET DIAGNOSTICS updated_vehicles_from_jobs = ROW_COUNT;
  RAISE NOTICE 'Updated % vehicles from linked jobs', updated_vehicles_from_jobs;

  -- For any vehicles without linked jobs or whose linked jobs had NULL org_id, use the default org
  UPDATE public.vehicles
  SET org_id = default_org_id
  WHERE org_id IS NULL;

  GET DIAGNOSTICS updated_vehicles_from_default = ROW_COUNT;
  RAISE NOTICE 'Updated % vehicles with default org_id', updated_vehicles_from_default;

  -- =============================================================================
  -- SECTION 5: Verification
  -- =============================================================================

  RAISE NOTICE '===========================================';
  RAISE NOTICE 'Legacy org_id backfill complete.';
  RAISE NOTICE 'Jobs without org_id: %', (SELECT COUNT(*) FROM public.jobs WHERE org_id IS NULL);
  RAISE NOTICE 'Transactions without org_id: %', (SELECT COUNT(*) FROM public.transactions WHERE org_id IS NULL);
  RAISE NOTICE 'Vehicles without org_id: %', (SELECT COUNT(*) FROM public.vehicles WHERE org_id IS NULL);
  RAISE NOTICE '===========================================';
END $$;

-- =============================================================================
-- SECTION 6: Refresh PostgREST schema cache
-- =============================================================================

-- Ensure PostgREST recognizes any changes
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- SECTION 7: Documentation
-- =============================================================================

COMMENT ON TABLE public.jobs IS 
'Jobs/deals in the aftermarket system. org_id provides multi-tenant isolation.
Migration 20251124230000 backfilled NULL org_id values for legacy data.';

COMMENT ON TABLE public.transactions IS 
'Financial transactions for jobs. org_id provides multi-tenant isolation.
Migration 20251124230000 backfilled NULL org_id values for legacy data.';
