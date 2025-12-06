-- Cleanup Old Deals - SQL Version
-- 
-- Purpose: Delete ALL existing deals (jobs + related data) except for the 
-- single newest one for a specific organization.
--
-- ⚠️  WARNING ⚠️
-- This is a DESTRUCTIVE operation. Always:
-- 1. Backup your database first
-- 2. Run the preview queries first (STEP 1 and STEP 2)
-- 3. Verify the output carefully
-- 4. Only run STEP 3 after confirming the preview
--
-- INSTRUCTIONS:
-- Replace the following placeholders before running:
--   :ORG_ID - Your organization UUID (e.g., '550e8400-e29b-41d4-a716-446655440000')
--   :KEEP_JOB_ID - The ID of the job to keep (obtained from STEP 1)
--

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 1: Find the newest job for your org (run this first)
-- ═══════════════════════════════════════════════════════════════════════════
-- Copy the 'id' from the result to use as :KEEP_JOB_ID in STEP 3

SELECT 
  id,
  job_number,
  title,
  created_at,
  updated_at,
  org_id
FROM jobs
WHERE org_id = ':ORG_ID'
ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST
LIMIT 1;

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 2: Preview what will be deleted (run this second)
-- ═══════════════════════════════════════════════════════════════════════════

-- A. Count jobs to delete
SELECT COUNT(*) as jobs_to_delete
FROM jobs
WHERE org_id = ':ORG_ID'
  AND id != ':KEEP_JOB_ID';

-- B. Preview jobs to delete
SELECT 
  id, 
  job_number, 
  title, 
  created_at
FROM jobs
WHERE org_id = ':ORG_ID'
  AND id != ':KEEP_JOB_ID'
ORDER BY created_at DESC;

-- C. Count related records that will be deleted
SELECT 
  'job_parts' as table_name,
  COUNT(*) as records_to_delete
FROM job_parts
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = ':ORG_ID' AND id != ':KEEP_JOB_ID'
)
UNION ALL
SELECT 
  'loaner_assignments' as table_name,
  COUNT(*) as records_to_delete
FROM loaner_assignments
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = ':ORG_ID' AND id != ':KEEP_JOB_ID'
)
UNION ALL
SELECT 
  'transactions' as table_name,
  COUNT(*) as records_to_delete
FROM transactions
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = ':ORG_ID' AND id != ':KEEP_JOB_ID'
);

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 3: Perform the deletion (ONLY after reviewing preview results)
-- ═══════════════════════════════════════════════════════════════════════════
-- ⚠️  WARNING: This will PERMANENTLY delete data! ⚠️

BEGIN;

-- Delete job_parts for old jobs
DELETE FROM job_parts
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = ':ORG_ID' AND id != ':KEEP_JOB_ID'
);

-- Delete loaner_assignments for old jobs
DELETE FROM loaner_assignments
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = ':ORG_ID' AND id != ':KEEP_JOB_ID'
);

-- Delete transactions for old jobs
DELETE FROM transactions
WHERE job_id IN (
  SELECT id FROM jobs
  WHERE org_id = ':ORG_ID' AND id != ':KEEP_JOB_ID'
);

-- Delete the old jobs themselves
DELETE FROM jobs
WHERE org_id = ':ORG_ID'
  AND id != ':KEEP_JOB_ID';

-- ⚠️  IMPORTANT: Review the changes before committing!
-- If everything looks good, run: COMMIT;
-- If something is wrong, run: ROLLBACK;

-- COMMIT;  -- Uncomment this line after review

-- ═══════════════════════════════════════════════════════════════════════════
-- STEP 4: Verify the cleanup (run after COMMIT)
-- ═══════════════════════════════════════════════════════════════════════════

-- Should show only 1 job remaining for your org
SELECT COUNT(*) as remaining_jobs
FROM jobs
WHERE org_id = ':ORG_ID';

-- Show the remaining job
SELECT 
  id, 
  job_number, 
  title, 
  created_at, 
  updated_at
FROM jobs
WHERE org_id = ':ORG_ID';

-- Verify no orphaned records exist
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

-- ═══════════════════════════════════════════════════════════════════════════
-- NOTES
-- ═══════════════════════════════════════════════════════════════════════════
--
-- How to use in Supabase SQL Editor:
-- 1. Go to your Supabase project → SQL Editor
-- 2. Create a new query
-- 3. Replace :ORG_ID with your actual organization UUID
-- 4. Run STEP 1 to find the newest job
-- 5. Copy the 'id' from the result
-- 6. Replace :KEEP_JOB_ID with that id
-- 7. Run STEP 2 queries to preview what will be deleted
-- 8. Review the preview carefully
-- 9. If everything looks correct, run STEP 3
-- 10. Before the final COMMIT, review what was deleted
-- 11. Uncomment the COMMIT line if satisfied, or run ROLLBACK if not
-- 12. Run STEP 4 to verify the cleanup
--
-- Alternative: Use the Node.js script instead
-- For a more user-friendly experience with better error handling and dry-run
-- mode, use the Node.js script:
--   pnpm run cleanup:old-deals
--
-- See scripts/README_CLEANUP_OLD_DEALS.md for detailed documentation.
--
-- ═══════════════════════════════════════════════════════════════════════════
