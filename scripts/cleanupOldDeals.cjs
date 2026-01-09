#!/usr/bin/env node
/**
 * Cleanup Old Deals Script
 *
 * ONE-OFF MAINTENANCE SCRIPT - NOT FOR REGULAR APP FLOW
 *
 * Purpose: Delete ALL existing deals (jobs + related data) except for the
 * single newest one for a specific organization in Supabase.
 *
 * This script:
 * - Finds the newest job for your org (by created_at, fallback to updated_at)
 * - Keeps that one job
 * - Deletes all other jobs for that org along with related data in:
 *   - job_parts (by job_id)
 *   - loaner_assignments (by job_id)
 *   - transactions (by job_id)
 *
 * Safety features:
 * - DRY_RUN mode (default: true) - no actual deletions until explicitly disabled
 * - Org-scoped - only touches jobs for specified org_id
 * - Defensive checks - exits if 0 or 1 jobs found
 * - Error handling with non-zero exit codes
 *
 * Usage:
 *   DRY_RUN=true node scripts/cleanupOldDeals.cjs   # Preview mode (default)
 *   DRY_RUN=false node scripts/cleanupOldDeals.cjs  # Actually delete
 *
 * Environment variables required:
 *   SUPABASE_URL or VITE_SUPABASE_URL - Your Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY - Service role key (NOT anon key)
 *   ORG_ID - The UUID of the organization to clean up
 *
 * ⚠️  WARNING ⚠️
 * This is a DESTRUCTIVE operation. Always:
 * 1. Backup your database first
 * 2. Run in DRY_RUN mode first
 * 3. Verify the output carefully
 * 4. Only run with DRY_RUN=false after confirming the preview
 * 5. This should NOT be used in normal application flow
 * 6. This is a ONE-OFF maintenance script
 */

const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { createClient } = require('@supabase/supabase-js')

// Load environment variables from .env and .env.local
const root = process.cwd()
const envPath = path.join(root, '.env')
const envLocalPath = path.join(root, '.env.local')
if (fs.existsSync(envPath)) dotenv.config({ path: envPath })
if (fs.existsSync(envLocalPath)) dotenv.config({ path: envLocalPath, override: true })

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const ORG_ID = process.env.ORG_ID
const DRY_RUN = process.env.DRY_RUN !== 'false' // Default to true for safety

// Validate required environment variables
function validateConfig() {
  const errors = []

  if (!SUPABASE_URL) {
    errors.push('Missing SUPABASE_URL or VITE_SUPABASE_URL in environment')
  }

  if (!SERVICE_KEY) {
    errors.push('Missing SUPABASE_SERVICE_ROLE_KEY in environment')
  }

  if (!ORG_ID) {
    errors.push('Missing ORG_ID in environment')
  }

  // Validate ORG_ID is a valid UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  if (ORG_ID && !uuidRegex.test(ORG_ID)) {
    errors.push('ORG_ID must be a valid UUID')
  }

  if (errors.length > 0) {
    console.error('❌ Configuration errors:')
    errors.forEach((err) => console.error(`   ${err}`))
    console.error('\nPlease set the required environment variables.')
    console.error('Example:')
    console.error('  export SUPABASE_URL="https://xxx.supabase.co"')
    console.error('  export SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"')
    console.error('  export ORG_ID="your-org-uuid"')
    console.error('  DRY_RUN=true node scripts/cleanupOldDeals.cjs')
    return false
  }

  return true
}

// Main cleanup function
async function cleanupOldDeals() {
  console.log('═══════════════════════════════════════════════════════════')
  console.log('  Cleanup Old Deals Script')
  console.log('═══════════════════════════════════════════════════════════')
  console.log()

  // Validate configuration
  if (!validateConfig()) {
    process.exit(1)
  }

  // Display configuration
  console.log('Configuration:')
  console.log(`  Supabase URL: ${SUPABASE_URL}`)
  console.log(`  Organization ID: ${ORG_ID}`)
  console.log(
    `  Mode: ${DRY_RUN ? '🔍 DRY RUN (preview only)' : '⚠️  LIVE MODE (will delete data)'}`
  )
  console.log()

  if (!DRY_RUN) {
    console.log('⚠️  ⚠️  ⚠️  WARNING ⚠️  ⚠️  ⚠️')
    console.log('This will PERMANENTLY DELETE data from your database!')
    console.log('Press Ctrl+C now to cancel...')
    console.log()
    // Give user 3 seconds to cancel
    await new Promise((resolve) => setTimeout(resolve, 3000))
  }

  // Create Supabase admin client
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  try {
    // Step 1: Query all jobs for the org, ordered by created_at DESC (newest first)
    console.log('Step 1: Querying jobs for organization...')
    const { data: jobs, error: jobsError } = await supabase
      .from('jobs')
      .select('id, job_number, title, created_at, updated_at')
      .eq('org_id', ORG_ID)
      .order('created_at', { ascending: false, nullsFirst: false })
      .order('updated_at', { ascending: false, nullsFirst: false })

    if (jobsError) {
      console.error('❌ Error querying jobs:', jobsError.message)
      process.exit(1)
    }

    console.log(`   Found ${jobs.length} job(s) for this organization`)
    console.log()

    // Step 2: Check if we have enough jobs to proceed
    if (jobs.length === 0) {
      console.log('ℹ️  No jobs found for this organization. Nothing to delete.')
      process.exit(0)
    }

    if (jobs.length === 1) {
      console.log('ℹ️  Only one job found for this organization. Nothing to delete.')
      console.log(`   Existing job: ${jobs[0].job_number} - ${jobs[0].title}`)
      console.log(`   Created: ${jobs[0].created_at}`)
      process.exit(0)
    }

    // Step 3: Identify the job to keep and jobs to delete
    const keepJob = jobs[0]
    const deleteJobs = jobs.slice(1)
    const deleteJobIds = deleteJobs.map((j) => j.id)

    console.log('═══════════════════════════════════════════════════════════')
    console.log('Step 2: Jobs Summary')
    console.log('═══════════════════════════════════════════════════════════')
    console.log()
    console.log('✅ Job to KEEP:')
    console.log(`   ID: ${keepJob.id}`)
    console.log(`   Number: ${keepJob.job_number}`)
    console.log(`   Title: ${keepJob.title}`)
    console.log(`   Created: ${keepJob.created_at}`)
    console.log(`   Updated: ${keepJob.updated_at}`)
    console.log()
    console.log(`🗑️  Jobs to DELETE: ${deleteJobs.length}`)
    deleteJobs.forEach((job, idx) => {
      console.log(`   ${idx + 1}. ${job.job_number} - ${job.title}`)
      console.log(`      Created: ${job.created_at}`)
    })
    console.log()

    // Step 4: Count related records that will be deleted
    console.log('═══════════════════════════════════════════════════════════')
    console.log('Step 3: Related Records Summary')
    console.log('═══════════════════════════════════════════════════════════')
    console.log()

    // Count job_parts
    const { count: jobPartsCount, error: jobPartsCountError } = await supabase
      .from('job_parts')
      .select('*', { count: 'exact', head: true })
      .in('job_id', deleteJobIds)

    if (jobPartsCountError) {
      console.error('❌ Error counting job_parts:', jobPartsCountError.message)
      process.exit(1)
    }

    // Count loaner_assignments
    const { count: loanerCount, error: loanerCountError } = await supabase
      .from('loaner_assignments')
      .select('*', { count: 'exact', head: true })
      .in('job_id', deleteJobIds)

    if (loanerCountError) {
      console.error('❌ Error counting loaner_assignments:', loanerCountError.message)
      process.exit(1)
    }

    // Count transactions
    const { count: transactionsCount, error: transactionsCountError } = await supabase
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .in('job_id', deleteJobIds)

    if (transactionsCountError) {
      console.error('❌ Error counting transactions:', transactionsCountError.message)
      process.exit(1)
    }

    console.log(`   job_parts: ${jobPartsCount || 0} records`)
    console.log(`   loaner_assignments: ${loanerCount || 0} records`)
    console.log(`   transactions: ${transactionsCount || 0} records`)
    console.log(`   jobs: ${deleteJobs.length} records`)
    console.log()

    // If in dry run mode, stop here
    if (DRY_RUN) {
      console.log('═══════════════════════════════════════════════════════════')
      console.log('🔍 DRY RUN MODE - No data was deleted')
      console.log('═══════════════════════════════════════════════════════════')
      console.log()
      console.log('To actually perform the deletion, run:')
      console.log('  DRY_RUN=false node scripts/cleanupOldDeals.cjs')
      console.log()
      console.log('⚠️  Make sure to backup your database first!')
      process.exit(0)
    }

    // Step 5: Perform deletions
    // NOTE: Supabase JS client doesn't support explicit transactions.
    // If a deletion fails mid-process, you may end up with partial deletions.
    // For transactional guarantees, use the SQL version (scripts/sql/cleanup_old_deals.sql).
    // Each deletion is validated separately; errors will stop execution immediately.
    console.log('═══════════════════════════════════════════════════════════')
    console.log('Step 4: Performing Deletions')
    console.log('═══════════════════════════════════════════════════════════')
    console.log()

    let deletionResults = {
      job_parts: 0,
      loaner_assignments: 0,
      transactions: 0,
      jobs: 0,
    }

    // NOTE: Deletion counts below reflect the count of records found before deletion.
    // If data changes between count and delete (rare), actual deleted counts may differ.
    // The Supabase JS client doesn't return affected row counts by default.

    // Delete job_parts
    console.log('Deleting job_parts...')
    const { error: deleteJobPartsError } = await supabase
      .from('job_parts')
      .delete()
      .in('job_id', deleteJobIds)

    if (deleteJobPartsError) {
      console.error('❌ Error deleting job_parts:', deleteJobPartsError.message)
      process.exit(1)
    }
    deletionResults.job_parts = jobPartsCount || 0
    console.log(`   ✅ Deleted ${deletionResults.job_parts} job_parts records (pre-count)`)

    // Delete loaner_assignments
    console.log('Deleting loaner_assignments...')
    const { error: deleteLoanerError } = await supabase
      .from('loaner_assignments')
      .delete()
      .in('job_id', deleteJobIds)

    if (deleteLoanerError) {
      console.error('❌ Error deleting loaner_assignments:', deleteLoanerError.message)
      process.exit(1)
    }
    deletionResults.loaner_assignments = loanerCount || 0
    console.log(
      `   ✅ Deleted ${deletionResults.loaner_assignments} loaner_assignments records (pre-count)`
    )

    // Delete transactions
    console.log('Deleting transactions...')
    const { error: deleteTransactionsError } = await supabase
      .from('transactions')
      .delete()
      .in('job_id', deleteJobIds)

    if (deleteTransactionsError) {
      console.error('❌ Error deleting transactions:', deleteTransactionsError.message)
      process.exit(1)
    }
    deletionResults.transactions = transactionsCount || 0
    console.log(`   ✅ Deleted ${deletionResults.transactions} transactions records (pre-count)`)

    // Finally, delete the jobs themselves
    console.log('Deleting jobs...')
    const { error: deleteJobsError } = await supabase
      .from('jobs')
      .delete()
      .in('id', deleteJobIds)
      .eq('org_id', ORG_ID) // Extra safety: ensure we only delete from our org

    if (deleteJobsError) {
      console.error('❌ Error deleting jobs:', deleteJobsError.message)
      process.exit(1)
    }
    deletionResults.jobs = deleteJobs.length
    console.log(`   ✅ Deleted ${deletionResults.jobs} jobs records`)
    console.log()

    // Step 6: Summary
    console.log('═══════════════════════════════════════════════════════════')
    console.log('✅ Cleanup Complete')
    console.log('═══════════════════════════════════════════════════════════')
    console.log()
    console.log('Records deleted:')
    console.log(`   job_parts: ${deletionResults.job_parts}`)
    console.log(`   loaner_assignments: ${deletionResults.loaner_assignments}`)
    console.log(`   transactions: ${deletionResults.transactions}`)
    console.log(`   jobs: ${deletionResults.jobs}`)
    console.log()
    console.log('Remaining job:')
    console.log(`   ${keepJob.job_number} - ${keepJob.title}`)
    console.log(`   Created: ${keepJob.created_at}`)
    console.log()
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    console.error(error)
    process.exit(1)
  }
}

// Run the script
cleanupOldDeals()

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠️  IMPORTANT WARNINGS AND NOTES ⚠️
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * 1. THIS IS A ONE-OFF MAINTENANCE SCRIPT
 *    - Not intended for regular application flow
 *    - Should only be run when you need to clean up old test/development data
 *
 * 2. ALWAYS BACKUP YOUR DATABASE FIRST
 *    - This script performs PERMANENT DELETIONS
 *    - There is no "undo" button
 *    - Make sure you have a recent backup before running
 *
 * 3. ALWAYS RUN IN DRY_RUN MODE FIRST
 *    - Review the output carefully
 *    - Verify that the correct job is being kept
 *    - Check the counts of records to be deleted
 *
 * 4. ORG-SCOPED OPERATIONS
 *    - This script only touches data for the specified ORG_ID
 *    - Other organizations' data is never affected
 *    - The script includes additional org_id checks for safety
 *
 * 5. RELATED DATA CLEANUP
 *    - The script handles all related tables:
 *      * job_parts (parts used in jobs)
 *      * loaner_assignments (loaner vehicles)
 *      * transactions (financial transactions)
 *    - All related records are deleted before the parent job
 *
 * 6. ERROR HANDLING
 *    - Any errors during deletion will stop the script
 *    - The script exits with non-zero code on errors
 *    - Check the console output for detailed error messages
 *
 * 7. WHAT GETS KEPT
 *    - The NEWEST job (by created_at timestamp)
 *    - If created_at is null, falls back to updated_at
 *    - All related records for the kept job remain intact
 *
 * 8. WHEN TO USE THIS SCRIPT
 *    - Cleaning up after development/testing
 *    - Removing accidentally created duplicate jobs
 *    - Resetting a test environment
 *    - One-time data maintenance
 *
 * 9. WHEN NOT TO USE THIS SCRIPT
 *    - As part of normal application flow
 *    - In automated processes/cron jobs
 *    - Without reviewing the dry-run output first
 *    - Without a database backup
 *
 * 10. ALTERNATIVE: SQL VERSION
 *     - See the bottom of this file for a SQL version
 *     - Can be run directly in Supabase SQL editor
 *     - Wrapped in a transaction for safety
 *     - Requires manual parameter replacement
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

/*
 * ═══════════════════════════════════════════════════════════════════════════
 * SQL VERSION - For Supabase SQL Editor
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Replace the following placeholders before running:
 *   :ORG_ID - Your organization UUID (e.g., 550e8400-e29b-41d4-a716-446655440000)
 *   :KEEP_JOB_ID - The ID of the job to keep (run the SELECT query first)
 *
 * -- STEP 1: Find the newest job for your org (run this first)
 * SELECT
 *   id,
 *   job_number,
 *   title,
 *   created_at,
 *   updated_at,
 *   org_id
 * FROM jobs
 * WHERE org_id = :ORG_ID
 * ORDER BY created_at DESC NULLS LAST, updated_at DESC NULLS LAST
 * LIMIT 1;
 *
 * -- STEP 2: Preview what will be deleted (run this second)
 * -- Count jobs to delete
 * SELECT COUNT(*) as jobs_to_delete
 * FROM jobs
 * WHERE org_id = :ORG_ID
 *   AND id != :KEEP_JOB_ID;
 *
 * -- Preview jobs to delete
 * SELECT id, job_number, title, created_at
 * FROM jobs
 * WHERE org_id = :ORG_ID
 *   AND id != :KEEP_JOB_ID
 * ORDER BY created_at DESC;
 *
 * -- Count related records
 * SELECT
 *   'job_parts' as table_name,
 *   COUNT(*) as records_to_delete
 * FROM job_parts
 * WHERE job_id IN (
 *   SELECT id FROM jobs
 *   WHERE org_id = :ORG_ID AND id != :KEEP_JOB_ID
 * )
 * UNION ALL
 * SELECT
 *   'loaner_assignments' as table_name,
 *   COUNT(*) as records_to_delete
 * FROM loaner_assignments
 * WHERE job_id IN (
 *   SELECT id FROM jobs
 *   WHERE org_id = :ORG_ID AND id != :KEEP_JOB_ID
 * )
 * UNION ALL
 * SELECT
 *   'transactions' as table_name,
 *   COUNT(*) as records_to_delete
 * FROM transactions
 * WHERE job_id IN (
 *   SELECT id FROM jobs
 *   WHERE org_id = :ORG_ID AND id != :KEEP_JOB_ID
 * );
 *
 * -- STEP 3: Perform the deletion (ONLY after reviewing preview)
 * -- ⚠️ WARNING: This will PERMANENTLY delete data! ⚠️
 * BEGIN;
 *
 * -- Delete job_parts for old jobs
 * DELETE FROM job_parts
 * WHERE job_id IN (
 *   SELECT id FROM jobs
 *   WHERE org_id = :ORG_ID AND id != :KEEP_JOB_ID
 * );
 *
 * -- Delete loaner_assignments for old jobs
 * DELETE FROM loaner_assignments
 * WHERE job_id IN (
 *   SELECT id FROM jobs
 *   WHERE org_id = :ORG_ID AND id != :KEEP_JOB_ID
 * );
 *
 * -- Delete transactions for old jobs
 * DELETE FROM transactions
 * WHERE job_id IN (
 *   SELECT id FROM jobs
 *   WHERE org_id = :ORG_ID AND id != :KEEP_JOB_ID
 *
 * -- Delete the old jobs themselves
 * DELETE FROM jobs
 * WHERE org_id = :ORG_ID
 *   AND id != :KEEP_JOB_ID;
 *
 * -- Review the changes before committing
 * -- If everything looks good, run: COMMIT;
 * -- If something is wrong, run: ROLLBACK;
 *
 * COMMIT;
 *
 * -- STEP 4: Verify the cleanup
 * -- Should show only 1 job remaining for your org
 * SELECT COUNT(*) as remaining_jobs
 * FROM jobs
 * WHERE org_id = :ORG_ID;
 *
 * -- Show the remaining job
 * SELECT id, job_number, title, created_at, updated_at
 * FROM jobs
 * WHERE org_id = :ORG_ID;
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */
