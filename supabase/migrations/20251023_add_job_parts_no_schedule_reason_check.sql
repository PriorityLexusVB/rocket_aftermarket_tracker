-- Enforce business rule at DB layer:
-- If requires_scheduling is false, no_schedule_reason must be non-empty
-- Use NOT VALID initially to avoid failing on existing bad rows; validate later after cleanup.

ALTER TABLE public.job_parts
ADD CONSTRAINT job_parts_no_schedule_reason_chk
CHECK (
  requires_scheduling
  OR (
    NOT requires_scheduling
    AND COALESCE(NULLIF(trim(no_schedule_reason), ''), NULL) IS NOT NULL
  )
) NOT VALID;

-- To validate later (optional, may fail if existing rows violate):
-- ALTER TABLE public.job_parts VALIDATE CONSTRAINT job_parts_no_schedule_reason_chk;
