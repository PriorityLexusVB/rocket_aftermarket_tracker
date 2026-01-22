-- Fix infinite recursion in user_profiles DELETE policy
--
-- Symptom:
--   "infinite recursion detected in policy for relation \"user_profiles\""
--   when attempting to delete a user profile from Admin.
--
-- Root cause:
--   Policy "admin_manager_delete_user_profiles_in_org" referenced public.user_profiles
--   inside its own USING clause, which can trigger recursive policy evaluation.
--
-- Fix:
--   Recreate the policy using existing SECURITY DEFINER helper functions
--   (public.is_admin_or_manager(), public.auth_user_org()) which bypass RLS
--   for their internal lookups (RLS is enabled but not forced on user_profiles).

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_or_manager'
  ) THEN
    RAISE EXCEPTION 'Missing required helper function: public.is_admin_or_manager()';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'auth_user_org'
  ) THEN
    RAISE EXCEPTION 'Missing required helper function: public.auth_user_org()';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'admin_manager_delete_user_profiles_in_org'
  ) THEN
    EXECUTE 'DROP POLICY "admin_manager_delete_user_profiles_in_org" ON public.user_profiles;';
  END IF;

  EXECUTE $policy$
    CREATE POLICY "admin_manager_delete_user_profiles_in_org"
    ON public.user_profiles
    AS PERMISSIVE
    FOR DELETE
    TO authenticated
    USING (
      public.is_admin_or_manager()
      AND user_profiles.org_id = public.auth_user_org()
      AND NOT (
        user_profiles.id = (SELECT auth.uid())
        OR COALESCE(user_profiles.auth_user_id = (SELECT auth.uid()), false)
        OR COALESCE(user_profiles.email = ((SELECT auth.jwt()) ->> 'email'), false)
      )
    );
  $policy$;
END
$$;
