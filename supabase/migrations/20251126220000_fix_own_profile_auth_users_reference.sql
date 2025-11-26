-- Migration: Fix 'own profile read by email' policy auth.users reference
-- Date: 2025-11-26
-- Purpose: Remove direct auth.users reference that causes "permission denied for table users" error
-- Context: The policy created in 20251126140000 directly queries auth.users table,
--          which authenticated users don't have SELECT access to.
--
-- Error fixed: "Failed to load deals: permission denied for table users"
--
-- Problem:
--   The policy "own profile read by email" uses:
--     email = (SELECT email FROM auth.users WHERE id = auth.uid())
--   This fails because RLS policies can't access auth.users directly.
--
-- Solution:
--   Use auth.jwt() ->> 'email' instead, which returns the email from the JWT token
--   without requiring access to the auth.users table.

-- =============================================================================
-- STEP 1: Drop the problematic policy
-- =============================================================================
DROP POLICY IF EXISTS "own profile read by email" ON public.user_profiles;

-- =============================================================================
-- STEP 2: Recreate with JWT-based email matching (no auth.users reference)
-- =============================================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='user_profiles' 
    AND policyname='own profile read by email via jwt'
  ) THEN
    CREATE POLICY "own profile read by email via jwt" ON public.user_profiles
    FOR SELECT TO authenticated
    USING (
      -- Use JWT email claim instead of auth.users table
      -- Wrapped in (SELECT ...) to avoid auth_rls_initplan anti-pattern
      email = ((SELECT auth.jwt()) ->> 'email')
    );
    
    RAISE NOTICE 'Created policy: own profile read by email via jwt';
  END IF;
END $$;

-- =============================================================================
-- STEP 3: Verification
-- =============================================================================
DO $$
DECLARE
  old_policy_exists BOOLEAN;
  new_policy_exists BOOLEAN;
BEGIN
  -- Check old problematic policy is gone
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='user_profiles' 
    AND policyname='own profile read by email'
  ) INTO old_policy_exists;
  
  -- Check new policy exists
  SELECT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname='public' 
    AND tablename='user_profiles' 
    AND policyname='own profile read by email via jwt'
  ) INTO new_policy_exists;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Fix auth.users Reference in user_profiles Policy';
  RAISE NOTICE '  Old policy dropped: %', NOT old_policy_exists;
  RAISE NOTICE '  New policy created: %', new_policy_exists;
  RAISE NOTICE '========================================';
  
  IF old_policy_exists THEN
    RAISE WARNING 'Old policy "own profile read by email" still exists - it should have been dropped';
  END IF;
  
  IF NOT new_policy_exists THEN
    RAISE WARNING 'New policy "own profile read by email via jwt" was not created';
  END IF;
END $$;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Notes:
-- =============================================================================
-- 1. auth.jwt() ->> 'email' retrieves email from the authenticated user's JWT token
-- 2. This avoids the "permission denied for table users" error
-- 3. The policy allows users to read their own profile by matching email
-- 4. This is a fallback for environments where user_profiles.id != auth.uid()
-- 5. The fix aligns with the pattern used in 20251115222458 for loaner_assignments
