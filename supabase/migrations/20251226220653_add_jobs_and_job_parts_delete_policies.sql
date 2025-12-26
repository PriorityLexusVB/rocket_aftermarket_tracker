-- Migration: Add manager DELETE policies for jobs and job_parts
-- Date: 2025-12-26
-- Purpose:
--   1. Add DELETE RLS policies for jobs and job_parts tables so managers can delete deals
--   2. Ensure DELETE operations are explicitly limited to managers/admins (matching pattern from vehicles, transactions, loaner_assignments)
--   3. Include org scoping for additional safety
--   4. Emit schema cache reload to guarantee PostgREST sees new policies immediately
-- Dependencies:
--   - Helper functions: public.auth_user_org(), public.is_admin_or_manager()
--   - Prior migrations: 20251107110500_add_manager_delete_policies_and_deals_health.sql (established pattern)

DO $$
BEGIN
  -- Jobs delete policy: managers can delete jobs in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs' AND policyname='managers can delete jobs'
  ) THEN
    CREATE POLICY "managers can delete jobs" ON public.jobs 
    FOR DELETE TO authenticated 
    USING (
      public.is_admin_or_manager() 
      AND org_id = auth_user_org()
    );
    RAISE NOTICE 'Created policy: managers can delete jobs';
  END IF;

  -- Job parts delete policy: managers can delete job_parts for jobs in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_parts' AND policyname='managers can delete job_parts via jobs'
  ) THEN
    CREATE POLICY "managers can delete job_parts via jobs" ON public.job_parts 
    FOR DELETE TO authenticated 
    USING (
      public.is_admin_or_manager() 
      AND EXISTS (
        SELECT 1 FROM public.jobs j 
        WHERE j.id = job_parts.job_id 
        AND j.org_id = auth_user_org()
      )
    );
    RAISE NOTICE 'Created policy: managers can delete job_parts via jobs';
  END IF;
END $$;

-- Idempotent RLS enable (safety)
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_parts ENABLE ROW LEVEL SECURITY;

-- Notify PostgREST to reload schema cache so new policies are recognized immediately.
NOTIFY pgrst, 'reload schema';

-- Validation block: Confirm delete policies were created
DO $$
DECLARE
  jobs_delete_policy_exists BOOLEAN;
  job_parts_delete_policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='jobs' 
    AND policyname='managers can delete jobs'
  ) INTO jobs_delete_policy_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='job_parts' 
    AND policyname='managers can delete job_parts via jobs'
  ) INTO job_parts_delete_policy_exists;

  RAISE NOTICE 'Jobs DELETE policy exists: %', jobs_delete_policy_exists;
  RAISE NOTICE 'Job parts DELETE policy exists: %', job_parts_delete_policy_exists;

  IF NOT jobs_delete_policy_exists OR NOT job_parts_delete_policy_exists THEN
    RAISE WARNING 'One or more DELETE policies were not created successfully';
  END IF;
END $$;
