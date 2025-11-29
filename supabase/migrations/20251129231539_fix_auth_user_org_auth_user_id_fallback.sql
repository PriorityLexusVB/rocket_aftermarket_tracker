-- Migration: Fix auth_user_org() to check auth_user_id fallback
-- Date: 2025-11-29
-- Purpose: Update auth_user_org() function to also check auth_user_id column,
--          not just id column. This fixes RLS violations for users whose
--          user_profiles row has auth_user_id = auth.uid() but id != auth.uid().
--
-- Problem:
--   The current auth_user_org() function only checks:
--     WHERE id = (SELECT auth.uid())
--   
--   For users where user_profiles.auth_user_id = auth.uid() but id is different,
--   auth_user_org() returns NULL, causing RLS policies to fail.
--
--   This manifests as "Transaction access denied" errors when editing deals,
--   because the RLS INSERT policy on transactions uses:
--     org_id = public.auth_user_org()
--   which returns NULL for these users.
--
-- Solution:
--   Update auth_user_org() to check both id and auth_user_id columns,
--   matching the pattern used in is_admin_or_manager().
--
-- Context:
--   - is_admin_or_manager() already checks: (up.id = auth.uid() OR up.auth_user_id = auth.uid())
--   - This migration aligns auth_user_org() with that pattern
--   - The fix is idempotent and safe to run multiple times

-- =============================================================================
-- STEP 1: Create or replace auth_user_org() with auth_user_id fallback
-- =============================================================================
CREATE OR REPLACE FUNCTION public.auth_user_org()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- Check both id and auth_user_id columns to support all user linking scenarios
  -- Priority: id match first (most common), then auth_user_id fallback
  SELECT COALESCE(
    (SELECT org_id FROM public.user_profiles WHERE id = (SELECT auth.uid()) LIMIT 1),
    (SELECT org_id FROM public.user_profiles WHERE auth_user_id = (SELECT auth.uid()) LIMIT 1)
  );
$$;

-- =============================================================================
-- STEP 2: Add documentation comment
-- =============================================================================
COMMENT ON FUNCTION public.auth_user_org() IS 
'Returns the org_id for the currently authenticated user.
Checks both user_profiles.id and user_profiles.auth_user_id columns to support:
1. Users where user_profiles.id = auth.uid() (standard case)
2. Users where user_profiles.auth_user_id = auth.uid() (legacy/alternative linking)

This function is SECURITY DEFINER to bypass RLS when called from within RLS policies.
Uses (SELECT auth.uid()) pattern to avoid auth_rls_initplan anti-pattern.

Updated: 2025-11-29 to add auth_user_id fallback (fixes Transaction access denied errors)';

-- =============================================================================
-- STEP 3: Verification
-- =============================================================================
DO $$
DECLARE
  func_exists BOOLEAN;
  func_body TEXT;
BEGIN
  -- Check function exists
  SELECT EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.proname = 'auth_user_org'
  ) INTO func_exists;
  
  IF NOT func_exists THEN
    RAISE EXCEPTION 'auth_user_org function does not exist after migration!';
  END IF;
  
  -- Check function body includes auth_user_id
  SELECT prosrc INTO func_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_user_org';
  
  IF func_body NOT ILIKE '%auth_user_id%' THEN
    RAISE WARNING 'auth_user_org function may not include auth_user_id check';
  END IF;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'auth_user_org() function updated successfully';
  RAISE NOTICE 'Now checks both id and auth_user_id columns';
  RAISE NOTICE '========================================';
END $$;

-- =============================================================================
-- STEP 4: Reload PostgREST schema cache
-- =============================================================================
NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- Rollback instructions:
-- =============================================================================
-- To revert to the previous version:
-- CREATE OR REPLACE FUNCTION public.auth_user_org()
-- RETURNS uuid
-- LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
--   SELECT org_id FROM public.user_profiles WHERE id = (SELECT auth.uid());
-- $$;
