-- Wave XXX-J: lock down get_overdue_jobs() execute grants.
--
-- Wave XXX-B used DROP FUNCTION + CREATE FUNCTION (necessary because the
-- return signature changed: due_date column renamed to promised_date). DROP
-- strips all grants. CREATE FUNCTION defaults to GRANT EXECUTE TO PUBLIC,
-- which inherits to anon. The function returns vendor names, vehicle year/
-- make/model, and days_overdue — operational data that should NOT be readable
-- by an unauthenticated session.
--
-- Caught by release-auditor on the Wave XXX final audit. Confirmed via
-- `SELECT has_function_privilege('anon', 'public.get_overdue_jobs()', 'EXECUTE')`
-- returning true after Wave XXX-B.
--
-- Rule 16 justification: this function is ONLY called by authenticated
-- coordinator/manager dashboards. There is no kiosk/TV/public surface that
-- needs the overdue list. Anon access is not required.
-- Data exposed: vendor relationships + customer vehicle inventory snapshot.
-- Not catastrophic if leaked, but no business reason to expose it.
--
-- Rule 15 replayability: idempotent (REVOKE + explicit GRANT).

REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_overdue_jobs() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_overdue_jobs() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_overdue_jobs() TO service_role;
