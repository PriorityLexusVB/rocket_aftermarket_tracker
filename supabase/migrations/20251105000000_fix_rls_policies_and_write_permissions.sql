-- Fix RLS policies and add missing write permissions
-- Created: 2025-11-05
-- Issue: RLS policies fail with "permission denied for table users" because 
--        some policies reference auth.users table directly
-- Solution: Update policies to use only public.user_profiles and add missing write policies

-- 1. Fix loaner_assignments policy that references auth.users
-- Drop the problematic policy and recreate it using public.user_profiles
DO $$
BEGIN
  -- Drop old policy if it exists
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='loaner_assignments' 
    AND policyname='managers_manage_loaner_assignments'
  ) THEN
    EXECUTE 'DROP POLICY "managers_manage_loaner_assignments" ON public.loaner_assignments';
  END IF;
  
  -- Create new policy using public.is_admin_or_manager() function
  EXECUTE '
    CREATE POLICY "managers_manage_loaner_assignments" ON public.loaner_assignments
    FOR ALL TO authenticated
    USING (public.is_admin_or_manager())
    WITH CHECK (public.is_admin_or_manager());
  ';
END $$;

-- 2. Add write policies for loaner_assignments with org scoping
-- These allow regular users to insert/update loaner assignments for jobs in their org
DO $$
BEGIN
  -- Insert policy: users can create loaner assignments for jobs in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='loaner_assignments' 
    AND policyname='org can insert loaner_assignments via jobs'
  ) THEN
    EXECUTE '
      CREATE POLICY "org can insert loaner_assignments via jobs" ON public.loaner_assignments
      FOR INSERT TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.jobs j 
          WHERE j.id = loaner_assignments.job_id 
          AND j.org_id = public.auth_user_org()
        )
      );
    ';
  END IF;

  -- Update policy: users can update loaner assignments for jobs in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='loaner_assignments' 
    AND policyname='org can update loaner_assignments via jobs'
  ) THEN
    EXECUTE '
      CREATE POLICY "org can update loaner_assignments via jobs" ON public.loaner_assignments
      FOR UPDATE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.jobs j 
          WHERE j.id = loaner_assignments.job_id 
          AND j.org_id = public.auth_user_org()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.jobs j 
          WHERE j.id = loaner_assignments.job_id 
          AND j.org_id = public.auth_user_org()
        )
      );
    ';
  END IF;

  -- Delete policy: users can delete loaner assignments for jobs in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='loaner_assignments' 
    AND policyname='org can delete loaner_assignments via jobs'
  ) THEN
    EXECUTE '
      CREATE POLICY "org can delete loaner_assignments via jobs" ON public.loaner_assignments
      FOR DELETE TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.jobs j 
          WHERE j.id = loaner_assignments.job_id 
          AND j.org_id = public.auth_user_org()
        )
      );
    ';
  END IF;
END $$;

-- 3. Add write policies for transactions table with org scoping
DO $$
BEGIN
  -- Insert policy: users can create transactions for jobs in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='transactions' 
    AND policyname='org can insert transactions'
  ) THEN
    EXECUTE '
      CREATE POLICY "org can insert transactions" ON public.transactions
      FOR INSERT TO authenticated
      WITH CHECK (
        org_id = public.auth_user_org() OR
        EXISTS (
          SELECT 1 FROM public.jobs j 
          WHERE j.id = transactions.job_id 
          AND j.org_id = public.auth_user_org()
        )
      );
    ';
  END IF;

  -- Update policy: users can update transactions for their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='transactions' 
    AND policyname='org can update transactions'
  ) THEN
    EXECUTE '
      CREATE POLICY "org can update transactions" ON public.transactions
      FOR UPDATE TO authenticated
      USING (
        org_id = public.auth_user_org() OR
        EXISTS (
          SELECT 1 FROM public.jobs j 
          WHERE j.id = transactions.job_id 
          AND j.org_id = public.auth_user_org()
        )
      )
      WITH CHECK (
        org_id = public.auth_user_org() OR
        EXISTS (
          SELECT 1 FROM public.jobs j 
          WHERE j.id = transactions.job_id 
          AND j.org_id = public.auth_user_org()
        )
      );
    ';
  END IF;
END $$;

-- 4. Add write policies for vehicles table with org scoping
DO $$
BEGIN
  -- Insert policy: users can create vehicles in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='vehicles' 
    AND policyname='org can insert vehicles'
  ) THEN
    EXECUTE '
      CREATE POLICY "org can insert vehicles" ON public.vehicles
      FOR INSERT TO authenticated
      WITH CHECK (org_id = public.auth_user_org() OR org_id IS NULL);
    ';
  END IF;

  -- Update policy: users can update vehicles in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='vehicles' 
    AND policyname='org can update vehicles'
  ) THEN
    EXECUTE '
      CREATE POLICY "org can update vehicles" ON public.vehicles
      FOR UPDATE TO authenticated
      USING (org_id = public.auth_user_org() OR org_id IS NULL)
      WITH CHECK (org_id = public.auth_user_org() OR org_id IS NULL);
    ';
  END IF;
END $$;

-- 5. Ensure RLS is enabled on all affected tables (idempotent)
ALTER TABLE IF EXISTS public.loaner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Successfully updated RLS policies to remove auth.users references and added write permissions';
END $$;
