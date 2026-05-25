-- Wave XXX-Y: managers can add/remove ANY reference-only user in their org.
-- (sales, finance, OR additional managers/coordinators — all dropdown-only)
--
-- The policy checks `auth_user_id IS NULL` so it doesn't care about role or
-- department. A manager-added person never gets a login from this code path;
-- promoting to login requires a separate Supabase admin action.
--
-- Hard delete intentionally NOT enabled — soft-delete via is_active=false
-- preserves any FK references from past deals. The
-- user_profiles_read_active policy filters is_active=true so removed users
-- disappear from dropdowns.

DROP POLICY IF EXISTS user_profiles_insert_reference_by_manager ON public.user_profiles;
CREATE POLICY user_profiles_insert_reference_by_manager
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_admin_or_manager()
    AND auth_user_id IS NULL
    AND org_id = auth_user_org()
    AND id <> (SELECT auth.uid())
  );

DROP POLICY IF EXISTS user_profiles_update_reference_by_manager ON public.user_profiles;
CREATE POLICY user_profiles_update_reference_by_manager
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (
    is_admin_or_manager()
    AND auth_user_id IS NULL
    AND org_id = auth_user_org()
    AND id <> (SELECT auth.uid())
  )
  WITH CHECK (
    is_admin_or_manager()
    AND auth_user_id IS NULL
    AND org_id = auth_user_org()
    AND id <> (SELECT auth.uid())
  );

COMMENT ON POLICY user_profiles_insert_reference_by_manager ON public.user_profiles IS
'Wave XXX-Y: managers can add reference users in their org. auth_user_id must be NULL — managers cannot create LOGIN users via this policy.';

COMMENT ON POLICY user_profiles_update_reference_by_manager ON public.user_profiles IS
'Wave XXX-Y: managers can edit OR soft-delete (is_active=false) reference users. auth_user_id must remain NULL on both sides — prevents accidental promotion to login.';
