-- Database Function Hardening - Verification Queries
-- Run these queries after applying migrations to verify changes

-- ============================================================================
-- 1. Verify EXECUTE Permissions Have Been Revoked
-- ============================================================================

-- This should show that high-risk functions have no public/anon/authenticated grants
SELECT 
  p.proname as function_name,
  pg_catalog.pg_get_function_identity_arguments(p.oid) as arguments,
  p.prosecdef as is_security_definer,
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM pg_proc_acl_explode(p.proacl) pac
      JOIN pg_authid a ON a.oid = pac.grantee
      WHERE a.rolname IN ('public', 'anon', 'authenticated')
    ) THEN '❌ HAS PUBLIC ACCESS'
    ELSE '✅ RESTRICTED'
  END as access_status
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'cleanup_orphaned_profiles',
    'cleanup_illegitimate_users',
    'cleanup_priority_automotive_admins',
    'delete_job_cascade',
    'create_user_with_profile'
  )
ORDER BY p.proname;

-- ============================================================================
-- 2. Verify Cleanup Functions Use NOT EXISTS (Inspect Source)
-- ============================================================================

-- Check cleanup_orphaned_profiles source for NOT EXISTS pattern
SELECT 
  p.proname,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%NOT EXISTS%' THEN '✅ Uses NOT EXISTS'
    WHEN pg_get_functiondef(p.oid) LIKE '%NOT IN%' THEN '❌ Still uses NOT IN'
    ELSE '⚠️  Pattern not found'
  END as pattern_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'cleanup_orphaned_profiles',
    'cleanup_illegitimate_users'
  )
ORDER BY p.proname;

-- ============================================================================
-- 3. Verify Sequences Exist and Have Correct Settings
-- ============================================================================

SELECT 
  sequencename,
  last_value,
  increment_by,
  max_value,
  is_cycled,
  CASE 
    WHEN is_cycled THEN '❌ CYCLED (should be NO CYCLE)'
    ELSE '✅ NO CYCLE'
  END as cycle_check,
  CASE 
    WHEN last_value >= 1000 THEN '✅ Valid starting value'
    ELSE '⚠️  Low starting value'
  END as start_check
FROM pg_sequences
WHERE schemaname = 'public'
  AND sequencename IN ('job_number_seq', 'transaction_number_seq')
ORDER BY sequencename;

-- ============================================================================
-- 4. Test Sequence Health Check Function
-- ============================================================================

-- This should return health metrics for both sequences
SELECT * FROM public.check_sequence_health();

-- ============================================================================
-- 5. Test Generator Functions
-- ============================================================================

-- Test job number generation (should return format: JOB-YYYY-NNNNNN)
SELECT 
  public.generate_job_number() as job_number,
  public.generate_job_number() ~ '^JOB-[0-9]{4}-[0-9]{6}$' as format_valid;

-- Test transaction number generation (should return format: TXN-YYYYMMDD-NNNN)
SELECT 
  public.generate_transaction_number() as txn_number,
  public.generate_transaction_number() ~ '^TXN-[0-9]{8}-[0-9]{4}$' as format_valid;

-- ============================================================================
-- 6. Verify Function Definitions Have Been Updated
-- ============================================================================

-- Check that functions no longer use SELECT *
SELECT 
  p.proname,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%SELECT *%' THEN '⚠️  Still uses SELECT *'
    ELSE '✅ Uses explicit columns'
  END as select_star_check,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%NOT FOUND%' OR 
         pg_get_functiondef(p.oid) LIKE '%IS NULL%' THEN '✅ Has NULL checks'
    ELSE '⚠️  Missing NULL checks'
  END as null_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'validate_deal_line_items',
    'auto_enqueue_status_sms',
    'set_deal_dates_and_calendar'
  )
ORDER BY p.proname;

-- ============================================================================
-- 7. Verify PL/pgSQL Conversion (Generator Functions)
-- ============================================================================

-- Check that generator functions are now PL/pgSQL (not SQL)
SELECT 
  p.proname,
  l.lanname as language,
  CASE 
    WHEN l.lanname = 'plpgsql' THEN '✅ PL/pgSQL'
    WHEN l.lanname = 'sql' THEN '⚠️  Still SQL'
    ELSE '❓ ' || l.lanname
  END as language_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname IN (
    'generate_job_number',
    'generate_transaction_number'
  )
ORDER BY p.proname;

-- ============================================================================
-- 8. Check for IS DISTINCT FROM Usage (NULL-safe comparisons)
-- ============================================================================

-- Verify validate_deal_line_items uses IS DISTINCT FROM
SELECT 
  p.proname,
  CASE 
    WHEN pg_get_functiondef(p.oid) LIKE '%IS DISTINCT FROM%' THEN '✅ Uses IS DISTINCT FROM'
    ELSE '⚠️  May not have NULL-safe comparison'
  END as distinct_check
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'validate_deal_line_items';

-- ============================================================================
-- 9. Test NULL Safety (Safe to Run)
-- ============================================================================

-- These tests should not crash and should handle NULLs gracefully

-- Test: Generate numbers multiple times (ensure no crashes)
SELECT 
  generate_job_number() as job1,
  generate_job_number() as job2,
  generate_transaction_number() as txn1,
  generate_transaction_number() as txn2;

-- Test: Sequence health with existing sequences
SELECT 
  sequence_name,
  current_value,
  usage_percent,
  CASE 
    WHEN usage_percent < 50 THEN '✅ Healthy'
    WHEN usage_percent < 80 THEN '⚠️  Monitor'
    ELSE '❌ Approaching limit'
  END as health_status
FROM public.check_sequence_health();

-- ============================================================================
-- 10. Summary Report
-- ============================================================================

-- Combine all checks into a summary report
SELECT 
  'Permission Hardening' as check_category,
  COUNT(*) FILTER (
    WHERE NOT EXISTS (
      SELECT 1 FROM pg_proc_acl_explode(p.proacl) pac
      JOIN pg_authid a ON a.oid = pac.grantee
      WHERE a.rolname IN ('public', 'anon', 'authenticated')
    )
  )::TEXT || ' / 5 functions restricted' as result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'cleanup_orphaned_profiles',
    'cleanup_illegitimate_users',
    'cleanup_priority_automotive_admins',
    'delete_job_cascade',
    'create_user_with_profile'
  )

UNION ALL

SELECT 
  'NOT EXISTS Pattern' as check_category,
  COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) LIKE '%NOT EXISTS%')::TEXT || 
  ' / 2 cleanup functions updated' as result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('cleanup_orphaned_profiles', 'cleanup_illegitimate_users')

UNION ALL

SELECT 
  'Sequences Verified' as check_category,
  COUNT(*)::TEXT || ' / 2 sequences exist' as result
FROM pg_sequences
WHERE schemaname = 'public'
  AND sequencename IN ('job_number_seq', 'transaction_number_seq')

UNION ALL

SELECT 
  'Generator Functions' as check_category,
  COUNT(*) FILTER (WHERE l.lanname = 'plpgsql')::TEXT || 
  ' / 2 converted to PL/pgSQL' as result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_language l ON l.oid = p.prolang
WHERE n.nspname = 'public'
  AND p.proname IN ('generate_job_number', 'generate_transaction_number')

UNION ALL

SELECT 
  'NULL-Safe Logic' as check_category,
  COUNT(*) FILTER (WHERE pg_get_functiondef(p.oid) LIKE '%IS DISTINCT FROM%')::TEXT ||
  ' / 1 functions using NULL-safe comparison' as result
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'validate_deal_line_items';

-- ============================================================================
-- Expected Results Summary
-- ============================================================================

/*
After successful migration, you should see:

1. ✅ All 5 high-risk functions show "RESTRICTED" status
2. ✅ Cleanup functions use "NOT EXISTS" pattern
3. ✅ Both sequences exist with NO CYCLE and valid starting values
4. ✅ check_sequence_health() returns 2 rows with health metrics
5. ✅ Generator functions return valid format strings
6. ✅ Functions use explicit columns (not SELECT *)
7. ✅ Generator functions are PL/pgSQL (not SQL)
8. ✅ validate_deal_line_items uses IS DISTINCT FROM
9. ✅ All NULL safety tests complete without errors
10. ✅ Summary report shows 100% completion for all categories

If any checks fail:
- Review the migration logs for errors
- Check if migrations were applied in order
- Verify database version (PostgreSQL 12+)
- See docs/DB-HARDENING-NOTES.md for troubleshooting
*/
