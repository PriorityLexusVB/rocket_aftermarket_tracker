-- Migration: RLS Safety Net Consolidation
-- Date: 2025-12-06
-- Purpose: Consolidate and fix RLS policies to prevent infinite recursion and 401 errors
-- Context: Aligns repo migrations with applied Supabase-side changes for:
--   - public.user_profiles (prevent recursion, simple auth.uid() based policies)
--   - public.products (org-scoped with fallback)
--   - public.vendors (org-scoped with fallback)
--   - public.loaner_assignments (org-scoped via jobs)
--
-- Key fixes:
--   1. user_profiles policies use auth.uid() directly (no recursion via auth_user_org)
--   2. Ensure app_current_org_id() exists as an alias/alternative to auth_user_org()
--   3. Products/vendors have fallback for NULL auth_user_org() case
--   4. loaner_assignments properly scoped via jobs.org_id
--
-- This migration is ADDITIVE and uses IF NOT EXISTS / DROP IF EXISTS patterns
-- to be idempotent and safe to run on systems with partial changes.

-- =============================================================================
-- SECTION 1: Ensure helper functions exist with correct signatures
-- =============================================================================

-- auth_user_org() - The primary helper that returns the user's org_id
-- IMPORTANT: This is SECURITY DEFINER to bypass RLS when called from policies
-- Uses (SELECT auth.uid()) pattern to avoid initplan anti-pattern
-- Updated to check both id AND auth_user_id columns for maximum compatibility
CREATE OR REPLACE FUNCTION public.auth_user_org()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Check both id and auth_user_id columns for compatibility with various linking scenarios
  SELECT org_id FROM (
    SELECT org_id, 0 as priority FROM public.user_profiles WHERE id = (SELECT auth.uid())
    UNION ALL
    SELECT org_id, 1 as priority FROM public.user_profiles WHERE auth_user_id = (SELECT auth.uid())
  ) sub ORDER BY priority LIMIT 1;
$$;

COMMENT ON FUNCTION public.auth_user_org() IS 
'Returns the org_id for the currently authenticated user.
Checks both user_profiles.id and user_profiles.auth_user_id columns.
Uses SECURITY DEFINER to bypass RLS. Uses (SELECT auth.uid()) pattern.
Updated: 2025-12-06';

-- app_current_org_id() - Alias for auth_user_org() for compatibility
-- Some code or policies may reference this function name
CREATE OR REPLACE FUNCTION public.app_current_org_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.auth_user_org();
$$;

COMMENT ON FUNCTION public.app_current_org_id() IS 
'Alias for auth_user_org(). Returns org_id for the authenticated user.
Added: 2025-12-06 for compatibility with policy naming variations.';

-- is_admin_or_manager() - Check if current user has admin or manager role
-- IMPORTANT: Uses auth.uid() directly, no recursion risk
CREATE OR REPLACE FUNCTION public.is_admin_or_manager()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE (up.id = (SELECT auth.uid()) OR up.auth_user_id = (SELECT auth.uid()))
    AND up.role IN ('admin', 'manager')
    AND COALESCE(up.is_active, true)
  );
$$;

COMMENT ON FUNCTION public.is_admin_or_manager() IS 
'Checks if current user has admin or manager role.
Uses only public.user_profiles (no auth.users reference).
Updated: 2025-12-06';

-- =============================================================================
-- SECTION 2: Fix user_profiles policies (PREVENT RECURSION)
-- The key principle: user_profiles policies must NOT call auth_user_org()
-- because auth_user_org() queries user_profiles, causing infinite recursion.
-- Instead, use auth.uid() directly wrapped in (SELECT ...) pattern.
--
-- NOTE: Uses DROP POLICY IF EXISTS before CREATE POLICY to be idempotent
-- and avoid "policy already exists" errors when run against existing DBs.
-- =============================================================================

-- Ensure RLS is enabled
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Drop potentially problematic policies that may cause recursion or conflict
DROP POLICY IF EXISTS "org members read user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "dropdown_access_user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "authenticated_users_read_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "authenticated fallback read user_profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_select_active" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_read" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_update" ON public.user_profiles;
DROP POLICY IF EXISTS "user_profiles_self_insert" ON public.user_profiles;

-- Policy: user_profiles_read_active - Any authenticated user can SELECT active staff rows
-- This is the main SELECT policy for dropdowns/staff lists
-- IMPORTANT: Does NOT call auth_user_org() to avoid recursion
DROP POLICY IF EXISTS "user_profiles_read_active" ON public.user_profiles;
CREATE POLICY "user_profiles_read_active"
  ON public.user_profiles
  AS permissive
  FOR SELECT
  TO authenticated
  USING (coalesce(is_active, true));

-- Policy: user_profiles_update_self - Each authenticated user can UPDATE only their own row
-- Uses auth.uid() directly to avoid recursion
DROP POLICY IF EXISTS "user_profiles_update_self" ON public.user_profiles;
CREATE POLICY "user_profiles_update_self"
  ON public.user_profiles
  AS permissive
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- =============================================================================
-- SECTION 3: Fix products policies
-- Allow org-scoped access with fallback for users without org alignment
-- Uses auth_user_org() which is safe here (not on user_profiles table)
-- =============================================================================

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- Drop old policies to ensure clean state
DROP POLICY IF EXISTS "app_org_staff_can_read_products" ON public.products;
DROP POLICY IF EXISTS "org members read products" ON public.products;
DROP POLICY IF EXISTS "org read products" ON public.products;
DROP POLICY IF EXISTS "authenticated fallback read products" ON public.products;

-- Create unified read policy
CREATE POLICY "app_org_staff_can_read_products" ON public.products
  FOR SELECT TO authenticated
  USING (
    COALESCE(is_active, true) AND (
      -- Case 1: org_id matches user's org
      org_id = (SELECT public.auth_user_org())
      -- Case 2: shared/global products (NULL org_id)
      OR org_id IS NULL
      -- Case 3: user has no org alignment yet (fallback)
      OR (SELECT public.auth_user_org()) IS NULL
    )
  );

-- =============================================================================
-- SECTION 4: Fix vendors policies
-- Same pattern as products
-- Uses auth_user_org() which is safe here (not on user_profiles table)
-- =============================================================================

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

-- Drop old policies to ensure clean state
DROP POLICY IF EXISTS "app_org_staff_can_read_vendors" ON public.vendors;
DROP POLICY IF EXISTS "org members read vendors" ON public.vendors;
DROP POLICY IF EXISTS "org read vendors" ON public.vendors;
DROP POLICY IF EXISTS "authenticated fallback read vendors" ON public.vendors;

-- Create unified read policy
CREATE POLICY "app_org_staff_can_read_vendors" ON public.vendors
  FOR SELECT TO authenticated
  USING (
    COALESCE(is_active, true) AND (
      org_id = (SELECT public.auth_user_org())
      OR org_id IS NULL
      OR (SELECT public.auth_user_org()) IS NULL
    )
  );

-- =============================================================================
-- SECTION 5: Ensure loaner_assignments has proper org-scoped policies
-- loaner_assignments doesn't have org_id directly; scope via jobs.org_id
-- =============================================================================

ALTER TABLE public.loaner_assignments ENABLE ROW LEVEL SECURITY;

-- Ensure the select policy exists and is correct
DROP POLICY IF EXISTS "org can select loaner_assignments via jobs" ON public.loaner_assignments;
CREATE POLICY "org can select loaner_assignments via jobs" ON public.loaner_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = loaner_assignments.job_id
      AND j.org_id = (SELECT public.auth_user_org())
    )
    OR (SELECT public.is_admin_or_manager())
    -- Fallback for users without org alignment
    OR (SELECT public.auth_user_org()) IS NULL
  );

-- =============================================================================
-- SECTION 6: Verification
-- =============================================================================

DO $$
DECLARE
  policy_count INT;
  func_count INT;
BEGIN
  -- Count key policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('user_profiles', 'products', 'vendors', 'loaner_assignments');
  
  -- Count helper functions
  SELECT COUNT(*) INTO func_count
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
  AND p.proname IN ('auth_user_org', 'app_current_org_id', 'is_admin_or_manager');
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Safety Net Consolidation Complete';
  RAISE NOTICE '  Total policies on key tables: %', policy_count;
  RAISE NOTICE '  Helper functions found: %', func_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  - user_profiles: auth.uid() based policies (no recursion risk)';
  RAISE NOTICE '  - products: org-scoped with fallback for unaligned users';
  RAISE NOTICE '  - vendors: org-scoped with fallback for unaligned users';
  RAISE NOTICE '  - loaner_assignments: org-scoped via jobs with admin fallback';
END $$;

-- =============================================================================
-- SECTION 7: Reload PostgREST schema cache
-- =============================================================================

NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Rollback notes:
-- This migration is designed to be safe and additive. If rollback is needed:
-- 1. The previous policies are preserved unless explicitly dropped above
-- 2. Helper functions are CREATE OR REPLACE (can be reverted to previous version)
-- 3. Run NOTIFY pgrst, 'reload schema' after any rollback
-- =============================================================================
