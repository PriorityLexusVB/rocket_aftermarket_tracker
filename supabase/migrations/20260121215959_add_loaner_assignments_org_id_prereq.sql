-- Prereq fix for Phase 7 FK index migrations
--
-- Prod error observed during `sb:db:push:prod`:
--   ERROR: column "org_id" does not exist (SQLSTATE 42703)
--   while creating idx_loaner_assignments_org_id
--
-- Some environments have loaner_assignments.org_id; others only have dealer_id.
-- Phase 7 index migrations assume org_id exists, so we add it safely here.

ALTER TABLE public.loaner_assignments
  ADD COLUMN IF NOT EXISTS org_id uuid NULL
  REFERENCES public.organizations(id)
  ON DELETE CASCADE;

-- Best-effort backfill when dealer_id exists and org_id is missing.
-- (In many environments dealer_id effectively represents org scope.)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'loaner_assignments'
      AND column_name = 'dealer_id'
  ) THEN
    UPDATE public.loaner_assignments
    SET org_id = dealer_id
    WHERE org_id IS NULL
      AND dealer_id IS NOT NULL;
  END IF;
END
$$;
