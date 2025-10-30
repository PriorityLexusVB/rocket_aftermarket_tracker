-- Fix RLS policies for dropdown functionality
-- This migration ensures dropdowns can load data properly

-- Drop existing restrictive policies on user_profiles
DROP POLICY IF EXISTS "authenticated_users_read_profiles" ON user_profiles;

-- Create a more permissive policy for dropdown access
CREATE POLICY "dropdown_access_user_profiles" ON user_profiles
  FOR SELECT
  USING (
    is_active = true
  );

-- Ensure products table has proper read access (using DROP/CREATE pattern)
DROP POLICY IF EXISTS "public_read_products" ON products;
CREATE POLICY "public_read_products" ON products
  FOR SELECT
  USING (is_active = true);

-- Ensure vendors table has proper read access (using DROP/CREATE pattern)
DROP POLICY IF EXISTS "public_read_vendors" ON vendors;
CREATE POLICY "public_read_vendors" ON vendors
  FOR SELECT
  USING (is_active = true);

-- Grant necessary permissions for dropdown functionality
GRANT SELECT ON user_profiles TO anon;
GRANT SELECT ON products TO anon;
GRANT SELECT ON vendors TO anon;

-- Add comments for clarity
COMMENT ON POLICY "dropdown_access_user_profiles" ON user_profiles IS 
'Allows reading active user profiles for dropdown functionality';

COMMENT ON POLICY "public_read_products" ON products IS 
'Allows reading active products for dropdown functionality';

COMMENT ON POLICY "public_read_vendors" ON vendors IS 
'Allows reading active vendors for dropdown functionality';