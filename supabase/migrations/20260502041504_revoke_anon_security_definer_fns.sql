-- Revoke anon execute on SECURITY DEFINER fns with no anon caller path.
-- Confirmed via grep: all 6 fns appear ONLY in test files (step17-regression-guards.test.js).
-- No client or edge-function path invokes these with an anon JWT.
-- Per Rule 16: anon GRANT requires a documented caller path + data-exposure justification.
-- Neither exists for any of these 6 functions. Revoking.

REVOKE EXECUTE ON FUNCTION public.check_vehicle_overlap(uuid, timestamptz, timestamptz, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_sms_notification(text, text, jsonb, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_dropdown_users(text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vendor_availability(uuid, date, time, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.is_legitimate_employee(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.mark_loaner_returned(uuid) FROM anon;
