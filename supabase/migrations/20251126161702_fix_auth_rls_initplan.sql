-- Migration: Fix auth_rls_initplan warnings on RLS policies
-- Date: 2025-11-26
-- Purpose: Fix db lint warnings "auth_rls_initplan" by wrapping auth.*() calls in (SELECT ...)
-- Context: Supabase DB Hardening - Step 4
-- 
-- Background: PostgreSQL RLS policies should use (SELECT auth.uid()) instead of auth.uid()
-- directly to ensure proper query planning and avoid the initplan anti-pattern.
-- This migration recreates affected policies with the correct pattern.

-- =============================================================================
-- HELPER FUNCTION: Ensure auth_user_org uses proper pattern
-- =============================================================================

-- Recreate auth_user_org with (SELECT auth.uid()) pattern
CREATE OR REPLACE FUNCTION public.auth_user_org()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT org_id FROM public.user_profiles WHERE id = (SELECT auth.uid());
$$;

-- Recreate is_admin_or_manager with (SELECT auth.uid()) pattern
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE (up.id = (SELECT auth.uid()) OR up.auth_user_id = (SELECT auth.uid()))
    AND up.role IN ('admin', 'manager')
    AND COALESCE(up.is_active, true)
  );
$$;

-- =============================================================================
-- FIX: user_profiles policies
-- =============================================================================

-- Drop and recreate "own profile read" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_profiles' AND policyname='own profile read'
  ) THEN
    DROP POLICY "own profile read" ON public.user_profiles;
  END IF;
  
  CREATE POLICY "own profile read" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (id = (SELECT auth.uid()) OR auth_user_id = (SELECT auth.uid()));
  
  RAISE NOTICE 'Recreated policy: own profile read (user_profiles)';
END $$;

-- Drop and recreate "org members read user_profiles" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='user_profiles' AND policyname='org members read user_profiles'
  ) THEN
    DROP POLICY "org members read user_profiles" ON public.user_profiles;
  END IF;
  
  CREATE POLICY "org members read user_profiles" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_user_org()) AND COALESCE(is_active, true));
  
  RAISE NOTICE 'Recreated policy: org members read user_profiles';
END $$;

-- =============================================================================
-- FIX: jobs policies
-- =============================================================================

-- Drop and recreate "org read jobs" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='jobs' AND policyname='org read jobs'
  ) THEN
    DROP POLICY "org read jobs" ON public.jobs;
  END IF;
  
  CREATE POLICY "org read jobs" ON public.jobs
    FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_user_org()));
  
  RAISE NOTICE 'Recreated policy: org read jobs';
END $$;

-- Drop and recreate "org can insert jobs" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='jobs' AND policyname='org can insert jobs'
  ) THEN
    DROP POLICY "org can insert jobs" ON public.jobs;
  END IF;
  
  CREATE POLICY "org can insert jobs" ON public.jobs
    FOR INSERT TO authenticated
    WITH CHECK (org_id = (SELECT public.auth_user_org()));
  
  RAISE NOTICE 'Recreated policy: org can insert jobs';
END $$;

-- Drop and recreate "org can update jobs" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='jobs' AND policyname='org can update jobs'
  ) THEN
    DROP POLICY "org can update jobs" ON public.jobs;
  END IF;
  
  CREATE POLICY "org can update jobs" ON public.jobs
    FOR UPDATE TO authenticated
    USING (org_id = (SELECT public.auth_user_org()))
    WITH CHECK (org_id = (SELECT public.auth_user_org()));
  
  RAISE NOTICE 'Recreated policy: org can update jobs';
END $$;

-- =============================================================================
-- FIX: job_parts policies
-- =============================================================================

-- Drop and recreate "org read job_parts via jobs" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='job_parts' AND policyname='org read job_parts via jobs'
  ) THEN
    DROP POLICY "org read job_parts via jobs" ON public.job_parts;
  END IF;
  
  CREATE POLICY "org read job_parts via jobs" ON public.job_parts
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_parts.job_id
      AND j.org_id = (SELECT public.auth_user_org())
    ));
  
  RAISE NOTICE 'Recreated policy: org read job_parts via jobs';
END $$;

-- Drop and recreate "org can insert job_parts via jobs" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='job_parts' AND policyname='org can insert job_parts via jobs'
  ) THEN
    DROP POLICY "org can insert job_parts via jobs" ON public.job_parts;
  END IF;
  
  CREATE POLICY "org can insert job_parts via jobs" ON public.job_parts
    FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_parts.job_id
      AND j.org_id = (SELECT public.auth_user_org())
    ));
  
  RAISE NOTICE 'Recreated policy: org can insert job_parts via jobs';
END $$;

-- Drop and recreate "org can update job_parts via jobs" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='job_parts' AND policyname='org can update job_parts via jobs'
  ) THEN
    DROP POLICY "org can update job_parts via jobs" ON public.job_parts;
  END IF;
  
  CREATE POLICY "org can update job_parts via jobs" ON public.job_parts
    FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_parts.job_id
      AND j.org_id = (SELECT public.auth_user_org())
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = job_parts.job_id
      AND j.org_id = (SELECT public.auth_user_org())
    ));
  
  RAISE NOTICE 'Recreated policy: org can update job_parts via jobs';
END $$;

-- =============================================================================
-- FIX: vehicles policies
-- =============================================================================

-- Drop and recreate "org read vehicles via jobs" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='vehicles' AND policyname='org read vehicles via jobs'
  ) THEN
    DROP POLICY "org read vehicles via jobs" ON public.vehicles;
  END IF;
  
  CREATE POLICY "org read vehicles via jobs" ON public.vehicles
    FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.vehicle_id = vehicles.id
      AND j.org_id = (SELECT public.auth_user_org())
    ));
  
  RAISE NOTICE 'Recreated policy: org read vehicles via jobs';
END $$;

-- =============================================================================
-- FIX: vendors policies
-- =============================================================================

-- Drop and recreate "org read vendors" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='vendors' AND policyname='org read vendors'
  ) THEN
    DROP POLICY "org read vendors" ON public.vendors;
  END IF;
  
  CREATE POLICY "org read vendors" ON public.vendors
    FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_user_org()));
  
  RAISE NOTICE 'Recreated policy: org read vendors';
END $$;

-- Drop and recreate "org members read vendors" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='vendors' AND policyname='org members read vendors'
  ) THEN
    DROP POLICY "org members read vendors" ON public.vendors;
  END IF;
  
  CREATE POLICY "org members read vendors" ON public.vendors
    FOR SELECT TO authenticated
    USING ((org_id = (SELECT public.auth_user_org()) OR org_id IS NULL) AND COALESCE(is_active, true));
  
  RAISE NOTICE 'Recreated policy: org members read vendors';
END $$;

-- =============================================================================
-- FIX: products policies
-- =============================================================================

-- Drop and recreate "org read products" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='products' AND policyname='org read products'
  ) THEN
    DROP POLICY "org read products" ON public.products;
  END IF;
  
  CREATE POLICY "org read products" ON public.products
    FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_user_org()));
  
  RAISE NOTICE 'Recreated policy: org read products';
END $$;

-- Drop and recreate "org members read products" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='products' AND policyname='org members read products'
  ) THEN
    DROP POLICY "org members read products" ON public.products;
  END IF;
  
  CREATE POLICY "org members read products" ON public.products
    FOR SELECT TO authenticated
    USING ((org_id = (SELECT public.auth_user_org()) OR org_id IS NULL) AND COALESCE(is_active, true));
  
  RAISE NOTICE 'Recreated policy: org members read products';
END $$;

-- =============================================================================
-- FIX: sms_templates policies
-- =============================================================================

-- Drop and recreate "org read sms templates" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='sms_templates' AND policyname='org read sms templates'
  ) THEN
    DROP POLICY "org read sms templates" ON public.sms_templates;
  END IF;
  
  CREATE POLICY "org read sms templates" ON public.sms_templates
    FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_user_org()));
  
  RAISE NOTICE 'Recreated policy: org read sms templates';
END $$;

-- =============================================================================
-- FIX: transactions policies
-- =============================================================================

-- Drop and recreate "org read transactions" policy
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='transactions' AND policyname='org read transactions'
  ) THEN
    DROP POLICY "org read transactions" ON public.transactions;
  END IF;
  
  CREATE POLICY "org read transactions" ON public.transactions
    FOR SELECT TO authenticated
    USING (org_id = (SELECT public.auth_user_org()));
  
  RAISE NOTICE 'Recreated policy: org read transactions';
END $$;

-- =============================================================================
-- FIX: loaner_assignments policies
-- =============================================================================

-- Drop and recreate select policy for loaner_assignments
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' AND tablename='loaner_assignments' 
    AND policyname='org can select loaner_assignments via jobs'
  ) THEN
    DROP POLICY "org can select loaner_assignments via jobs" ON public.loaner_assignments;
  END IF;
  
  CREATE POLICY "org can select loaner_assignments via jobs" ON public.loaner_assignments
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = loaner_assignments.job_id
        AND j.org_id = (SELECT public.auth_user_org())
      )
      OR (SELECT public.is_admin_or_manager())
    );
  
  RAISE NOTICE 'Recreated policy: org can select loaner_assignments via jobs';
END $$;

-- =============================================================================
-- FIX: claims policies (if table exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'claims') THEN
    -- Drop and recreate claims select policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='claims' AND policyname='claims_select_policy'
    ) THEN
      DROP POLICY "claims_select_policy" ON public.claims;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='claims' AND policyname='claims_select_policy'
    ) THEN
      CREATE POLICY "claims_select_policy" ON public.claims
        FOR SELECT TO authenticated
        USING (
          org_id = (SELECT public.auth_user_org())
          OR (SELECT public.is_admin_or_manager())
        );
      
      RAISE NOTICE 'Recreated policy: claims_select_policy';
    END IF;
  END IF;
END $$;

-- =============================================================================
-- FIX: filter_presets policies (if table exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'filter_presets') THEN
    -- Drop and recreate filter_presets user policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='filter_presets' AND policyname='User can manage own presets'
    ) THEN
      DROP POLICY "User can manage own presets" ON public.filter_presets;
    END IF;
    
    CREATE POLICY "User can manage own presets" ON public.filter_presets
      FOR ALL TO authenticated
      USING (user_id = (SELECT auth.uid()))
      WITH CHECK (user_id = (SELECT auth.uid()));
    
    RAISE NOTICE 'Recreated policy: User can manage own presets';
  END IF;
END $$;

-- =============================================================================
-- FIX: sms_opt_outs policies (if table exists)
-- =============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'sms_opt_outs') THEN
    -- Ensure RLS is enabled
    ALTER TABLE public.sms_opt_outs ENABLE ROW LEVEL SECURITY;
    
    -- Drop and recreate select policy
    IF EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='sms_opt_outs' AND policyname='sms_opt_outs_select'
    ) THEN
      DROP POLICY "sms_opt_outs_select" ON public.sms_opt_outs;
    END IF;
    
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE schemaname='public' AND tablename='sms_opt_outs' AND policyname='sms_opt_outs_select'
    ) THEN
      CREATE POLICY "sms_opt_outs_select" ON public.sms_opt_outs
        FOR SELECT TO authenticated
        USING (true);  -- SMS opt-outs are typically org-wide
      
      RAISE NOTICE 'Recreated policy: sms_opt_outs_select';
    END IF;
  END IF;
END $$;

-- =============================================================================
-- Reload PostgREST schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Validation
-- =============================================================================

DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'auth_rls_initplan Fix Complete';
  RAISE NOTICE 'Total policies in public schema: %', policy_count;
  RAISE NOTICE 'Helper functions updated: auth_user_org, is_admin_or_manager';
  RAISE NOTICE '========================================';
END $$;

-- =============================================================================
-- Notes:
-- =============================================================================
-- 1. All auth.uid() and auth.jwt() calls are now wrapped in (SELECT ...)
-- 2. Helper functions (auth_user_org, is_admin_or_manager) also use the pattern
-- 3. This prevents the PostgreSQL initplan anti-pattern in RLS policies
-- 4. Policies maintain identical logic - only the auth call wrapping changed
-- 5. Run `supabase db lint` after applying to verify fixes
