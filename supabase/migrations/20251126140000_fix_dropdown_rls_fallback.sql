-- Migration: Fix Dropdown RLS for Users Without Org Profile Alignment
-- Date: 2025-11-26
-- Purpose: Allow authenticated users to read dropdown data even when auth_user_org() returns NULL
--          This can happen when user_profiles.id doesn't match auth.uid() or when org_id is NULL
-- Context: O2 Deep Deal RLS Audit - Addresses vendors/products/user_profiles 401 errors
--
-- Problem: Current policies require org_id = auth_user_org(), but when auth_user_org() returns NULL:
--   - NULL = UUID comparison always returns FALSE
--   - Users can't see any vendors, products, or user_profiles for dropdowns
--
-- Solution: Add fallback policies that allow authenticated users to read active dropdown data
--           when they have a valid auth session but no org alignment

-- =============================================================================
-- SECTION 1: Add fallback SELECT policy for vendors
-- =============================================================================
-- This policy allows authenticated users to read active vendors regardless of org matching
-- Priority: This runs in addition to existing policies (PostgreSQL OR logic)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='vendors' 
    AND policyname='authenticated fallback read vendors'
  ) THEN
    CREATE POLICY "authenticated fallback read vendors" ON public.vendors
    FOR SELECT TO authenticated
    USING (
      -- Allow if active and user doesn't have org alignment yet
      coalesce(is_active, true) 
      AND public.auth_user_org() IS NULL
    );
    
    RAISE NOTICE 'Created policy: authenticated fallback read vendors';
  END IF;
END $$;

-- =============================================================================
-- SECTION 2: Add fallback SELECT policy for products
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='products' 
    AND policyname='authenticated fallback read products'
  ) THEN
    CREATE POLICY "authenticated fallback read products" ON public.products
    FOR SELECT TO authenticated
    USING (
      coalesce(is_active, true) 
      AND public.auth_user_org() IS NULL
    );
    
    RAISE NOTICE 'Created policy: authenticated fallback read products';
  END IF;
END $$;

-- =============================================================================
-- SECTION 3: Add fallback SELECT policy for user_profiles (for staff dropdowns)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='user_profiles' 
    AND policyname='authenticated fallback read user_profiles'
  ) THEN
    CREATE POLICY "authenticated fallback read user_profiles" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
      -- Allow if active and user doesn't have org alignment yet
      coalesce(is_active, true) 
      AND public.auth_user_org() IS NULL
    );
    
    RAISE NOTICE 'Created policy: authenticated fallback read user_profiles';
  END IF;
END $$;

-- =============================================================================
-- SECTION 4: Also add fallback for auth_user_org() alternative
-- =============================================================================
-- This is an additional safeguard: allow users to read their own profile by email match
-- This helps auth_user_org() work even when user_profiles.id != auth.uid()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='user_profiles' 
    AND policyname='own profile read by email'
  ) THEN
    CREATE POLICY "own profile read by email" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
      -- Allow users to read their own profile via email match
      -- This is important because some environments have user_profiles.id != auth.uid()
      email = (SELECT email FROM auth.users WHERE id = auth.uid())
    );
    
    RAISE NOTICE 'Created policy: own profile read by email';
  END IF;
END $$;

-- =============================================================================
-- SECTION 5: Verification
-- =============================================================================
DO $$
DECLARE
  policy_count INT;
BEGIN
  SELECT COUNT(*) INTO policy_count 
  FROM pg_policies 
  WHERE schemaname = 'public' 
  AND policyname LIKE '%fallback%';
  
  RAISE NOTICE 'Dropdown RLS fallback policies created. Total fallback policies: %', policy_count;
END $$;

-- Success message
COMMENT ON FUNCTION public.auth_user_org IS 
'Returns the org_id of the authenticated user from user_profiles.
If this returns NULL, fallback RLS policies allow basic dropdown access.
Migration 20251126140000 added fallback policies to handle NULL auth_user_org cases.';
