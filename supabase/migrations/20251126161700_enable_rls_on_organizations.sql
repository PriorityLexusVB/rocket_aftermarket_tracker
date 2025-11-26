-- Migration: Enable RLS on public.organizations
-- Date: 2025-11-26
-- Purpose: Fix db lint error "RLS Disabled in Public" on public.organizations
-- Context: Supabase DB Hardening - Step 1

-- =============================================================================
-- STEP 1: Enable Row Level Security on organizations table
-- =============================================================================

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- STEP 2: Revoke broad public access
-- =============================================================================

REVOKE ALL ON TABLE public.organizations FROM public;
REVOKE ALL ON TABLE public.organizations FROM anon;

-- =============================================================================
-- STEP 3: Grant service_role full access (for admin operations)
-- =============================================================================

GRANT ALL ON TABLE public.organizations TO service_role;

-- =============================================================================
-- STEP 4: Create SELECT policy for authenticated users
-- Organizations are visible to users who belong to them via user_profiles.org_id
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'org_members_select_own_org'
  ) THEN
    CREATE POLICY "org_members_select_own_org"
      ON public.organizations
      AS PERMISSIVE
      FOR SELECT
      TO authenticated
      USING (
        id IN (
          SELECT up.org_id
          FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
        )
      );
    RAISE NOTICE 'Created policy: org_members_select_own_org';
  ELSE
    RAISE NOTICE 'Policy org_members_select_own_org already exists';
  END IF;
END $$;

-- =============================================================================
-- STEP 5: Create UPDATE policy for authenticated users (org members only)
-- Org members can update their own organization record
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'organizations' 
    AND policyname = 'org_members_update_own_org'
  ) THEN
    CREATE POLICY "org_members_update_own_org"
      ON public.organizations
      AS PERMISSIVE
      FOR UPDATE
      TO authenticated
      USING (
        id IN (
          SELECT up.org_id
          FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
        )
      )
      WITH CHECK (
        id IN (
          SELECT up.org_id
          FROM public.user_profiles up
          WHERE up.id = (SELECT auth.uid())
        )
      );
    RAISE NOTICE 'Created policy: org_members_update_own_org';
  ELSE
    RAISE NOTICE 'Policy org_members_update_own_org already exists';
  END IF;
END $$;

-- =============================================================================
-- STEP 6: Validation
-- =============================================================================

DO $$
DECLARE
  rls_enabled BOOLEAN;
  policy_count INT;
BEGIN
  -- Verify RLS is enabled
  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname = 'organizations';

  -- Count policies
  SELECT COUNT(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'organizations';

  RAISE NOTICE '========================================';
  RAISE NOTICE 'Organizations RLS Configuration:';
  RAISE NOTICE '  RLS Enabled: %', rls_enabled;
  RAISE NOTICE '  Policy Count: %', policy_count;
  RAISE NOTICE '========================================';

  IF NOT rls_enabled THEN
    RAISE EXCEPTION 'RLS is not enabled on public.organizations';
  END IF;

  IF policy_count < 2 THEN
    RAISE WARNING 'Expected at least 2 policies on organizations, found %', policy_count;
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Notes:
-- =============================================================================
-- 1. Organizations use user_profiles.org_id for tenant membership
-- 2. auth.uid() is wrapped in (SELECT ...) to avoid auth_rls_initplan warnings
-- 3. service_role has full access for admin/backend operations
-- 4. INSERT policy is intentionally omitted - org creation is service_role only
-- 5. DELETE policy is intentionally omitted - org deletion is service_role only
