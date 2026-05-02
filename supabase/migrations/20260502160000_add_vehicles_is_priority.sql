-- Migration: Add is_priority flag to vehicles
-- Location: supabase/migrations/20260502160000_add_vehicles_is_priority.sql
-- Purpose: Allow coordinators to mark individual vehicles as high-priority for
--   expedited attention (e.g. bulk-action handler in the coordinator UI).
--
-- Threat model / access control:
--   - public.vehicles already has RLS enabled (enabled in
--     20251022180000_add_organizations_and_minimal_rls.sql).
--   - All existing SELECT / INSERT / UPDATE policies on public.vehicles are
--     org-scoped: only authenticated users whose user_profiles.org_id matches
--     the vehicle's org_id can read or write rows.
--   - is_priority is a plain column on the row — it inherits those policies
--     automatically. No additional GRANT is required, and none is issued here.
--   - anon role: no GRANT EXECUTE or GRANT SELECT is given to anon anywhere in
--     this migration. The anon role cannot read or write is_priority.
--
-- Replayability (Rule 15):
--   Both the ALTER TABLE and CREATE INDEX use IF NOT EXISTS guards, so this
--   migration is safe to run against a DB that already applied it.

-- Step 1: Add is_priority column
ALTER TABLE public.vehicles
  ADD COLUMN IF NOT EXISTS is_priority BOOLEAN NOT NULL DEFAULT false;

-- Step 2: Partial index — only indexes the minority of rows where is_priority
--   is true, keeping the index small and scans fast for the coordinator's
--   "show me all priority vehicles" query.
CREATE INDEX IF NOT EXISTS idx_vehicles_is_priority
  ON public.vehicles(id)
  WHERE is_priority = true;

-- Step 3: Verify the column was created (replay-safe: re-runs cleanly if it
--   already exists because the check reads information_schema, not DDL state).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'vehicles'
      AND column_name  = 'is_priority'
  ) THEN
    RAISE EXCEPTION
      'Migration 20260502160000: column public.vehicles.is_priority was NOT found after ALTER TABLE — migration did not apply cleanly.';
  ELSE
    RAISE NOTICE
      'Migration 20260502160000: column public.vehicles.is_priority verified present. Migration applied successfully.';
  END IF;
END$$;
