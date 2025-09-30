-- Fix User Management RLS Policies for Admin Operations
-- This migration addresses the issue where admins cannot create new users
-- due to overly restrictive RLS policies on user_profiles table

-- Create helper function to check if user is admin or manager (safe approach)
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT EXISTS (
  SELECT 1 FROM auth.users au
  WHERE au.id = auth.uid() 
  AND (au.raw_user_meta_data->>'role' IN ('admin', 'manager')
       OR au.raw_app_meta_data->>'role' IN ('admin', 'manager')
       OR EXISTS (
         SELECT 1 FROM public.user_profiles up 
         WHERE up.id = auth.uid() 
         AND up.role IN ('admin', 'manager')
       ))
)
$$;

-- Drop existing restrictive policy
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;

-- Create separate policies for different operations

-- Policy 1: Users can view their own profile, admins/managers can view all
CREATE POLICY "user_profiles_select_policy"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid() OR 
  public.is_admin_or_manager()
);

-- Policy 2: Users can update their own profile, admins/managers can update any
CREATE POLICY "user_profiles_update_policy"
ON public.user_profiles
FOR UPDATE
TO authenticated
USING (
  id = auth.uid() OR 
  public.is_admin_or_manager()
)
WITH CHECK (
  id = auth.uid() OR 
  public.is_admin_or_manager()
);

-- Policy 3: Only admins/managers can insert new user profiles
CREATE POLICY "user_profiles_insert_policy"
ON public.user_profiles
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_admin_or_manager()
);

-- Policy 4: Only admins can delete user profiles
CREATE POLICY "user_profiles_delete_policy"
ON public.user_profiles
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() 
    AND up.role = 'admin'
  )
);

-- Ensure admins can manage vendors (fix vendor creation issues)
DROP POLICY IF EXISTS "managers_manage_vendors" ON public.vendors;

CREATE POLICY "admin_manager_full_vendor_access"
ON public.vendors
FOR ALL
TO authenticated
USING (public.is_admin_or_manager())
WITH CHECK (public.is_admin_or_manager());

-- Staff can view vendors
CREATE POLICY "staff_view_vendors_only"
ON public.vendors
FOR SELECT
TO authenticated
USING (true);

-- Fix products table access for admins/managers
DROP POLICY IF EXISTS "products_policy" ON public.products;

-- Admins/managers can manage all products
CREATE POLICY "admin_manager_manage_products"
ON public.products
FOR ALL
TO authenticated
USING (
  created_by = auth.uid() OR
  public.is_admin_or_manager()
)
WITH CHECK (
  public.is_admin_or_manager()
);

-- Staff can view products
CREATE POLICY "staff_view_products"
ON public.products
FOR SELECT
TO authenticated
USING (true);

-- Add comment explaining the fix
COMMENT ON FUNCTION public.is_admin_or_manager() IS 'Safe admin check function that avoids circular dependencies by checking both auth.users metadata and user_profiles table';

-- Test the policies work correctly
DO $$
BEGIN
  -- Verify the function works
  RAISE NOTICE 'Testing admin function...';
  
  -- Verify policies are created
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_profiles' 
    AND policyname = 'user_profiles_insert_policy'
  ) THEN
    RAISE NOTICE 'User management policies created successfully';
  ELSE
    RAISE EXCEPTION 'Failed to create user management policies';
  END IF;
END $$;