-- Wave XXX-B: 3 related state-machine + overdue fixes
--
-- (1) Add 'no_show' to job_status enum. JobDrawer.jsx:48 sends this value but
--     the enum doesn't contain it AND validate_status_progression has no rules
--     for it. Result: clicking No-Show fails for every job, every time.
--
-- (2) Add 'draft' transitions to validate_status_progression. Latent — 0 draft
--     jobs today, but the moment any code writes draft, that job is bricked.
--
-- (3) Fix get_overdue_jobs() to use COALESCE(promised_date, due_date). Currently
--     uses due_date alone, set on 0 of N jobs — RPC always returns empty.
--
-- Rule 15: idempotent. Rule 16: anon-grant N/A (existing grants preserved).

ALTER TYPE job_status ADD VALUE IF NOT EXISTS 'no_show';

CREATE OR REPLACE FUNCTION public.validate_status_progression(current_status text, new_status text)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
SELECT CASE
  WHEN new_status = 'cancelled' THEN true
  WHEN current_status = new_status THEN true
  WHEN current_status = 'draft'        AND new_status IN ('pending', 'scheduled') THEN true
  WHEN current_status = 'pending'      AND new_status IN ('scheduled', 'in_progress', 'no_show') THEN true
  WHEN current_status = 'scheduled'    AND new_status IN ('in_progress', 'completed', 'no_show') THEN true
  WHEN current_status = 'in_progress'  AND new_status IN ('quality_check', 'completed', 'no_show') THEN true
  WHEN current_status = 'quality_check' AND new_status IN ('delivered', 'in_progress') THEN true
  WHEN current_status = 'delivered'    AND new_status = 'completed' THEN true
  WHEN current_status = 'completed'    AND new_status IN ('delivered', 'quality_check') THEN true
  WHEN current_status = 'in_progress'  AND new_status = 'scheduled' THEN true
  WHEN current_status = 'no_show'      AND new_status IN ('scheduled', 'pending') THEN true
  ELSE false
END;
$$;

COMMENT ON FUNCTION public.validate_status_progression(text, text) IS
'Validates legal job_status transitions. Wave XXX-B added: draft->pending/scheduled, no_show targets from pending/scheduled/in_progress, no_show->scheduled/pending recovery.';

DROP FUNCTION IF EXISTS public.get_overdue_jobs();

CREATE FUNCTION public.get_overdue_jobs()
RETURNS TABLE(id uuid, title text, promised_date timestamptz, job_status text, vendor_name text, vehicle_info text, days_overdue integer)
LANGUAGE sql
STABLE
AS $$
SELECT
  j.id,
  j.title,
  COALESCE(j.promised_date, j.due_date) AS promised_date,
  j.job_status::TEXT,
  v.name AS vendor_name,
  CONCAT(vh.year::TEXT, ' ', vh.make, ' ', vh.model) AS vehicle_info,
  EXTRACT(DAY FROM (CURRENT_TIMESTAMP - COALESCE(j.promised_date, j.due_date)))::INTEGER AS days_overdue
FROM public.jobs j
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
WHERE COALESCE(j.promised_date, j.due_date) < CURRENT_TIMESTAMP
  AND j.job_status::TEXT NOT IN ('completed', 'cancelled', 'delivered', 'draft', 'no_show')
ORDER BY COALESCE(j.promised_date, j.due_date) ASC;
$$;

COMMENT ON FUNCTION public.get_overdue_jobs() IS
'Returns jobs whose canonical commitment date (COALESCE(promised_date, due_date)) is in the past and which are still open. Wave XXX-B replaced due_date-only logic.';
