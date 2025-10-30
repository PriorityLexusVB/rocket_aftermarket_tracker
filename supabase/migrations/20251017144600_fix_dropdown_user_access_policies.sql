-- Schema Analysis: Existing user_profiles table with restrictive RLS policies
-- Integration Type: Modification - Fix RLS policies for dropdown data access
-- Dependencies: user_profiles table (existing)

-- Fix RLS policies on user_profiles to allow authenticated users to read dropdown data
-- The issue is that the current policies are too restrictive for dropdown access

-- Drop the existing restrictive policies that prevent dropdown data access
DROP POLICY IF EXISTS "user_profiles_select_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_update_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_insert_policy" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_delete_policy" ON public.user_profiles;

-- Create improved RLS policies using Pattern 1 (Core User Tables)
-- Allow authenticated users to read basic profile data for dropdowns
CREATE POLICY "authenticated_users_read_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- Users can only manage their own profile data
CREATE POLICY "users_manage_own_profile"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- Create a helper function for better dropdown data access
CREATE OR REPLACE FUNCTION public.get_dropdown_users(
    department_filter TEXT DEFAULT NULL,
    role_filter TEXT DEFAULT NULL
)
RETURNS TABLE(
    id UUID,
    full_name TEXT,
    email TEXT,
    department TEXT,
    role TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
SELECT 
    up.id,
    up.full_name,
    up.email,
    up.department,
    up.role::TEXT
FROM public.user_profiles up
WHERE up.is_active = true
  AND (department_filter IS NULL OR up.department = department_filter)
  AND (role_filter IS NULL OR up.role::TEXT = role_filter)
ORDER BY up.full_name;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_dropdown_users(TEXT, TEXT) TO authenticated;

-- Add some sample dealer representatives if they don't exist
-- This ensures the dropdowns have data to display
DO $$
DECLARE
    sales_consultant_uuid UUID := gen_random_uuid();
    delivery_coordinator_uuid UUID := gen_random_uuid();
    finance_manager_uuid UUID := gen_random_uuid();
BEGIN
    -- Check if we have any Sales Consultants
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE department = 'Sales Consultants' AND is_active = true) THEN
        -- Insert a sample Sales Consultant
        INSERT INTO public.user_profiles (id, email, full_name, department, role, is_active)
        VALUES (
            sales_consultant_uuid,
            'sales.consultant@priorityautomotive.com',
            'SAMPLE SALES CONSULTANT',
            'Sales Consultants',
            'staff',
            true
        );
    END IF;

    -- Check if we have any Delivery Coordinators
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE department = 'Delivery Coordinator' AND is_active = true) THEN
        -- Insert a sample Delivery Coordinator
        INSERT INTO public.user_profiles (id, email, full_name, department, role, is_active)
        VALUES (
            delivery_coordinator_uuid,
            'delivery.coordinator@priorityautomotive.com',
            'SAMPLE DELIVERY COORDINATOR',
            'Delivery Coordinator',
            'staff',
            true
        );
    END IF;

    -- Check if we have any Finance Managers
    IF NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE department = 'Finance Manager' AND is_active = true) THEN
        -- Insert a sample Finance Manager
        INSERT INTO public.user_profiles (id, email, full_name, department, role, is_active)
        VALUES (
            finance_manager_uuid,
            'finance.manager@priorityautomotive.com',
            'SAMPLE FINANCE MANAGER',
            'Finance Manager',
            'staff',
            true
        );
    END IF;

EXCEPTION
    WHEN unique_violation THEN
        RAISE NOTICE 'Some sample users already exist, skipping duplicates';
    WHEN OTHERS THEN
        RAISE NOTICE 'Error creating sample users: %', SQLERRM;
END $$;

-- Create an index to improve dropdown query performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_department_active 
ON public.user_profiles(department, is_active) 
WHERE is_active = true;

-- Create an index for role-based queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_role_active 
ON public.user_profiles(role, is_active) 
WHERE is_active = true;