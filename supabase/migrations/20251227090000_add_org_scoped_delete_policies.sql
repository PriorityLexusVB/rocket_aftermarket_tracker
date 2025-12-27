-- Migration: Add org-scoped DELETE policies for deals-related tables
-- Date: 2025-12-27
-- Purpose:
--   1. Allow any authenticated org member to DELETE jobs and related records.
--   2. Keep existing manager-only DELETE policies in place (policies OR together).
--   3. Ensure DELETE is tenant-scoped via auth_user_org() and parent job org checks.
--   4. Notify PostgREST to reload schema cache.
--
-- Notes:
--   - This migration is additive/low-risk: it does not remove or weaken existing policies beyond
--     granting org-scoped DELETE.
--   - Idempotent: policies are only created if missing.
--
-- Rollback (manual):
--   DROP POLICY IF EXISTS "org can delete jobs" ON public.jobs;
--   DROP POLICY IF EXISTS "org can delete job_parts via jobs" ON public.job_parts;
--   DROP POLICY IF EXISTS "org can delete transactions" ON public.transactions;
--   DROP POLICY IF EXISTS "org can delete communications via jobs" ON public.communications;

DO $$
BEGIN
  -- Jobs delete policy: org members can delete jobs in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='jobs' AND policyname='org can delete jobs'
  ) THEN
    CREATE POLICY "org can delete jobs" ON public.jobs
    FOR DELETE TO authenticated
    USING (
      org_id = public.auth_user_org()
    );
    RAISE NOTICE 'Created policy: org can delete jobs';
  END IF;

  -- Job parts delete policy: org members can delete job_parts for jobs in their org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='job_parts' AND policyname='org can delete job_parts via jobs'
  ) THEN
    CREATE POLICY "org can delete job_parts via jobs" ON public.job_parts
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.id = job_parts.job_id
          AND j.org_id = public.auth_user_org()
      )
    );
    RAISE NOTICE 'Created policy: org can delete job_parts via jobs';
  END IF;

  -- Transactions delete policy: org members can delete transactions in their org
  -- Prefer org_id when present, but also allow via parent job org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transactions' AND policyname='org can delete transactions'
  ) THEN
    CREATE POLICY "org can delete transactions" ON public.transactions
    FOR DELETE TO authenticated
    USING (
      org_id = public.auth_user_org()
      OR EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.id = transactions.job_id
          AND j.org_id = public.auth_user_org()
      )
    );
    RAISE NOTICE 'Created policy: org can delete transactions';
  END IF;

  -- Communications delete policy: org members can delete communications via parent job org
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='communications' AND policyname='org can delete communications via jobs'
  ) THEN
    CREATE POLICY "org can delete communications via jobs" ON public.communications
    FOR DELETE TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.jobs j
        WHERE j.id = communications.job_id
          AND j.org_id = public.auth_user_org()
      )
    );
    RAISE NOTICE 'Created policy: org can delete communications via jobs';
  END IF;
END $$;

-- Idempotent RLS enable (safety)
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.communications ENABLE ROW LEVEL SECURITY;

-- Notify PostgREST to reload schema cache so new policies are recognized immediately.
NOTIFY pgrst, 'reload schema';

-- Validation block: Confirm delete policies were created
DO $$
DECLARE
  jobs_delete_policy_exists BOOLEAN;
  job_parts_delete_policy_exists BOOLEAN;
  transactions_delete_policy_exists BOOLEAN;
  communications_delete_policy_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='jobs'
      AND policyname='org can delete jobs'
  ) INTO jobs_delete_policy_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='job_parts'
      AND policyname='org can delete job_parts via jobs'
  ) INTO job_parts_delete_policy_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='transactions'
      AND policyname='org can delete transactions'
  ) INTO transactions_delete_policy_exists;

  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
      AND tablename='communications'
      AND policyname='org can delete communications via jobs'
  ) INTO communications_delete_policy_exists;

  RAISE NOTICE 'Jobs org DELETE policy exists: %', jobs_delete_policy_exists;
  RAISE NOTICE 'Job parts org DELETE policy exists: %', job_parts_delete_policy_exists;
  RAISE NOTICE 'Transactions org DELETE policy exists: %', transactions_delete_policy_exists;
  RAISE NOTICE 'Communications org DELETE policy exists: %', communications_delete_policy_exists;

  IF NOT (jobs_delete_policy_exists AND job_parts_delete_policy_exists AND transactions_delete_policy_exists AND communications_delete_policy_exists) THEN
    RAISE WARNING 'One or more org-scoped DELETE policies were not created successfully';
  END IF;
END $$;
