-- Test Data Cleanup Script
-- Purpose: Clean up test/demo deals while preserving production data and one recent test deal
-- Date: November 18, 2025
-- IMPORTANT: Review and customize WHERE clauses before running in production

-- ============================================================================
-- SAFETY CHECKS - Run these first to verify what will be affected
-- ============================================================================

-- 1. Preview: Count test deals that would be deleted
SELECT 
  COUNT(*) as test_deals_count,
  COUNT(DISTINCT org_id) as affected_orgs
FROM jobs
WHERE 
  -- Test deal patterns (customize based on your naming conventions)
  (
    job_number LIKE 'TEST-%' 
    OR job_number LIKE 'JOB-%' 
    OR title LIKE 'Test %'
    OR title LIKE 'Deal JOB-%'
    OR customer_name IN ('Test Customer', 'Unknown Customer')
  )
  -- Additional safety: Only old test data (older than 7 days)
  AND created_at < NOW() - INTERVAL '7 days'
  -- Exclude if you want to keep the most recent test deal
  AND id NOT IN (
    SELECT id FROM jobs
    WHERE (
      job_number LIKE 'TEST-%' 
      OR job_number LIKE 'JOB-%'
      OR title LIKE 'Test %'
    )
    ORDER BY created_at DESC
    LIMIT 1
  );

-- 2. Preview: Show sample of test deals that would be deleted
SELECT 
  id,
  job_number,
  title,
  customer_name,
  created_at,
  org_id
FROM jobs
WHERE 
  (
    job_number LIKE 'TEST-%' 
    OR job_number LIKE 'JOB-%' 
    OR title LIKE 'Test %'
    OR title LIKE 'Deal JOB-%'
    OR customer_name IN ('Test Customer', 'Unknown Customer')
  )
  AND created_at < NOW() - INTERVAL '7 days'
  AND id NOT IN (
    SELECT id FROM jobs
    WHERE (
      job_number LIKE 'TEST-%' 
      OR job_number LIKE 'JOB-%'
      OR title LIKE 'Test %'
    )
    ORDER BY created_at DESC
    LIMIT 1
  )
ORDER BY created_at DESC
LIMIT 10;

-- 3. Preview: Identify the one test deal that will be KEPT
SELECT 
  id,
  job_number,
  title,
  customer_name,
  created_at,
  org_id
FROM jobs
WHERE (
  job_number LIKE 'TEST-%' 
  OR job_number LIKE 'JOB-%'
  OR title LIKE 'Test %'
)
ORDER BY created_at DESC
LIMIT 1;

-- ============================================================================
-- CLEANUP EXECUTION - Only run after reviewing preview results
-- ============================================================================

-- STEP 1: Create a backup table (RECOMMENDED)
-- Uncomment to create backup before deletion
/*
CREATE TABLE IF NOT EXISTS jobs_backup_before_cleanup AS
SELECT * FROM jobs
WHERE 
  (
    job_number LIKE 'TEST-%' 
    OR job_number LIKE 'JOB-%' 
    OR title LIKE 'Test %'
    OR title LIKE 'Deal JOB-%'
    OR customer_name IN ('Test Customer', 'Unknown Customer')
  )
  AND created_at < NOW() - INTERVAL '7 days'
  AND id NOT IN (
    SELECT id FROM jobs
    WHERE (
      job_number LIKE 'TEST-%' 
      OR job_number LIKE 'JOB-%'
      OR title LIKE 'Test %'
    )
    ORDER BY created_at DESC
    LIMIT 1
  );
*/

-- STEP 2: Delete related records (if cascade doesn't handle it)
-- Note: If you have ON DELETE CASCADE, you can skip this

-- Delete job_parts for test jobs
/*
DELETE FROM job_parts
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE 
    (
      job_number LIKE 'TEST-%' 
      OR job_number LIKE 'JOB-%' 
      OR title LIKE 'Test %'
      OR title LIKE 'Deal JOB-%'
      OR customer_name IN ('Test Customer', 'Unknown Customer')
    )
    AND created_at < NOW() - INTERVAL '7 days'
    AND id NOT IN (
      SELECT id FROM jobs
      WHERE (
        job_number LIKE 'TEST-%' 
        OR job_number LIKE 'JOB-%'
        OR title LIKE 'Test %'
      )
      ORDER BY created_at DESC
      LIMIT 1
    )
);
*/

-- Delete transactions for test jobs
/*
DELETE FROM transactions
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE 
    (
      job_number LIKE 'TEST-%' 
      OR job_number LIKE 'JOB-%' 
      OR title LIKE 'Test %'
      OR title LIKE 'Deal JOB-%'
      OR customer_name IN ('Test Customer', 'Unknown Customer')
    )
    AND created_at < NOW() - INTERVAL '7 days'
    AND id NOT IN (
      SELECT id FROM jobs
      WHERE (
        job_number LIKE 'TEST-%' 
        OR job_number LIKE 'JOB-%'
        OR title LIKE 'Test %'
      )
      ORDER BY created_at DESC
      LIMIT 1
    )
);
*/

-- Delete loaner assignments for test jobs
/*
DELETE FROM loaner_assignments
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE 
    (
      job_number LIKE 'TEST-%' 
      OR job_number LIKE 'JOB-%' 
      OR title LIKE 'Test %'
      OR title LIKE 'Deal JOB-%'
      OR customer_name IN ('Test Customer', 'Unknown Customer')
    )
    AND created_at < NOW() - INTERVAL '7 days'
    AND id NOT IN (
      SELECT id FROM jobs
      WHERE (
        job_number LIKE 'TEST-%' 
        OR job_number LIKE 'JOB-%'
        OR title LIKE 'Test %'
      )
      ORDER BY created_at DESC
      LIMIT 1
    )
);
*/

-- STEP 3: Delete the test jobs themselves
-- UNCOMMENT TO EXECUTE (after reviewing preview and creating backup)
/*
DELETE FROM jobs
WHERE 
  (
    job_number LIKE 'TEST-%' 
    OR job_number LIKE 'JOB-%' 
    OR title LIKE 'Test %'
    OR title LIKE 'Deal JOB-%'
    OR customer_name IN ('Test Customer', 'Unknown Customer')
  )
  AND created_at < NOW() - INTERVAL '7 days'
  AND id NOT IN (
    SELECT id FROM jobs
    WHERE (
      job_number LIKE 'TEST-%' 
      OR job_number LIKE 'JOB-%'
      OR title LIKE 'Test %'
    )
    ORDER BY created_at DESC
    LIMIT 1
  );
*/

-- ============================================================================
-- POST-CLEANUP VERIFICATION
-- ============================================================================

-- 1. Count remaining test deals (should be 1)
SELECT 
  COUNT(*) as remaining_test_deals
FROM jobs
WHERE 
  job_number LIKE 'TEST-%' 
  OR job_number LIKE 'JOB-%' 
  OR title LIKE 'Test %';

-- 2. Show the remaining test deal (for verification)
SELECT 
  id,
  job_number,
  title,
  customer_name,
  created_at,
  org_id
FROM jobs
WHERE 
  job_number LIKE 'TEST-%' 
  OR job_number LIKE 'JOB-%' 
  OR title LIKE 'Test %'
ORDER BY created_at DESC;

-- 3. Verify no orphaned records
SELECT 
  'job_parts' as table_name,
  COUNT(*) as orphaned_count
FROM job_parts jp
WHERE NOT EXISTS (SELECT 1 FROM jobs j WHERE j.id = jp.job_id)
UNION ALL
SELECT 
  'transactions' as table_name,
  COUNT(*) as orphaned_count
FROM transactions t
WHERE NOT EXISTS (SELECT 1 FROM jobs j WHERE j.id = t.job_id)
UNION ALL
SELECT 
  'loaner_assignments' as table_name,
  COUNT(*) as orphaned_count
FROM loaner_assignments la
WHERE NOT EXISTS (SELECT 1 FROM jobs j WHERE j.id = la.job_id);

-- ============================================================================
-- NOTES AND RECOMMENDATIONS
-- ============================================================================

/*
USAGE INSTRUCTIONS:
1. Review the SAFETY CHECKS section and run preview queries
2. Verify that only test data will be affected
3. Customize the WHERE clauses to match your test data patterns
4. Uncomment and run the backup creation query
5. Uncomment and run the cleanup queries one at a time
6. Run the POST-CLEANUP VERIFICATION queries
7. Document the cleanup in your change log

CUSTOMIZATION:
- Adjust the INTERVAL '7 days' to match your retention policy
- Modify the LIKE patterns to match your test data naming conventions
- Add additional WHERE conditions to ensure only test data is affected
- Change LIMIT 1 to LIMIT N if you want to keep N recent test deals

SAFETY FEATURES:
- All deletion queries are commented out by default
- Preview queries allow verification before execution
- Backup table creation for rollback capability
- Age filter (7 days) prevents deletion of recent test data
- Explicit exclusion of the most recent test deal
- Orphaned records check after cleanup

ALTERNATIVE: Admin Utility
Instead of SQL, you could create a Node.js script:
- scripts/cleanupTestDeals.js
- Uses dealService methods for proper cleanup
- Includes interactive prompts for safety
- Logs all deletions for audit trail
- Can be integrated into admin UI

PRODUCTION CONSIDERATIONS:
- Run during low-traffic periods
- Consider database backup before running
- Test on staging environment first
- Monitor for unexpected side effects
- Document the cleanup in change management system
*/
