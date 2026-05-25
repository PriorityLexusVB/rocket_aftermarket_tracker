-- Wave XXX-R: exclude 'quality_check' from get_overdue_jobs.
--
-- A quality_check job has its work done and is sitting in QC. The customer is
-- still waiting (so technically past their promise date) but there's nothing
-- the COORDINATOR needs to do — QC handles its own workflow. Showing QC jobs
-- in the dashboard Overdue tile inflates the actionable count.
--
-- Mirrors the client-side TERMINAL_STATUSES set in scheduleItemsService.js
-- which also got 'quality_check' added in this wave.
--
-- Rule 15: idempotent (DROP + CREATE pattern for return-signature stability).
-- Rule 16 + drop+create-strips-grants lesson: explicit REVOKE FROM PUBLIC/anon
-- + GRANT TO authenticated/service_role applied right after the CREATE.

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
  AND j.job_status::TEXT NOT IN ('completed', 'cancelled', 'delivered', 'draft', 'no_show', 'quality_check')
ORDER BY COALESCE(j.promised_date, j.due_date) ASC;
$$;

COMMENT ON FUNCTION public.get_overdue_jobs() IS
'Returns jobs whose canonical commitment date (COALESCE(promised_date, due_date)) is in the past and which are still open AND actionable by the coordinator. quality_check is excluded — work is done, in QC review.';

REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_overdue_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_overdue_jobs() TO service_role;
