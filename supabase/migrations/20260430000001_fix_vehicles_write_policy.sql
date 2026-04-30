-- Fix vehicles write policies: remove cross-tenant OR org_id IS NULL escape hatch
-- Created: 2026-04-30
-- Security: Closes P0-3 — any authenticated user could INSERT vehicles with org_id IS NULL,
--           creating cross-tenant rows invisible to org-scoped SELECT policies.
--
-- Rule 15 (replayability): All operations use DROP POLICY IF EXISTS + CREATE POLICY.
--   Backfill uses ON CONFLICT DO NOTHING equivalent (UPDATE with WHERE guard).
-- Rule 16 (anon-grant): No anon grants in this migration.

-- 1. Backfill NULL org_id rows — ONLY safe when exactly one org exists (single-tenant).
--    Assigning to an arbitrary org in multi-tenant would leak data; skip in that case.
DO $$
DECLARE
  fallback_org UUID;
  org_count    INT;
  backfill_count INT;
BEGIN
  SELECT COUNT(*) INTO org_count FROM public.organizations;

  IF org_count = 0 THEN
    RAISE NOTICE 'No organizations found — skipping vehicles org_id backfill';
    RETURN;
  END IF;

  IF org_count > 1 THEN
    RAISE NOTICE 'Multiple organizations found (%) — skipping automatic backfill to avoid cross-tenant data leak. Manually assign org_id to any NULL-org vehicles.', org_count;
    RETURN;
  END IF;

  -- Exactly one org: safe to assign.
  SELECT id INTO fallback_org FROM public.organizations LIMIT 1;

  UPDATE public.vehicles
  SET org_id = fallback_org
  WHERE org_id IS NULL;

  GET DIAGNOSTICS backfill_count = ROW_COUNT;
  RAISE NOTICE 'Backfilled % vehicle row(s) with org_id=%', backfill_count, fallback_org;
END $$;

-- 2. Drop and recreate INSERT policy WITHOUT the OR org_id IS NULL escape hatch.
DROP POLICY IF EXISTS "org can insert vehicles" ON public.vehicles;

CREATE POLICY "org can insert vehicles" ON public.vehicles
  FOR INSERT TO authenticated
  WITH CHECK (org_id = public.auth_user_org());

-- 3. Drop and recreate UPDATE policy WITHOUT the OR org_id IS NULL escape hatch.
DROP POLICY IF EXISTS "org can update vehicles" ON public.vehicles;

CREATE POLICY "org can update vehicles" ON public.vehicles
  FOR UPDATE TO authenticated
  USING (org_id = public.auth_user_org())
  WITH CHECK (org_id = public.auth_user_org());

-- 4. Ensure RLS remains enabled (idempotent).
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  RAISE NOTICE 'vehicles write policies updated — OR org_id IS NULL removed';
END $$;
