-- Fix loaner_assignments RLS policies to eliminate auth.users references
-- Created: 2025-11-15
-- Issue: managers_manage_loaner_assignments policy references auth.users table directly,
--        causing "permission denied for table users" errors for authenticated users
-- Solution: Replace auth.users references with public.is_admin_or_manager() helper function
--
-- Related: RLS_AUTH_USERS_FIX.md, TASK_8_RLS_AUDIT_NO_AUTH_USERS.md

-- Drop the existing policy that references auth.users
DROP POLICY IF EXISTS "managers_manage_loaner_assignments" ON public.loaner_assignments;

-- Recreate the policy using the is_admin_or_manager() helper function
-- This function only uses public.user_profiles, avoiding auth schema permission issues
CREATE POLICY "managers_manage_loaner_assignments"
ON public.loaner_assignments
FOR ALL
TO authenticated
USING (
    public.is_admin_or_manager()
)
WITH CHECK (
    public.is_admin_or_manager()
);

-- Add comment explaining the fix
COMMENT ON POLICY "managers_manage_loaner_assignments" ON public.loaner_assignments IS 
'Allows admins and managers to manage loaner assignments. 
Uses public.is_admin_or_manager() helper to avoid auth.users permission errors.
Updated: 2025-11-15';

-- Verify the policy was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' 
    AND tablename = 'loaner_assignments'
    AND policyname = 'managers_manage_loaner_assignments'
  ) THEN
    RAISE EXCEPTION 'Failed to create managers_manage_loaner_assignments policy';
  END IF;
  
  RAISE NOTICE '✓ Successfully updated managers_manage_loaner_assignments policy to remove auth.users references';
END $$;

-- Rollback instructions (commented):
-- To revert this migration, drop and recreate with the old implementation:
-- DROP POLICY IF EXISTS "managers_manage_loaner_assignments" ON public.loaner_assignments;
-- CREATE POLICY "managers_manage_loaner_assignments" ON public.loaner_assignments
-- FOR ALL TO authenticated
-- USING (
--     EXISTS (
--         SELECT 1 FROM auth.users au
--         WHERE au.id = auth.uid() 
--         AND (au.raw_user_meta_data->>'role' IN ('admin', 'manager')
--              OR au.raw_app_meta_data->>'role' IN ('admin', 'manager'))
--     )
-- )
-- WITH CHECK (
--     EXISTS (
--         SELECT 1 FROM auth.users au
--         WHERE au.id = auth.uid() 
--         AND (au.raw_user_meta_data->>'role' IN ('admin', 'manager')
--              OR au.raw_app_meta_data->>'role' IN ('admin', 'manager'))
--     )
-- );
