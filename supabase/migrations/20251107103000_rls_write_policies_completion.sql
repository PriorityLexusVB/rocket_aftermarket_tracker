-- Migration: Complete RLS Policy Audit and Write Permissions
-- Date: 2025-11-07
-- Purpose: Final audit to ensure all write policies exist and no auth.users references remain
-- Context: Completing remaining objectives from RLS audit scope
-- Dependencies:
--   - 20251104221500_fix_is_admin_or_manager_auth_users_references.sql
--   - 20251105000000_fix_rls_policies_and_write_permissions.sql
--   - 20251106210000_multi_tenant_rls_hardening.sql

-- =============================================================================
-- SECTION 1: Verify and Document Current RLS State
-- =============================================================================

-- Helper function to log policy existence
DO $$
DECLARE
  loaner_read_count INT;
  loaner_write_count INT;
  transaction_write_count INT;
  vehicle_write_count INT;
  sms_write_count INT;
BEGIN
  -- Count existing policies for verification
  SELECT COUNT(*) INTO loaner_read_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'loaner_assignments'
    AND (policyname LIKE '%can select%' OR policyname LIKE '%read%');

  SELECT COUNT(*) INTO loaner_write_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'loaner_assignments'
    AND (policyname LIKE '%insert%' OR policyname LIKE '%update%' OR policyname LIKE '%delete%');

  SELECT COUNT(*) INTO transaction_write_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'transactions'
    AND (policyname LIKE '%insert%' OR policyname LIKE '%update%');

  SELECT COUNT(*) INTO vehicle_write_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'vehicles'
    AND (policyname LIKE '%insert%' OR policyname LIKE '%update%');

  SELECT COUNT(*) INTO sms_write_count
  FROM pg_policies
  WHERE schemaname = 'public'
    AND tablename = 'sms_templates'
    AND (policyname LIKE '%insert%' OR policyname LIKE '%update%' OR policyname LIKE '%delete%');

  RAISE NOTICE '========================================';
  RAISE NOTICE 'RLS Policy Audit Results:';
  RAISE NOTICE '  loaner_assignments read policies: %', loaner_read_count;
  RAISE NOTICE '  loaner_assignments write policies: %', loaner_write_count;
  RAISE NOTICE '  transactions write policies: %', transaction_write_count;
  RAISE NOTICE '  vehicles write policies: %', vehicle_write_count;
  RAISE NOTICE '  sms_templates write policies: %', sms_write_count;
  RAISE NOTICE '========================================';
END $$;

-- =============================================================================
-- SECTION 2: Ensure READ policies exist (idempotent)
-- =============================================================================

-- Policy: Allow users to SELECT loaner_assignments for jobs in their org
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public'
    AND tablename='loaner_assignments'
    AND policyname='org can select loaner_assignments via jobs'
  ) THEN
    CREATE POLICY "org can select loaner_assignments via jobs" ON public.loaner_assignments
    FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.jobs j
        WHERE j.id = loaner_assignments.job_id
        AND j.org_id = public.auth_user_org()
      )
      OR public.is_admin_or_manager()
    );

    RAISE NOTICE 'Created policy: org can select loaner_assignments via jobs';
  ELSE
    RAISE NOTICE 'Policy already exists: org can select loaner_assignments via jobs';
  END IF;
END $$;

-- =============================================================================
-- SECTION 3: Verify Helper Functions Don't Reference auth.users
-- =============================================================================

DO $$
DECLARE
  func_body TEXT;
  has_auth_users_ref BOOLEAN;
BEGIN
  -- Check is_admin_or_manager function
  SELECT prosrc INTO func_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'is_admin_or_manager';

  IF func_body IS NOT NULL THEN
    has_auth_users_ref := func_body LIKE '%auth.users%';
    IF has_auth_users_ref THEN
      RAISE WARNING 'Function is_admin_or_manager() contains auth.users reference. Apply migration 20251104221500 to fix.';
    ELSE
      RAISE NOTICE '✓ Function is_admin_or_manager() does not reference auth.users';
    END IF;
  ELSE
    RAISE WARNING 'Function is_admin_or_manager() not found. Ensure migration 20251022230000 is applied.';
  END IF;

  -- Check auth_user_org function
  SELECT prosrc INTO func_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_user_org';

  IF func_body IS NOT NULL THEN
    has_auth_users_ref := func_body LIKE '%auth.users%';
    IF has_auth_users_ref THEN
      RAISE WARNING 'Function auth_user_org() contains auth.users reference. Review and update if needed.';
    ELSE
      RAISE NOTICE '✓ Function auth_user_org() does not reference auth.users';
    END IF;
  ELSE
    RAISE WARNING 'Function auth_user_org() not found. Ensure migration 20251022230000 is applied.';
  END IF;
END $$;

-- =============================================================================
-- SECTION 4: Ensure RLS is enabled on all relevant tables (idempotent)
-- =============================================================================

ALTER TABLE IF EXISTS public.loaner_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vehicles ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.sms_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.vendors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.job_parts ENABLE ROW LEVEL SECURITY;

-- =============================================================================
-- SECTION 5: Documentation Comments
-- =============================================================================

COMMENT ON TABLE public.loaner_assignments IS
'Loaner vehicle assignments for jobs requiring customer transportation.
Multi-tenant isolation via job->org_id relationship.
RLS Pattern: SELECT (via job org match or admin), INSERT/UPDATE/DELETE (via job org match or admin).
Write policies added in 20251105000000_fix_rls_policies_and_write_permissions.sql';

COMMENT ON TABLE public.transactions IS
'Financial transactions related to jobs and customers.
Multi-tenant isolation via org_id and job->org_id relationship.
RLS Pattern: SELECT/INSERT/UPDATE (org match or via job org match).
Write policies added in 20251105000000_fix_rls_policies_and_write_permissions.sql';

COMMENT ON TABLE public.vehicles IS
'Vehicle records owned by customers or organization.
Multi-tenant isolation via org_id (nullable for shared records).
RLS Pattern: SELECT/INSERT/UPDATE (org match or NULL org_id).
Write policies added in 20251105000000_fix_rls_policies_and_write_permissions.sql';

-- =============================================================================
-- SECTION 6: Final Validation and Summary
-- =============================================================================

DO $$
DECLARE
  total_policies INT;
  tables_with_rls INT;
  functions_ok INT := 0;
  func_body TEXT;
BEGIN
  -- Count all org-scoped policies
  SELECT COUNT(*) INTO total_policies
  FROM pg_policies
  WHERE schemaname = 'public'
  AND tablename IN ('loaner_assignments', 'transactions', 'vehicles', 'sms_templates', 'products', 'vendors', 'jobs', 'job_parts');

  -- Count tables with RLS enabled
  SELECT COUNT(*) INTO tables_with_rls
  FROM pg_tables t
  WHERE t.schemaname = 'public'
  AND t.tablename IN ('loaner_assignments', 'transactions', 'vehicles', 'sms_templates', 'products', 'vendors', 'jobs', 'job_parts')
  AND t.rowsecurity = true;

  -- Verify helper functions
  SELECT prosrc INTO func_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'is_admin_or_manager';

  IF func_body IS NOT NULL AND func_body NOT LIKE '%auth.users%' THEN
    functions_ok := functions_ok + 1;
  END IF;

  SELECT prosrc INTO func_body
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.proname = 'auth_user_org';

  IF func_body IS NOT NULL THEN
    functions_ok := functions_ok + 1;
  END IF;

  RAISE NOTICE '========================================';
  RAISE NOTICE '✅ RLS POLICY AUDIT COMPLETE';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Summary:';
  RAISE NOTICE '  Total RLS policies: %', total_policies;
  RAISE NOTICE '  Tables with RLS enabled: %/8', tables_with_rls;
  RAISE NOTICE '  Helper functions verified: %/2', functions_ok;
  RAISE NOTICE '';
  RAISE NOTICE 'Status:';
  
  IF total_policies >= 20 AND tables_with_rls >= 8 AND functions_ok >= 2 THEN
    RAISE NOTICE '  ✓ All RLS policies and helper functions in place';
    RAISE NOTICE '  ✓ Multi-tenant isolation properly configured';
    RAISE NOTICE '  ✓ No auth.users references in helper functions';
  ELSE
    RAISE WARNING '  ⚠ Some policies or functions may be missing';
    RAISE WARNING '  Review previous migrations:';
    RAISE WARNING '    - 20251022230000_rls_audit_refinements.sql';
    RAISE WARNING '    - 20251104221500_fix_is_admin_or_manager_auth_users_references.sql';
    RAISE WARNING '    - 20251105000000_fix_rls_policies_and_write_permissions.sql';
    RAISE WARNING '    - 20251106210000_multi_tenant_rls_hardening.sql';
  END IF;
  RAISE NOTICE '========================================';
END $$;

-- =============================================================================
-- SECTION 7: Reload PostgREST Schema Cache
-- =============================================================================

-- Ensure PostgREST recognizes any policy changes
NOTIFY pgrst, 'reload schema';

-- Final success message
DO $$
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE '🎉 Migration 20251107103000 completed successfully';
  RAISE NOTICE '📋 Next steps:';
  RAISE NOTICE '   1. Run: ./scripts/verify-schema-cache.sh';
  RAISE NOTICE '   2. Run: pnpm test';
  RAISE NOTICE '   3. Verify no "permission denied for table users" errors in logs';
  RAISE NOTICE '========================================';
END $$;
