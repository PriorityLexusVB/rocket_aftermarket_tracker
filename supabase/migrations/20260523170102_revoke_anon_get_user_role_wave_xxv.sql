-- Wave XXV-B security fix: hostile-break-tester found public.get_user_role()
-- callable by anon, returning "staff" (the COALESCE fallback fires when
-- auth.uid() is null). The function was created before the anon-revoke
-- sweep migrations (20260502041504, 20260502130000, 20260503030405) and
-- was never included in any of them.
--
-- Justification for the REVOKE (NOT a Rule 16 anon-grant):
-- Sentence 1: No anon client path needs this function — every consumer
-- reads role from useAuth() / Supabase session profile, not from this RPC.
-- Sentence 2: Returning the role-name string "staff" to an unauthenticated
-- caller is low-sensitivity by itself but reveals internal role vocabulary
-- and confirms the RPC exists, both of which are leverage for further
-- enumeration attempts. The function should only be callable by an
-- authenticated session.

REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.get_user_role() FROM anon;
GRANT  EXECUTE ON FUNCTION public.get_user_role() TO authenticated;

NOTIFY pgrst, 'reload schema';
