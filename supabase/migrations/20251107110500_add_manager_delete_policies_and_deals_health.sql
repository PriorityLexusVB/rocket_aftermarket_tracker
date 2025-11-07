-- Migration: Add manager delete policies for core org-scoped tables & reinforce RLS completeness
-- Date: 2025-11-07
-- Purpose:
--   1. Ensure DELETE operations are explicitly limited to managers/admins for vehicles, transactions, loaner_assignments.
--   2. Provide consistent pattern across all multi-tenant tables (jobs already use cascade via function; job_parts deletes via job cascade).
--   3. Emit schema cache reload to guarantee PostgREST sees new policies quickly.
--   4. Supply validation notices to aid audit scripts.
-- Dependencies:
--   - Helper functions: public.auth_user_org(), public.is_admin_or_manager()
--   - Prior migrations establishing org_id columns and base write policies.

DO $$
BEGIN
  -- Vehicles delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='vehicles' AND policyname='managers can delete vehicles'
  ) THEN
    EXECUTE 'CREATE POLICY "managers can delete vehicles" ON public.vehicles FOR DELETE TO authenticated USING (public.is_admin_or_manager());';
    RAISE NOTICE 'Created policy: managers can delete vehicles';
  END IF;

  -- Transactions delete policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='transactions' AND policyname='managers can delete transactions'
  ) THEN
    EXECUTE 'CREATE POLICY "managers can delete transactions" ON public.transactions FOR DELETE TO authenticated USING (public.is_admin_or_manager());';
    RAISE NOTICE 'Created policy: managers can delete transactions';
  END IF;

  -- Loaner assignments delete policy (manager override beyond org scoped deletes)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='loaner_assignments' AND policyname='managers can delete loaner_assignments'
  ) THEN
    EXECUTE 'CREATE POLICY "managers can delete loaner_assignments" ON public.loaner_assignments FOR DELETE TO authenticated USING (public.is_admin_or_manager());';
    RAISE NOTICE 'Created policy: managers can delete loaner_assignments';
  END IF;
END $$;

-- Idempotent RLS enable (safety)
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.loaner_assignments ENABLE ROW LEVEL SECURITY;

-- Notify PostgREST to reload schema cache so new policies are recognized immediately.
NOTIFY pgrst, 'reload schema';

-- Validation block: Counts delete policies just added (or previously existing)
DO $$
DECLARE
  delete_policy_count INT;
BEGIN
  SELECT COUNT(*) INTO delete_policy_count
  FROM pg_policies
  WHERE schemaname='public'
    AND tablename IN ('vehicles','transactions','loaner_assignments')
    AND policyname LIKE 'managers can delete %';
  RAISE NOTICE 'Manager delete policies present: %', delete_policy_count;
END $$;
