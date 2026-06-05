-- Wave XXX-V: Deal lifecycle 5-state collapse + reversal audit.
--
-- Source: docs/features/deal-lifecycle.md (3 specialist agents + 3 Codex rounds converged).
--
-- COLLAPSES enum from 9 values -> 5:
--   pending, scheduled, in_progress, completed, reversed
-- Migrated:
--   delivered     -> completed
--   cancelled     -> reversed (auto reason "historical:cancelled")
--   no_show       -> reversed (auto reason "historical:no_show")
--   quality_check -> in_progress (+ quality_checked_at timestamp preserves audit)
--   draft         -> pending
--
-- Adds reversal audit columns (reversed_at/by/reason, pre_reverse_status TEXT,
-- quality_checked_at) and a trigger that enforces those fields on transition
-- into 'reversed'. Also preserves the auto-completed_at logic from the
-- prior validate_job_status_change function (lifted into enforce_reversal_audit).
--
-- DROPS the strict validate_job_status_progression trigger + underlying
-- validate_job_status_change() function (3 prod incidents in 4 months — XXX-A,
-- XXX-B, XXX-S — and zero UI surface for its error message).
--
-- REWRITES validate_status_progression(text,text) for the 5-state graph
-- (app calls it client-side for UI gating); validate_vendor_job_scheduling()
-- to drop quality_check/delivered from the hardcoded list; get_overdue_jobs()
-- exclusion list; check_vehicle_overlap() to drop quality_check from the
-- active-booking set; adds reverse_deal(uuid, text) RPC with Rule-16 grants.
--
-- Pitfall #4 awareness: every DROP+CREATE of an RPC re-applies the explicit
-- REVOKE/GRANT pair after recreate.
--
-- Rule 14 (reproduction-runner gate), Rule 15 (replayable — uses
-- IF EXISTS / IF NOT EXISTS / CREATE OR REPLACE), Rule 16 (anon-grant scope).
--
-- Self-verifying DO block at the bottom asserts:
--   - enum has exactly 5 values
--   - 0 rows with retired status values
--   - validate_job_status_progression trigger DROPPED
--   - validate_job_status_change() function DROPPED
--   - enforce_reversal_audit_trigger PRESENT
--   - anon CANNOT EXECUTE reverse_deal (Rule 16)
--   - anon CANNOT EXECUTE get_overdue_jobs (pitfall #4)
--   - quality_checked_at, reversed_at columns PRESENT

BEGIN;

-- ============================================================================
-- STEP 1 — Add audit columns to jobs (compatible with OLD enum still in place)
-- pre_reverse_status stays TEXT permanently to preserve historical values
-- (e.g., 'cancelled', 'no_show') even after those enum values are gone.
-- ============================================================================

ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS reversed_at        TIMESTAMPTZ NULL,
  ADD COLUMN IF NOT EXISTS reversed_by        UUID        NULL,
  ADD COLUMN IF NOT EXISTS reversed_reason    TEXT        NULL,
  ADD COLUMN IF NOT EXISTS pre_reverse_status TEXT        NULL,
  ADD COLUMN IF NOT EXISTS quality_checked_at TIMESTAMPTZ NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'jobs_reversed_by_fkey'
  ) THEN
    ALTER TABLE public.jobs
      ADD CONSTRAINT jobs_reversed_by_fkey
      FOREIGN KEY (reversed_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ============================================================================
-- STEP 2 — Backfill audit data for rows being migrated (OLD enum still live)
-- ============================================================================

UPDATE public.jobs
SET quality_checked_at = COALESCE(updated_at, created_at)
WHERE job_status::TEXT = 'quality_check'
  AND quality_checked_at IS NULL;

UPDATE public.jobs
SET reversed_at      = COALESCE(updated_at, created_at),
    reversed_reason  = 'historical:cancelled',
    pre_reverse_status = 'cancelled'
WHERE job_status::TEXT = 'cancelled'
  AND reversed_at IS NULL;

UPDATE public.jobs
SET reversed_at      = COALESCE(updated_at, created_at),
    reversed_reason  = 'historical:no_show',
    pre_reverse_status = 'no_show'
WHERE job_status::TEXT = 'no_show'
  AND reversed_at IS NULL;

-- ============================================================================
-- STEP 3 — Drop triggers that depend on the job_status column BEFORE altering
-- enum (Codex round-1 catch + post-deploy catch on validate_vendor_job_scheduling_trigger)
-- ============================================================================

DROP TRIGGER IF EXISTS validate_job_status_progression ON public.jobs;
DROP FUNCTION IF EXISTS public.validate_job_status_change();

-- This trigger lists job_status in its OF column list -> creates column
-- dependency that blocks the ALTER COLUMN TYPE in Step 4.
DROP TRIGGER IF EXISTS validate_vendor_job_scheduling_trigger ON public.jobs;

-- ============================================================================
-- STEP 4 — Create new enum + swap column type with USING-cast mapping
-- (DROP DEFAULT first — Postgres can't auto-cast a defaulted enum value
-- to a new enum type)
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'job_status_v2') THEN
    CREATE TYPE public.job_status_v2 AS ENUM (
      'pending',
      'scheduled',
      'in_progress',
      'completed',
      'reversed'
    );
  END IF;
END $$;

ALTER TABLE public.jobs ALTER COLUMN job_status DROP DEFAULT;

ALTER TABLE public.jobs
  ALTER COLUMN job_status TYPE public.job_status_v2
  USING (
    CASE job_status::TEXT
      WHEN 'delivered'     THEN 'completed'
      WHEN 'cancelled'     THEN 'reversed'
      WHEN 'no_show'       THEN 'reversed'
      WHEN 'quality_check' THEN 'in_progress'
      WHEN 'draft'         THEN 'pending'
      ELSE job_status::TEXT
    END::public.job_status_v2
  );

-- ============================================================================
-- STEP 5 — Drop the old enum + rename new to canonical name + restore DEFAULT
-- ============================================================================

DROP TYPE public.job_status;
ALTER TYPE public.job_status_v2 RENAME TO job_status;

ALTER TABLE public.jobs
  ALTER COLUMN job_status SET DEFAULT 'pending'::public.job_status;

-- ============================================================================
-- STEP 6 — Reversal audit enforcement trigger
-- Preserves the auto-completed_at behavior that lived in the dropped
-- validate_job_status_change function (line 172 of 20250923142511).
-- ============================================================================

CREATE OR REPLACE FUNCTION public.enforce_reversal_audit()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Entering reversed: require audit fields
  IF NEW.job_status = 'reversed' AND (OLD.job_status IS DISTINCT FROM 'reversed') THEN
    IF NEW.reversed_at IS NULL THEN
      RAISE EXCEPTION 'reversed_at must be set when job_status transitions to reversed (job_id: %)', NEW.id;
    END IF;
    IF NEW.reversed_reason IS NULL OR LENGTH(TRIM(NEW.reversed_reason)) = 0 THEN
      RAISE EXCEPTION 'reversed_reason must be set when job_status transitions to reversed (job_id: %)', NEW.id;
    END IF;
    IF NEW.pre_reverse_status IS NULL THEN
      NEW.pre_reverse_status := OLD.job_status::TEXT;
    END IF;
  END IF;

  -- Leaving reversed: clear audit fields (pre_reverse_status preserved)
  IF OLD.job_status = 'reversed' AND NEW.job_status IS DISTINCT FROM 'reversed' THEN
    NEW.reversed_at     := NULL;
    NEW.reversed_by     := NULL;
    NEW.reversed_reason := NULL;
  END IF;

  -- Auto-set completed_at when entering completed (lifted from dropped fn)
  IF NEW.job_status = 'completed' AND (OLD.job_status IS DISTINCT FROM 'completed') THEN
    IF NEW.completed_at IS NULL THEN
      NEW.completed_at := CURRENT_TIMESTAMP;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_reversal_audit_trigger ON public.jobs;
CREATE TRIGGER enforce_reversal_audit_trigger
  BEFORE UPDATE OF job_status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.enforce_reversal_audit();

-- ============================================================================
-- STEP 7 — Rewrite validate_status_progression() with 5-state graph
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_status_progression(current_status text, new_status text)
RETURNS boolean LANGUAGE sql STABLE AS $$
SELECT CASE
  WHEN new_status = 'reversed'                                                       THEN true
  WHEN current_status = new_status                                                   THEN true
  WHEN current_status = 'pending'     AND new_status IN ('scheduled','in_progress')  THEN true
  WHEN current_status = 'scheduled'   AND new_status IN ('in_progress','completed')  THEN true
  WHEN current_status = 'in_progress' AND new_status IN ('completed','scheduled')    THEN true
  WHEN current_status = 'completed'   AND new_status = 'in_progress'                 THEN true
  ELSE false
END;
$$;

REVOKE EXECUTE ON FUNCTION public.validate_status_progression(text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.validate_status_progression(text, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.validate_status_progression(text, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.validate_status_progression(text, text) TO service_role;

-- ============================================================================
-- STEP 8 — Rewrite validate_vendor_job_scheduling() trigger function
-- (drop quality_check/delivered from the hardcoded list)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.validate_vendor_job_scheduling()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF COALESCE(NEW.vendor_id, OLD.vendor_id) IS NOT NULL
     AND NEW.scheduled_start_time IS NULL
     AND NEW.job_status IN ('scheduled','in_progress','completed') THEN
    RAISE EXCEPTION
      'Cannot move a vendor job to status "%" without a scheduled start time (job_id: %, vendor_id: %).',
      NEW.job_status, NEW.id, COALESCE(NEW.vendor_id, OLD.vendor_id);
  END IF;
  RETURN NEW;
END;
$$;

-- Recreate trigger dropped in Step 3 (was blocking the enum swap)
CREATE TRIGGER validate_vendor_job_scheduling_trigger
  BEFORE INSERT OR UPDATE OF vendor_id, scheduled_start_time, job_status ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.validate_vendor_job_scheduling();

-- ============================================================================
-- STEP 9 — Rewrite get_overdue_jobs() with new exclusion list (pitfall #4 grants)
-- ============================================================================

DROP FUNCTION IF EXISTS public.get_overdue_jobs();

CREATE FUNCTION public.get_overdue_jobs()
RETURNS TABLE(id uuid, title text, promised_date timestamptz, job_status text, vendor_name text, vehicle_info text, days_overdue integer)
LANGUAGE sql STABLE AS $$
SELECT
  j.id,
  j.title,
  COALESCE(j.promised_date, j.due_date) AS promised_date,
  j.job_status::TEXT,
  v.name AS vendor_name,
  CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model) AS vehicle_info,
  ((NOW() AT TIME ZONE 'America/New_York')::date
    - (COALESCE(j.promised_date, j.due_date) AT TIME ZONE 'America/New_York')::date)::INTEGER AS days_overdue
FROM public.jobs j
LEFT JOIN public.vendors v  ON j.vendor_id  = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
WHERE (COALESCE(j.promised_date, j.due_date) AT TIME ZONE 'America/New_York')::date
       < (NOW() AT TIME ZONE 'America/New_York')::date
  AND j.job_status NOT IN ('completed','reversed')
ORDER BY COALESCE(j.promised_date, j.due_date) ASC;
$$;

COMMENT ON FUNCTION public.get_overdue_jobs() IS
'Returns jobs whose canonical commitment date is in the past (ET-day boundary) and which are still actionable. Excludes the 2 terminal states under the 5-state model.';

REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_overdue_jobs() TO authenticated;
GRANT  EXECUTE ON FUNCTION public.get_overdue_jobs() TO service_role;

-- ============================================================================
-- STEP 10 — Rewrite check_vehicle_overlap() (drop quality_check from active set)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_vehicle_overlap(
    vehicle_id UUID,
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
SELECT EXISTS (
    SELECT 1
    FROM public.jobs j
    WHERE j.vehicle_id = check_vehicle_overlap.vehicle_id
      AND j.job_status IN ('pending','scheduled','in_progress')
      AND (exclude_id IS NULL OR j.id != exclude_id)
      AND (
          (j.scheduled_start_time < end_time AND j.scheduled_end_time > start_time)
          OR
          (j.scheduled_start_time IS NOT NULL AND j.scheduled_end_time IS NULL
           AND j.scheduled_start_time < end_time
           AND (j.scheduled_start_time + INTERVAL '1 hour') > start_time)
      )
);
$$;

REVOKE EXECUTE ON FUNCTION public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid) FROM anon;
GRANT  EXECUTE ON FUNCTION public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid) TO service_role;

-- ============================================================================
-- STEP 11 — reverse_deal(uuid, text) RPC (Rule-16 grants justified inline)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.reverse_deal(
  p_deal_id UUID,
  p_reason  TEXT
)
RETURNS public.jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_caller UUID;
  v_result public.jobs;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'reverse_deal requires an authenticated session';
  END IF;

  IF p_reason IS NULL OR LENGTH(TRIM(p_reason)) = 0 THEN
    RAISE EXCEPTION 'p_reason is required';
  END IF;

  UPDATE public.jobs
  SET job_status      = 'reversed',
      reversed_at     = NOW(),
      reversed_by     = v_caller,
      reversed_reason = p_reason
  WHERE id = p_deal_id
  RETURNING * INTO v_result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Deal not found: %', p_deal_id;
  END IF;

  RETURN v_result;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.reverse_deal(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reverse_deal(uuid, text) FROM anon;
GRANT  EXECUTE ON FUNCTION public.reverse_deal(uuid, text) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.reverse_deal(uuid, text) TO service_role;

COMMENT ON FUNCTION public.reverse_deal(uuid, text) IS
'Rule 16 grant scope justification:
Sentence 1: Only the authenticated coordinator/manager UI calls this — the Reverse button is behind a protected route requiring a valid session JWT; no anon path exists.
Sentence 2: The function writes job_status=reversed + reversed_at + reversed_by + reversed_reason on a jobs row scoped to the caller org — financial/operational data, must never be reachable by unauthenticated requests.';

COMMIT;

-- ============================================================================
-- STEP 12 — Post-migration self-verifying DO block (Codex round-3 expansion)
-- ============================================================================

DO $$
DECLARE
  v_enum_count       INT;
  v_dead_rows        INT;
  v_trigger_count    INT;
  v_func_count       INT;
  v_anon_can_reverse BOOLEAN;
  v_anon_can_overdue BOOLEAN;
BEGIN
  SELECT COUNT(*) INTO v_enum_count
  FROM pg_enum WHERE enumtypid = 'public.job_status'::regtype;
  IF v_enum_count != 5 THEN
    RAISE EXCEPTION 'ASSERT FAILED: job_status enum has % values, expected 5', v_enum_count;
  END IF;

  SELECT COUNT(*) INTO v_dead_rows
  FROM public.jobs
  WHERE job_status::TEXT NOT IN ('pending','scheduled','in_progress','completed','reversed');
  IF v_dead_rows > 0 THEN
    RAISE EXCEPTION 'ASSERT FAILED: % rows have invalid job_status values', v_dead_rows;
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger WHERE tgname = 'validate_job_status_progression';
  IF v_trigger_count > 0 THEN
    RAISE EXCEPTION 'ASSERT FAILED: validate_job_status_progression trigger still exists';
  END IF;

  SELECT COUNT(*) INTO v_func_count
  FROM pg_proc WHERE proname = 'validate_job_status_change';
  IF v_func_count > 0 THEN
    RAISE EXCEPTION 'ASSERT FAILED: validate_job_status_change() function still exists';
  END IF;

  SELECT COUNT(*) INTO v_trigger_count
  FROM pg_trigger WHERE tgname = 'enforce_reversal_audit_trigger';
  IF v_trigger_count = 0 THEN
    RAISE EXCEPTION 'ASSERT FAILED: enforce_reversal_audit_trigger missing';
  END IF;

  SELECT has_function_privilege('anon','public.reverse_deal(uuid, text)','EXECUTE') INTO v_anon_can_reverse;
  IF v_anon_can_reverse THEN
    RAISE EXCEPTION 'ASSERT FAILED: anon has EXECUTE on reverse_deal — Rule 16 violation';
  END IF;

  SELECT has_function_privilege('anon','public.get_overdue_jobs()','EXECUTE') INTO v_anon_can_overdue;
  IF v_anon_can_overdue THEN
    RAISE EXCEPTION 'ASSERT FAILED: anon has EXECUTE on get_overdue_jobs — pitfall #4 grant strip';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jobs' AND column_name='quality_checked_at'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAILED: quality_checked_at column missing';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='jobs' AND column_name='reversed_at'
  ) THEN
    RAISE EXCEPTION 'ASSERT FAILED: reversed_at column missing';
  END IF;

  RAISE NOTICE 'WAVE XXX-V ASSERTIONS PASSED: 5-value enum, 0 invalid rows, strict trigger DROPPED, audit trigger PRESENT, reverse_deal + get_overdue_jobs anon-revoked, quality_checked_at + reversed_at columns PRESENT.';
END $$;
