-- Fix: allow org-scoped admin/manager delete of user_profiles
-- Context: Admin → People delete attempts were silently blocked by RLS

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND policyname = 'admin_manager_delete_user_profiles_in_org'
  ) THEN
    CREATE POLICY "admin_manager_delete_user_profiles_in_org"
    ON public.user_profiles
    AS PERMISSIVE
    FOR DELETE
    TO authenticated
    USING (
      EXISTS (
        SELECT 1
        FROM public.user_profiles me
        WHERE me.id = (SELECT auth.uid())
          AND me.org_id = user_profiles.org_id
          AND me.role IN ('admin', 'manager')
      )
      AND user_profiles.id <> (SELECT auth.uid())
    );
  END IF;
END
$$;
