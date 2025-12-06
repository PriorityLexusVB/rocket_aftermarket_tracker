-- =============================================================================
-- RLS Smoke Test Script for rocket_aftermarket_tracker
-- =============================================================================
-- Purpose: Verify RLS policies are correctly configured for the four key tables:
--   1. user_profiles
--   2. products
--   3. vendors
--   4. loaner_assignments
--
-- Run this script in Supabase SQL Editor to verify your RLS configuration.
-- Each section includes expected results and troubleshooting notes.
--
-- Last updated: 2025-12-06
-- =============================================================================

-- =============================================================================
-- SECTION 1: Verify Helper Functions Exist
-- =============================================================================

SELECT '=== SECTION 1: Helper Functions ===' AS section;

-- Check auth_user_org() exists and has correct signature
SELECT 
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_function_result(p.oid) AS return_type,
  p.prosecdef AS is_security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
AND p.proname IN ('auth_user_org', 'app_current_org_id', 'is_admin_or_manager')
ORDER BY p.proname;

-- Expected: 3 rows with:
--   auth_user_org() -> uuid, SECURITY DEFINER
--   app_current_org_id() -> uuid, SECURITY DEFINER
--   is_admin_or_manager() -> boolean, SECURITY DEFINER

-- =============================================================================
-- SECTION 2: Verify RLS is Enabled on All Tables
-- =============================================================================

SELECT '=== SECTION 2: RLS Enabled Status ===' AS section;

SELECT 
  n.nspname AS schema,
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
AND c.relkind = 'r'
AND c.relname IN ('user_profiles', 'products', 'vendors', 'loaner_assignments', 'jobs')
ORDER BY c.relname;

-- Expected: All tables should have rls_enabled = true

-- =============================================================================
-- SECTION 3: List All Policies on Key Tables
-- =============================================================================

SELECT '=== SECTION 3: RLS Policies ===' AS section;

SELECT 
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  -- Truncate long expressions for readability
  CASE WHEN length(qual) > 100 THEN substring(qual, 1, 100) || '...' ELSE qual END AS using_expr,
  CASE WHEN length(with_check) > 100 THEN substring(with_check, 1, 100) || '...' ELSE with_check END AS with_check_expr
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'products', 'vendors', 'loaner_assignments')
ORDER BY tablename, policyname;

-- Expected policies:
-- user_profiles:
--   - user_profiles_select_active (SELECT, is_active = true)
--   - user_profiles_self_read (SELECT, id = auth.uid())
--   - user_profiles_self_update (UPDATE, id = auth.uid())
--   - user_profiles_self_insert (INSERT, id = auth.uid())
--   - [possibly other legacy policies - verify no recursion]
--
-- products:
--   - app_org_staff_can_read_products (SELECT, org-scoped with fallback)
--   - org can insert products (INSERT)
--   - org can update products (UPDATE)
--   - admin_manager_manage_products (ALL for admins)
--
-- vendors:
--   - app_org_staff_can_read_vendors (SELECT, org-scoped with fallback)
--   - org can insert vendors (INSERT)
--   - org can update vendors (UPDATE)
--   - admin_manager_full_vendor_access (ALL for admins)
--
-- loaner_assignments:
--   - org can select loaner_assignments via jobs (SELECT)
--   - org can insert loaner_assignments via jobs (INSERT)
--   - org can update loaner_assignments via jobs (UPDATE)
--   - managers_manage_loaner_assignments (ALL for managers)

-- =============================================================================
-- SECTION 4: Test Basic Access (Run as authenticated user)
-- =============================================================================

SELECT '=== SECTION 4: Basic Access Tests ===' AS section;

-- Note: These queries will work when run as an authenticated user
-- You can test in Supabase Dashboard > SQL Editor with a logged-in session

-- Test 4.1: Can we read active user profiles?
SELECT 
  'user_profiles' AS table_name,
  count(*) AS row_count,
  CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'WARN: No rows visible' END AS status
FROM public.user_profiles
WHERE is_active = true;

-- Test 4.2: Can we read active products?
SELECT 
  'products' AS table_name,
  count(*) AS row_count,
  CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'WARN: No rows visible' END AS status
FROM public.products
WHERE is_active = true;

-- Test 4.3: Can we read active vendors?
SELECT 
  'vendors' AS table_name,
  count(*) AS row_count,
  CASE WHEN count(*) > 0 THEN 'PASS' ELSE 'WARN: No rows visible' END AS status
FROM public.vendors
WHERE is_active = true;

-- Test 4.4: Can we read loaner assignments (via jobs)?
SELECT 
  'loaner_assignments' AS table_name,
  count(*) AS row_count,
  CASE WHEN count(*) >= 0 THEN 'PASS (may be 0 if no assignments)' ELSE 'ERROR' END AS status
FROM public.loaner_assignments;

-- =============================================================================
-- SECTION 5: Test auth_user_org() Function
-- =============================================================================

SELECT '=== SECTION 5: auth_user_org() Test ===' AS section;

-- This should return your org_id or NULL if not aligned
SELECT 
  public.auth_user_org() AS my_org_id,
  CASE 
    WHEN public.auth_user_org() IS NOT NULL THEN 'PASS: Org aligned'
    ELSE 'WARN: No org alignment - fallback policies should still work'
  END AS status;

-- Also test the alias
SELECT 
  public.app_current_org_id() AS my_org_id_via_alias,
  (public.auth_user_org() = public.app_current_org_id() OR 
   (public.auth_user_org() IS NULL AND public.app_current_org_id() IS NULL)) AS functions_match;

-- =============================================================================
-- SECTION 6: Check for Recursion-Causing Policies
-- =============================================================================

SELECT '=== SECTION 6: Recursion Check ===' AS section;

-- CRITICAL: Policies on user_profiles should NOT reference auth_user_org()
-- because auth_user_org() queries user_profiles, causing 42P17 infinite recursion

SELECT 
  policyname,
  qual AS using_expression,
  CASE 
    WHEN qual ILIKE '%auth_user_org%' OR qual ILIKE '%app_current_org_id%'
    THEN 'DANGER: May cause infinite recursion!'
    ELSE 'OK: No auth_user_org reference'
  END AS recursion_risk
FROM pg_policies
WHERE schemaname = 'public'
AND tablename = 'user_profiles'
AND qual IS NOT NULL;

-- Expected: All user_profiles policies should show "OK: No auth_user_org reference"
-- If any show DANGER, you need to fix that policy

-- =============================================================================
-- SECTION 7: Check for auth.users References
-- =============================================================================

SELECT '=== SECTION 7: auth.users Reference Check ===' AS section;

-- Policies should NOT directly query auth.users (causes permission errors)
-- They should use auth.uid(), auth.jwt(), or helper functions instead

SELECT 
  tablename,
  policyname,
  CASE 
    WHEN qual ILIKE '%auth.users%' OR with_check ILIKE '%auth.users%'
    THEN 'WARNING: References auth.users - may cause permission errors'
    ELSE 'OK'
  END AS auth_users_check
FROM pg_policies
WHERE schemaname = 'public'
AND tablename IN ('user_profiles', 'products', 'vendors', 'loaner_assignments')
ORDER BY tablename, policyname;

-- Expected: All should show "OK"

-- =============================================================================
-- SECTION 8: Summary
-- =============================================================================

SELECT '=== SECTION 8: RLS Summary ===' AS section;

WITH policy_counts AS (
  SELECT 
    tablename,
    count(*) AS policy_count,
    count(*) FILTER (WHERE cmd = 'SELECT') AS select_policies,
    count(*) FILTER (WHERE cmd IN ('INSERT', 'UPDATE', 'DELETE', 'ALL')) AS write_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('user_profiles', 'products', 'vendors', 'loaner_assignments')
  GROUP BY tablename
)
SELECT 
  tablename,
  policy_count,
  select_policies,
  write_policies,
  CASE 
    WHEN select_policies > 0 AND write_policies > 0 THEN 'COMPLETE'
    WHEN select_policies > 0 THEN 'READ ONLY'
    ELSE 'NEEDS ATTENTION'
  END AS coverage
FROM policy_counts
ORDER BY tablename;

-- =============================================================================
-- TROUBLESHOOTING GUIDE
-- =============================================================================

/*
COMMON ISSUES AND FIXES:

1. ERROR 42P17: Infinite recursion detected in policy for relation "user_profiles"
   CAUSE: A policy on user_profiles references auth_user_org() which queries user_profiles
   FIX: Replace auth_user_org() with auth.uid() in user_profiles policies
   
2. ERROR 401: Unauthorized when fetching /products or /vendors
   CAUSE: auth_user_org() returns NULL for users without org alignment
   FIX: Add fallback condition: OR public.auth_user_org() IS NULL

3. ERROR: permission denied for table users
   CAUSE: Policy directly queries auth.users table
   FIX: Use auth.uid(), auth.jwt(), or helper functions instead

4. Dropdowns show no data
   CAUSE: RLS policies too restrictive
   FIX: Ensure SELECT policies exist and allow active records

5. Users can't save deals/transactions
   CAUSE: Missing INSERT/UPDATE policies
   FIX: Add write policies with proper org scoping

RUN THIS TO RELOAD POSTGREST SCHEMA CACHE:
  NOTIFY pgrst, 'reload schema';

*/

SELECT '=== End of RLS Smoke Test ===' AS section;
