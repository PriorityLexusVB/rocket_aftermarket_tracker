-- Fix loaner manager policy (P1-4) and transactions INSERT policy (P1-6)
-- Created: 2026-04-30
--
-- P1-4: managers_manage_loaner_assignments used FOR ALL with is_admin_or_manager() but
--       no org_id check, allowing cross-tenant access for any admin/manager user.
-- P1-6: "org can insert transactions" used OR logic — either org_id matches OR a linked
--       job belongs to the org. OR allows inserting a transaction with any org_id as long
--       as the job lookup succeeds, creating cross-tenant rows.
--
-- Rule 15 (replayability): All operations use DROP POLICY IF EXISTS + CREATE POLICY.
--   No data-state dependencies; safe to replay against a fresh DB.
-- Rule 16 (anon-grant): No anon grants in this migration.

-- -----------------------------------------------------------------------
-- P1-4: Loaner assignments — add org_id tenant scope to manager policy
-- -----------------------------------------------------------------------

DROP POLICY IF EXISTS "managers_manage_loaner_assignments" ON public.loaner_assignments;

CREATE POLICY "managers_manage_loaner_assignments" ON public.loaner_assignments
  FOR ALL TO authenticated
  USING (
    public.is_admin_or_manager()
    AND org_id = public.auth_user_org()
  )
  WITH CHECK (
    public.is_admin_or_manager()
    AND org_id = public.auth_user_org()
  );

-- -----------------------------------------------------------------------
-- P1-6: Transactions INSERT — replace OR with AND to prevent cross-tenant rows
-- -----------------------------------------------------------------------

DROP POLICY IF EXISTS "org can insert transactions" ON public.transactions;

CREATE POLICY "org can insert transactions" ON public.transactions
  FOR INSERT TO authenticated
  WITH CHECK (
    org_id = public.auth_user_org()
    AND (
      job_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = transactions.job_id
          AND j.org_id = public.auth_user_org()
      )
    )
  );

-- -----------------------------------------------------------------------
-- P1-6: Transactions UPDATE — same AND correction for consistency
-- -----------------------------------------------------------------------

DROP POLICY IF EXISTS "org can update transactions" ON public.transactions;

CREATE POLICY "org can update transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (
    org_id = public.auth_user_org()
    AND (
      job_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = transactions.job_id
          AND j.org_id = public.auth_user_org()
      )
    )
  )
  WITH CHECK (
    org_id = public.auth_user_org()
    AND (
      job_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = transactions.job_id
          AND j.org_id = public.auth_user_org()
      )
    )
  );

-- Ensure RLS remains enabled (idempotent)
ALTER TABLE IF EXISTS public.loaner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'loaner_assignments and transactions RLS policies updated — OR replaced with AND, org_id tenant scope enforced';
END $$;
