-- Wave XXX-U: get_overdue_jobs compares ET-day boundaries, not UTC-midnight.
--
-- Prior behavior: jobs.promised_date is timestamptz. Date-only entries store
-- as 2026-05-28T00:00:00Z. The WHERE clause compared this against
-- CURRENT_TIMESTAMP — which at 8:00 PM ET on May 27 is 00:00:00 UTC May 28.
-- Result: a job promised Wednesday May 28 appears "overdue" 8 hours EARLY,
-- starting at 8 PM Tuesday evening (when Rob actually USES the app).
--
-- Fix: cast both sides to ET-date (America/New_York), then compare dates not
-- timestamps. A job's ET calendar day vs today's ET calendar day —
-- apples-to-apples.
--
-- Calendar-flow-specialist NEW 1 from Wave XXX-Q audit.
--
-- Rule 15: idempotent.
-- DROP+CREATE-strips-grants lesson: explicit grants re-applied.

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
  ((NOW() AT TIME ZONE 'America/New_York')::date
    - (COALESCE(j.promised_date, j.due_date) AT TIME ZONE 'America/New_York')::date)::INTEGER AS days_overdue
FROM public.jobs j
LEFT JOIN public.vendors v ON j.vendor_id = v.id
LEFT JOIN public.vehicles vh ON j.vehicle_id = vh.id
WHERE (COALESCE(j.promised_date, j.due_date) AT TIME ZONE 'America/New_York')::date
       < (NOW() AT TIME ZONE 'America/New_York')::date
  AND j.job_status::TEXT NOT IN ('completed', 'cancelled', 'delivered', 'draft', 'no_show', 'quality_check')
ORDER BY COALESCE(j.promised_date, j.due_date) ASC;
$$;

COMMENT ON FUNCTION public.get_overdue_jobs() IS
'Returns jobs whose canonical commitment date is in the past (compared at ET-day boundaries to avoid the 8hr UTC-midnight false-positive in evenings) and which are still actionable by the coordinator. Excludes terminal + quality_check statuses.';

REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_overdue_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_overdue_jobs() TO service_role;
