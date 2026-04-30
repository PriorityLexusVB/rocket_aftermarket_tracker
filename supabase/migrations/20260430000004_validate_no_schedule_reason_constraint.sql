-- Validate the job_parts_no_schedule_reason_chk constraint added NOT VALID in
-- 20251023000000_add_job_parts_no_schedule_reason_check.sql
-- Created: 2026-04-30
--
-- Constraint definition (from source migration):
--   requires_scheduling
--   OR (
--     NOT requires_scheduling
--     AND COALESCE(NULLIF(trim(no_schedule_reason), ''), NULL) IS NOT NULL
--   )
-- Fails for rows where requires_scheduling = false AND no_schedule_reason is NULL or blank.
--
-- Rule 15 (replayability): backfill uses a WHERE guard so re-running is a no-op.
--   VALIDATE CONSTRAINT is also idempotent — re-running on an already-valid constraint is safe.
-- Rule 16 (anon-grant): No anon grants in this migration.

-- 1. Backfill rows that would fail the constraint check.
--    Sets no_schedule_reason = 'legacy_unspecified' for any job_part where
--    requires_scheduling is false and no_schedule_reason is missing or blank.
DO $$
BEGIN
  IF to_regclass('public.job_parts') IS NULL THEN
    RAISE NOTICE 'job_parts table not found — skipping backfill';
    RETURN;
  END IF;

  UPDATE public.job_parts
  SET no_schedule_reason = 'legacy_unspecified'
  WHERE requires_scheduling = false
    AND COALESCE(NULLIF(trim(no_schedule_reason), ''), NULL) IS NULL;

  RAISE NOTICE 'Backfilled job_parts.no_schedule_reason for rows that would fail constraint';
END $$;

-- 2. Validate the constraint (safe to re-run — already-valid constraints are no-ops).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'job_parts'
      AND c.conname = 'job_parts_no_schedule_reason_chk'
  ) THEN
    RAISE NOTICE 'Constraint job_parts_no_schedule_reason_chk not found — skipping VALIDATE (table may not exist yet)';
    RETURN;
  END IF;
-- 2b. Run VALIDATE inside a guard so fresh-DB replay (without 20251023) doesn't error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'public'
      AND t.relname = 'job_parts'
      AND c.conname = 'job_parts_no_schedule_reason_chk'
  ) THEN
    RAISE NOTICE 'Constraint job_parts_no_schedule_reason_chk not found — skipping VALIDATE';
    RETURN;
  END IF;

  EXECUTE 'ALTER TABLE public.job_parts VALIDATE CONSTRAINT job_parts_no_schedule_reason_chk';
  RAISE NOTICE 'job_parts_no_schedule_reason_chk validated successfully';
END $$;
