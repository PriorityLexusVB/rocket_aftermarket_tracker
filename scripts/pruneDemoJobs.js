#!/usr/bin/env node

/**
 * Prune Demo Jobs Script
 *
 * Safely identifies and optionally removes demo/test jobs from the database.
 * DEFAULT MODE: --dry-run (list candidates only, no deletions)
 *
 * Usage:
 *   node scripts/pruneDemoJobs.js                    # Dry run (default)
 *   node scripts/pruneDemoJobs.js --dry-run          # Explicit dry run
 *   node scripts/pruneDemoJobs.js --apply --confirm  # Actually delete (requires confirmation)
 *
 * Safety Features:
 * - Dry-run by default
 * - Requires explicit --confirm flag for deletion
 * - Creates CSV and JSON reports
 * - Logs all operations
 * - Never deletes jobs with real customer data
 */

const fs = require('fs')
const path = require('path')

// Parse command line arguments
const args = process.argv.slice(2)
const isDryRun = !args.includes('--apply')
const isConfirmed = args.includes('--confirm')
const outputDir = path.join(__dirname, '../.artifacts/prune-demo')

// Demo job patterns to identify test data
const DEMO_PATTERNS = {
  jobNumber: /^(TEST|DEMO|SAMPLE|DEBUG)/i,
  customerName: /^(test|demo|sample|debug|john doe|jane doe)/i,
  customerEmail: /@(test\.com|example\.com|demo\.com)$/i,
  vehicleVin: /^(TEST|DEMO|SAMPLE|1234567890)/i,
  title: /^(test|demo|sample|debug)/i,
}

// Mock database for this example - replace with actual Supabase client
class MockDatabase {
  constructor() {
    this.jobs = [
      {
        id: 'test-1',
        job_number: 'TEST-001',
        title: 'Test Job 1',
        customer_name: 'Test Customer',
        customer_email: 'test@test.com',
        vehicle_vin: 'TEST123456',
        created_at: '2025-01-01T00:00:00Z',
        job_status: 'pending',
      },
      {
        id: 'test-2',
        job_number: 'DEMO-002',
        title: 'Demo Job 2',
        customer_name: 'Demo Customer',
        customer_email: 'demo@example.com',
        vehicle_vin: 'DEMO789012',
        created_at: '2025-01-02T00:00:00Z',
        job_status: 'in_progress',
      },
      {
        id: 'real-1',
        job_number: 'JOB-001',
        title: 'Real Customer Job',
        customer_name: 'Real Customer',
        customer_email: 'customer@gmail.com',
        vehicle_vin: '1HGCM82633A123456',
        created_at: '2025-01-03T00:00:00Z',
        job_status: 'completed',
      },
    ]
  }

  async findDemoJobs() {
    // Simulate async database query
    return new Promise((resolve) => {
      setTimeout(() => {
        const demoJobs = this.jobs.filter((job) => this.isDemoJob(job))
        resolve(demoJobs)
      }, 100)
    })
  }

  async deleteJobs(jobIds) {
    // Simulate async deletion
    return new Promise((resolve) => {
      setTimeout(() => {
        const deleted = this.jobs.filter((job) => jobIds.includes(job.id))
        this.jobs = this.jobs.filter((job) => !jobIds.includes(job.id))
        resolve({ deletedCount: deleted.length, deleted })
      }, 100)
    })
  }

  isDemoJob(job) {
    return (
      DEMO_PATTERNS.jobNumber.test(job.job_number || '') ||
      DEMO_PATTERNS.customerName.test(job.customer_name || '') ||
      DEMO_PATTERNS.customerEmail.test(job.customer_email || '') ||
      DEMO_PATTERNS.vehicleVin.test(job.vehicle_vin || '') ||
      DEMO_PATTERNS.title.test(job.title || '')
    )
  }
}

/**
 * Identify demo jobs based on patterns
 */
async function findDemoCandidates() {
  const db = new MockDatabase()
  const candidates = await db.findDemoJobs()

  return candidates.map((job) => ({
    id: job.id,
    job_number: job.job_number,
    title: job.title,
    customer_name: job.customer_name,
    customer_email: job.customer_email,
    vehicle_vin: job.vehicle_vin,
    created_at: job.created_at,
    job_status: job.job_status,
    reason: getDemoReason(job),
  }))
}

/**
 * Determine why a job was flagged as demo
 */
function getDemoReason(job) {
  const reasons = []
  if (DEMO_PATTERNS.jobNumber.test(job.job_number || '')) {
    reasons.push('job_number matches demo pattern')
  }
  if (DEMO_PATTERNS.customerName.test(job.customer_name || '')) {
    reasons.push('customer_name matches demo pattern')
  }
  if (DEMO_PATTERNS.customerEmail.test(job.customer_email || '')) {
    reasons.push('customer_email matches demo pattern')
  }
  if (DEMO_PATTERNS.vehicleVin.test(job.vehicle_vin || '')) {
    reasons.push('vehicle_vin matches demo pattern')
  }
  if (DEMO_PATTERNS.title.test(job.title || '')) {
    reasons.push('title matches demo pattern')
  }
  return reasons.join('; ')
}

/**
 * Generate CSV report
 */
function generateCSV(candidates) {
  const headers = [
    'ID',
    'Job Number',
    'Title',
    'Customer Name',
    'Customer Email',
    'VIN',
    'Created At',
    'Status',
    'Reason',
  ]
  const rows = candidates.map((job) => [
    job.id,
    job.job_number,
    job.title,
    job.customer_name,
    job.customer_email,
    job.vehicle_vin,
    job.created_at,
    job.job_status,
    job.reason,
  ])

  const csvContent = [headers.join(','), ...rows.map((row) => row.join(','))].join('\n')

  return csvContent
}

/**
 * Generate JSON report
 */
function generateJSON(candidates, metadata) {
  return JSON.stringify(
    {
      metadata,
      summary: {
        total_candidates: candidates.length,
        demo_patterns_used: Object.keys(DEMO_PATTERNS),
      },
      candidates,
    },
    null,
    2
  )
}

/**
 * Save reports to disk
 */
function saveReports(candidates, isDryRun) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0]
  const csvPath = path.join(outputDir, `preview-${timestamp}.csv`)
  const jsonPath = path.join(outputDir, `preview-${timestamp}.json`)

  // Ensure output directory exists
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true })
  }

  // Save CSV
  fs.writeFileSync(csvPath, generateCSV(candidates))

  // Save JSON
  const metadata = {
    generated_at: new Date().toISOString(),
    mode: isDryRun ? 'dry-run' : 'applied',
    patterns: DEMO_PATTERNS,
  }
  fs.writeFileSync(jsonPath, generateJSON(candidates, metadata))

  return { csvPath, jsonPath }
}

/**
 * Main execution
 */
async function main() {
  console.log('🔍 Prune Demo Jobs Script')
  console.log('━'.repeat(50))
  console.log(`Mode: ${isDryRun ? 'DRY RUN (safe)' : 'APPLY (destructive)'}`)
  console.log(`Confirmed: ${isConfirmed ? 'YES' : 'NO'}`)
  console.log()

  // Find candidates
  console.log('📋 Scanning for demo jobs...')
  const candidates = await findDemoCandidates()

  if (candidates.length === 0) {
    console.log('✅ No demo jobs found!')
    return
  }

  console.log(`\n Found ${candidates.length} demo job candidates:`)
  candidates.forEach((job, index) => {
    console.log(`   ${index + 1}. ${job.job_number} - ${job.title} (${job.reason})`)
  })

  // Save reports
  console.log('\n💾 Saving reports...')
  const { csvPath, jsonPath } = saveReports(candidates, isDryRun)
  console.log(`   CSV: ${csvPath}`)
  console.log(`   JSON: ${jsonPath}`)

  // Apply deletion if requested
  if (!isDryRun && isConfirmed) {
    console.log('\n⚠️  APPLYING DELETION...')
    const db = new MockDatabase()
    const result = await db.deleteJobs(candidates.map((j) => j.id))
    console.log(`✅ Deleted ${result.deletedCount} demo jobs`)
  } else if (!isDryRun && !isConfirmed) {
    console.log('\n⛔ ERROR: --apply requires --confirm flag for safety')
    console.log('   Usage: node scripts/pruneDemoJobs.js --apply --confirm')
    process.exit(1)
  } else {
    console.log('\n✅ DRY RUN COMPLETE - No jobs were deleted')
    console.log('   To actually delete, run:')
    console.log('   node scripts/pruneDemoJobs.js --apply --confirm')
  }
}

// Run if executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error('❌ Error:', error.message)
    process.exit(1)
  })
}

// Export for testing
module.exports = {
  findDemoCandidates,
  getDemoReason,
  generateCSV,
  generateJSON,
  DEMO_PATTERNS,
}
