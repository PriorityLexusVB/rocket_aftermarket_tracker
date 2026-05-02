-- Fix user_profiles SELECT policy: add org_id tenant scope to close cross-org staff enumeration.
-- Created: 2026-05-02
--
-- Threat closed:
--   The prior policy `user_profiles_read_active` (last defined in
--   20251212194500_fix_user_profiles_policy_and_grants.sql) used:
--
--       USING (coalesce(is_active, true))
--
--   This allowed ANY authenticated user — regardless of their org — to issue a
--   SELECT on public.user_profiles and receive every active staff record across
--   ALL tenants. An attacker with credentials from Org A could enumerate names,
--   emails, roles, and auth_user_id values for every staff member in Org B, C, ...,
--   by calling the PostgREST /user_profiles endpoint or any Supabase client query.
--   With auth_user_id exposed, a follow-on attack could probe per-user RPC endpoints
--   to escalate access.
--
--   The fix adds `org_id = public.auth_user_org()` to the USING clause, scoping
--   each caller's view to only the rows that belong to their own organization.
--   `public.auth_user_org()` is SECURITY DEFINER and resolves the calling user's
--   org_id from user_profiles — the same pattern used in 20260430000001 and
--   20260430000002 for vehicles and loaner_assignments.
--
-- Rule 15 (replayability): DROP POLICY IF EXISTS + CREATE POLICY. No data-state
--   dependencies. Safe to replay against a fresh DB.
-- Rule 16 (anon-grant): No anon grants in this migration.

-- -----------------------------------------------------------------------
-- Drop the policy that has no org_id scope.
-- -----------------------------------------------------------------------
DROP POLICY IF EXISTS "user_profiles_read_active" ON public.user_profiles;

-- -----------------------------------------------------------------------
-- Recreate with org_id tenant scope.
-- Both conditions must hold:
--   1. The row belongs to the caller's org.
--   2. The staff record is active (or the is_active column is NULL, treated as active).
-- -----------------------------------------------------------------------
CREATE POLICY "user_profiles_read_active"
  ON public.user_profiles
  FOR SELECT
  TO authenticated
  USING (
    org_id = public.auth_user_org()
    AND coalesce(is_active, true)
  );

-- Ensure RLS remains enabled (idempotent).
ALTER TABLE IF EXISTS public.user_profiles ENABLE ROW LEVEL SECURITY;

-- -----------------------------------------------------------------------
-- Verification: confirm the policy exists with the expected definition.
-- We check pg_policies for both the policy name and the presence of
-- auth_user_org in the qual text.
-- -----------------------------------------------------------------------
DO $$
DECLARE
  pol_qual text;
BEGIN
  SELECT qual
    INTO pol_qual
    FROM pg_policies
   WHERE schemaname = 'public'
     AND tablename   = 'user_profiles'
     AND policyname  = 'user_profiles_read_active';

  IF pol_qual IS NULL THEN
    RAISE EXCEPTION
      'Policy "user_profiles_read_active" on user_profiles not found — migration may have failed.';
  END IF;

  IF pol_qual NOT ILIKE '%auth_user_org%' THEN
    RAISE EXCEPTION
      'Policy "user_profiles_read_active" exists but does not reference auth_user_org(). '
      'Actual qual: %', pol_qual;
  END IF;

  RAISE NOTICE
    'VERIFIED: user_profiles_read_active policy has org_id = auth_user_org() scope. qual=%',
    pol_qual;
END $$;
