-- Fix is_admin_or_manager() function to eliminate auth.users references
-- Created: 2025-11-04
-- Issue: RLS policies fail with "permission denied for table users" because 
--        authenticated users cannot query auth.users table
-- Solution: Use only public.user_profiles for role checking

-- 1. Drop and recreate is_admin_or_manager() without auth.users references
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Check user_profiles table only (no auth.users references)
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE (up.id = auth.uid() OR up.auth_user_id = auth.uid())
      AND up.role IN ('admin', 'manager')
      AND COALESCE(up.is_active, true) = true
  )
$$;

-- 2. Add comment explaining the fix
COMMENT ON FUNCTION public.is_admin_or_manager() IS 
'Checks if current user has admin or manager role using only public.user_profiles table. 
Does NOT reference auth.users to avoid RLS permission errors. 
Checks both id and auth_user_id columns to support both legacy and new user records.
Updated: 2025-11-04';

-- 3. Verify the function was created successfully
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'is_admin_or_manager'
  ) THEN
    RAISE EXCEPTION 'Failed to create is_admin_or_manager function';
  END IF;
  
  RAISE NOTICE 'Successfully updated is_admin_or_manager() function to remove auth.users references';
END $$;
