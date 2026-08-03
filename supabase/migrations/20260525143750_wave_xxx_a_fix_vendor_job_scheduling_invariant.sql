-- Wave XXX-A: Move vendor-scheduling invariant from job_parts to jobs
--
-- Problem: validate_deal_line_items_trigger fired BEFORE INSERT OR UPDATE on
-- job_parts and raised 'Vendor jobs must have scheduled dates' whenever the
-- parent job had vendor_id but no scheduled_start_time. That blocked the
-- happy path: create deal -> add line items -> assign vendor -> schedule.
-- Line items MUST be editable before scheduling.
--
-- Fix: drop the job_parts trigger + function entirely. The service_type
-- auto-correct it did is already handled by set_deal_dates_and_calendar on
-- jobs UPDATE. The "job exists" / "product exists" checks are covered by FK
-- constraints. Add a new trigger on jobs that enforces the real invariant:
-- a vendor job cannot enter a committed status (scheduled/in_progress/
-- quality_check/completed/delivered) without scheduled_start_time.
--
-- Rule 16 anon-grant: N/A. Function invoked only via trigger (caller's
-- session role). No GRANT to anon.
-- Rule 15 replayability: idempotent via IF EXISTS + CREATE OR REPLACE.

DROP TRIGGER IF EXISTS validate_deal_line_items_trigger ON public.job_parts;
DROP FUNCTION IF EXISTS public.validate_deal_line_items();

CREATE OR REPLACE FUNCTION public.validate_vendor_job_scheduling()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.vendor_id IS NOT NULL
     AND NEW.scheduled_start_time IS NULL
     AND NEW.job_status IN ('scheduled','in_progress','quality_check','completed','delivered') THEN
    RAISE EXCEPTION
      'Cannot move vendor job to status "%" without a scheduled start time (job_id: %, vendor_id: %). Set a scheduled date before promoting the job.',
      NEW.job_status, NEW.id, NEW.vendor_id;
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_vendor_job_scheduling() IS
'Enforces: vendor jobs must have a scheduled_start_time before transitioning to any committed status (scheduled/in_progress/quality_check/completed/delivered). Replaces the over-aggressive job_parts trigger that blocked line item edits on un-scheduled vendor jobs.';

DROP TRIGGER IF EXISTS validate_vendor_job_scheduling_trigger ON public.jobs;
CREATE TRIGGER validate_vendor_job_scheduling_trigger
  BEFORE INSERT OR UPDATE OF vendor_id, scheduled_start_time, job_status
  ON public.jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_vendor_job_scheduling();
