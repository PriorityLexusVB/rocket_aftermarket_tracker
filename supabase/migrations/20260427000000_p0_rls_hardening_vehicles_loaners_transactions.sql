-- =============================================================================
-- P0 RLS hardening: vehicles, loaner_assignments, transactions
-- Created: 2026-04-26
-- Source:  AUDIT-rocket-aftermarket-2026-04-26.md (P0-3, P1-4, P1-6)
-- =============================================================================
--
-- Three issues are being closed in a single migration because they share the
-- same blast radius (cross-tenant data exposure on write paths) and the same
-- rollback strategy (a follow-up migration restoring the old policies).
--
-- 1. P0-3  vehicles INSERT/UPDATE allowed `org_id IS NULL`. Any authenticated
--          user could create a vehicle with NULL org_id; null-org-id rows
--          leak across tenants depending on read path.
--          Source: 20251105000000_fix_rls_policies_and_write_permissions.sql:169
--
-- 2. P1-4  managers_manage_loaner_assignments was `USING (is_admin_or_manager())`
--          with no org scoping. A manager from Org A could touch loaner rows
--          in Org B. Theoretical with one store today, real once a second
--          store onboards.
--          Source: 20251115222458_fix_loaner_assignments_rls_auth_users.sql:14-23
--
-- 3. P1-6  transactions INSERT/UPDATE used OR-logic between an org_id check
--          and an EXISTS subquery on jobs. If the EXISTS path failed open
--          (or the row had no job linkage), the OR let the first clause
--          carry the day. Should be AND.
--          Source: 20251105000000_fix_rls_policies_and_write_permissions.sql:116-121, 137-151
--
-- All three fixes drop the existing policy by name and recreate it with
-- tighter logic. Idempotent.
--
-- Rollback strategy: a NEW migration that drops the policies created here
-- and recreates the prior ones. Do NOT edit this migration in place.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. vehicles: backfill NULL org_id rows, then tighten write policies
-- -----------------------------------------------------------------------------

-- Best-effort backfill: assign NULL-org vehicles to the org_id of the most
-- recent referencing job. Vehicles with no jobs at all are left NULL; they
-- are unreachable via the SELECT policy regardless, but we log the count
-- so ops can clean them up manually if needed.
DO $$
DECLARE
  v_backfilled INT;
  v_orphans INT;
BEGIN
  WITH backfill AS (
    UPDATE public.vehicles v
    SET org_id = (
      SELECT j.org_id
      FROM public.jobs j
      WHERE j.vehicle_id = v.id
        AND j.org_id IS NOT NULL
      ORDER BY j.created_at DESC
      LIMIT 1
    )
    WHERE v.org_id IS NULL
      AND EXISTS (
        SELECT 1 FROM public.jobs j2
        WHERE j2.vehicle_id = v.id AND j2.org_id IS NOT NULL
      )
    RETURNING v.id
  )
  SELECT COUNT(*) INTO v_backfilled FROM backfill;

  SELECT COUNT(*) INTO v_orphans FROM public.vehicles WHERE org_id IS NULL;

  RAISE NOTICE 'vehicles backfill: % rows updated, % orphans remain (no linked job, will need manual review)', v_backfilled, v_orphans;
END $$;

-- Drop the old policies (regardless of which prior migration created them).
DROP POLICY IF EXISTS "org can insert vehicles" ON public.vehicles;
DROP POLICY IF EXISTS "org can update vehicles" ON public.vehicles;

-- Recreate without the `OR org_id IS NULL` escape hatch.
CREATE POLICY "org can insert vehicles" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.auth_user_org());

CREATE POLICY "org can update vehicles" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (org_id = public.auth_user_org())
  WITH CHECK (org_id = public.auth_user_org());

COMMENT ON POLICY "org can insert vehicles" ON public.vehicles IS
  'P0 hardening 2026-04-26: tightened to require org_id = auth_user_org(). Removed the OR org_id IS NULL escape hatch from 20251105000000.';

COMMENT ON POLICY "org can update vehicles" ON public.vehicles IS
  'P0 hardening 2026-04-26: tightened to require org_id = auth_user_org(). Removed the OR org_id IS NULL escape hatch from 20251105000000.';

-- -----------------------------------------------------------------------------
-- 2. loaner_assignments: add org check to the manager override policy
-- -----------------------------------------------------------------------------
-- Prior policy was `USING (is_admin_or_manager())` with no org filter. We now
-- require either a direct org_id match (column added in
-- 20260121215959_add_loaner_assignments_org_id_prereq.sql) or, when org_id is
-- still NULL on legacy rows, fall back to the linked job's org.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "managers_manage_loaner_assignments" ON public.loaner_assignments;

CREATE POLICY "managers_manage_loaner_assignments"
  ON public.loaner_assignments
  FOR ALL
  TO authenticated
  USING (
    public.is_admin_or_manager()
    AND (
      org_id = public.auth_user_org()
      OR (
        org_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = loaner_assignments.job_id
            AND j.org_id = public.auth_user_org()
        )
      )
    )
  )
  WITH CHECK (
    public.is_admin_or_manager()
    AND (
      org_id = public.auth_user_org()
      OR (
        org_id IS NULL
        AND EXISTS (
          SELECT 1 FROM public.jobs j
          WHERE j.id = loaner_assignments.job_id
            AND j.org_id = public.auth_user_org()
        )
      )
    )
  );

COMMENT ON POLICY "managers_manage_loaner_assignments" ON public.loaner_assignments IS
  'P0 hardening 2026-04-26: added org scoping. Was previously `USING (is_admin_or_manager())` with no tenant filter, allowing managers to touch loaner rows outside their org. Falls back to the linked job''s org_id for legacy rows where loaner_assignments.org_id is still NULL.';

-- -----------------------------------------------------------------------------
-- 3. transactions: tighten INSERT/UPDATE policies (OR -> AND)
-- -----------------------------------------------------------------------------
-- Prior policy permitted writes when EITHER the row's org_id matched the
-- caller's org OR the linked job belonged to the caller's org. That OR is
-- weaker than intended: a row with mismatched org_id but no job linkage
-- could still slip through. We require both to hold.
-- -----------------------------------------------------------------------------

DROP POLICY IF EXISTS "org can insert transactions" ON public.transactions;
DROP POLICY IF EXISTS "org can update transactions" ON public.transactions;

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

CREATE POLICY "org can update transactions" ON public.transactions
  FOR UPDATE TO authenticated
  USING (org_id = public.auth_user_org())
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

COMMENT ON POLICY "org can insert transactions" ON public.transactions IS
  'P0 hardening 2026-04-26: changed OR to AND. Row must match caller org AND, if linked to a job, that job must also be in caller org.';

COMMENT ON POLICY "org can update transactions" ON public.transactions IS
  'P0 hardening 2026-04-26: changed OR to AND. USING checks org_id alone (the row the user can already see). WITH CHECK requires both org_id match and matching job org.';


-- -----------------------------------------------------------------------------
-- 4. Default-org-id triggers for write paths that omit org_id
-- -----------------------------------------------------------------------------
-- After tightening the WITH CHECK above, any client INSERT that does not pass
-- an explicit org_id will fail. Several existing services (dealCRUD.js
-- attachVehicle and the loaner / transaction creation paths) build payloads
-- without org_id, relying on the column being optional.
--
-- Rather than chase each call-site (which would be a much larger PR and
-- leaves a future code path one bug away from breaking again), we mirror the
-- already-established jobs trigger from
-- 20251022220500_set_default_org_for_jobs.sql onto vehicles,
-- transactions, and loaner_assignments. The trigger function
-- public.set_default_org_id() is generic and SECURITY DEFINER; it is reused
-- as-is.
-- -----------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'bi_vehicles_set_default_org_id'
      AND n.nspname = 'public'
      AND c.relname = 'vehicles'
  ) THEN
    CREATE TRIGGER bi_vehicles_set_default_org_id
    BEFORE INSERT ON public.vehicles
    FOR EACH ROW
    EXECUTE FUNCTION public.set_default_org_id();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'bi_transactions_set_default_org_id'
      AND n.nspname = 'public'
      AND c.relname = 'transactions'
  ) THEN
    CREATE TRIGGER bi_transactions_set_default_org_id
    BEFORE INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.set_default_org_id();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname = 'bi_loaner_assignments_set_default_org_id'
      AND n.nspname = 'public'
      AND c.relname = 'loaner_assignments'
  ) THEN
    CREATE TRIGGER bi_loaner_assignments_set_default_org_id
    BEFORE INSERT ON public.loaner_assignments
    FOR EACH ROW
    EXECUTE FUNCTION public.set_default_org_id();
  END IF;
END $$;

-- -----------------------------------------------------------------------------
-- 5. Schema cache reload so PostgREST picks up the new policies promptly.
-- -----------------------------------------------------------------------------
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Verification (read-only sanity checks)
-- =============================================================================
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND policyname IN (
      'org can insert vehicles',
      'org can update vehicles',
      'managers_manage_loaner_assignments',
      'org can insert transactions',
      'org can update transactions'
    );

  IF v_count <> 5 THEN
    RAISE EXCEPTION 'Expected 5 policies after hardening migration, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND t.tgname IN (
      'bi_vehicles_set_default_org_id',
      'bi_transactions_set_default_org_id',
      'bi_loaner_assignments_set_default_org_id'
    );

  IF v_count <> 3 THEN
    RAISE EXCEPTION 'Expected 3 default-org triggers, found %', v_count;
  END IF;

  RAISE NOTICE 'P0 RLS hardening: 5/5 policies + 3/3 default-org triggers verified.';
END $$;
