-- Wave XXX-S: close the atomic-PATCH bypass on validate_vendor_job_scheduling.
--
-- Prior trigger condition: NEW.vendor_id IS NOT NULL AND NEW.scheduled_start_time IS NULL.
-- A client can bypass by sending PATCH { vendor_id: null, job_status: 'scheduled' }
-- in a single statement — NEW.vendor_id IS NULL, so the check is skipped.
-- Result: job ends up status=scheduled with vendor_id=null AND no scheduled time
-- (semantically broken).
--
-- Fix: ALSO check OLD.vendor_id via COALESCE. If the row had a vendor and is
-- being moved to a committed status without a scheduled time, reject —
-- regardless of whether the same statement is clearing vendor_id.
--
-- Hostile-break-tester finding from Wave XXX-Q. Verified live before fix:
-- PATCH {vendor_id:null, job_status:'scheduled'} against job 43800533 succeeded.
--
-- Rule 15 replayability: CREATE OR REPLACE is idempotent.

CREATE OR REPLACE FUNCTION public.validate_vendor_job_scheduling()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.vendor_id, OLD.vendor_id) IS NOT NULL
     AND NEW.scheduled_start_time IS NULL
     AND NEW.job_status IN ('scheduled','in_progress','quality_check','completed','delivered') THEN
    RAISE EXCEPTION
      'Cannot move a vendor job to status "%" without a scheduled start time (job_id: %, vendor_id: %). Set a scheduled date — or finish clearing the vendor BEFORE the status transition.',
      NEW.job_status, NEW.id, COALESCE(NEW.vendor_id, OLD.vendor_id);
  END IF;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_vendor_job_scheduling() IS
'Enforces: vendor jobs must have a scheduled_start_time before transitioning to any committed status (scheduled/in_progress/quality_check/completed/delivered). Wave XXX-S hardened against the atomic vendor_id=NULL+status=scheduled bypass by checking COALESCE(NEW.vendor_id, OLD.vendor_id).';
