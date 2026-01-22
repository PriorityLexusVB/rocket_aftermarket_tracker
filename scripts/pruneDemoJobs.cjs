#!/usr/bin/env node
/**
 * Prune Demo Jobs Script
 *
 * Safety-first utility to identify and optionally remove demo/test jobs from the database.
 *
 * Usage:
 *   node scripts/pruneDemoJobs.cjs                   # Dry-run mode (default)
 *   node scripts/pruneDemoJobs.cjs --help            # Show help
 *
 * Guardrails:
 *   - Dry-run is the default mode (no destructive operations)
 *   - Exports candidate list to CSV ledger
 *   - Never performs deletions (use the SQL/maintenance cleanup scripts for that)
 */

const fs = require('fs')
const path = require('path')

// Parse command line arguments
const args = process.argv.slice(2)
const requestedApply = args.includes('--apply')
const showHelp = args.includes('--help') || args.includes('-h')
const orgIdArg = args.find((arg) => arg.startsWith('--org-id='))
const orgId = orgIdArg ? orgIdArg.split('=')[1] : null

// Help text
if (showHelp) {
  console.log(`
Prune Demo Jobs Script

Usage:
  node scripts/pruneDemoJobs.cjs [options]

Options:
  --help, -h              Show this help message
  --org-id=<id>           Filter by organization ID (optional)

Examples:
  node scripts/pruneDemoJobs.cjs
    # Dry-run: List demo jobs without deleting
  
  node scripts/pruneDemoJobs.cjs --org-id=abc123
    # Dry-run for specific org

Safety Features:
  - Dry-run is the default mode
  - Exports CSV before deletion
  - Never deletes data (use cleanup scripts / SQL for that)
`)
  process.exit(0)
}

if (requestedApply) {
  console.error('ERROR: This script is non-destructive and does not support --apply.')
  console.error('It only identifies candidates and exports a CSV ledger.')
  console.error('')
  console.error('If you need to delete data, use:')
  console.error('  - scripts/cleanupOldDeals.cjs (org-scoped, dry-run default)')
  console.error('  - scripts/sql/* (transactional deletes in SQL editor)')
  process.exit(2)
}

/**
 * Identify demo/test jobs based on patterns
 * @param {Array} jobs - Array of job objects from database
 * @returns {Array} Array of demo job IDs
 */
function identifyDemoJobs(jobs) {
  const demoPatterns = [
    /test/i,
    /demo/i,
    /example/i,
    /sample/i,
    /dummy/i,
    /@test\.com$/i,
    /@example\.com$/i,
  ]

  return jobs.filter((job) => {
    // Check job number
    if (job.job_number && demoPatterns.some((p) => p.test(job.job_number))) {
      return true
    }

    // Check customer name
    if (job.customer_name && demoPatterns.some((p) => p.test(job.customer_name))) {
      return true
    }

    // Check customer email
    if (job.customer_email && demoPatterns.some((p) => p.test(job.customer_email))) {
      return true
    }

    // Check title
    if (job.title && demoPatterns.some((p) => p.test(job.title))) {
      return true
    }

    return false
  })
}

/**
 * Export candidates to CSV
 * @param {Array} candidates - Array of demo job objects
 * @param {string} filepath - Output CSV file path
 */
function exportToCSV(candidates, filepath) {
  const header = 'id,job_number,customer_name,customer_email,title,created_at\n'
  const rows = candidates.map((job) => {
    return [
      job.id,
      job.job_number || '',
      job.customer_name || '',
      job.customer_email || '',
      job.title || '',
      job.created_at || '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(',')
  })

  const csv = header + rows.join('\n')
  fs.writeFileSync(filepath, csv, 'utf8')
  console.log(`✓ Exported candidate list to: ${filepath}`)
}

/**
 * Main execution
 */
async function main() {
  console.log('\n=== Prune Demo Jobs ===\n')
  console.log('Mode: DRY-RUN (safe)')
  if (orgId) {
    console.log(`Org ID: ${orgId}`)
  }
  console.log('')

  // Mock data for demonstration
  // In production, this would connect to Supabase and fetch actual jobs
  const mockJobs = [
    {
      id: 'demo-1',
      job_number: 'TEST-001',
      customer_name: 'Test Customer',
      customer_email: 'test@example.com',
      title: 'Demo Job 1',
      created_at: '2025-01-01T00:00:00Z',
    },
    {
      id: 'real-1',
      job_number: 'JOB-001',
      customer_name: 'John Doe',
      customer_email: 'john@realdomain.com',
      title: 'Real Job',
      created_at: '2025-01-02T00:00:00Z',
    },
    {
      id: 'demo-2',
      job_number: 'SAMPLE-002',
      customer_name: 'Sample Data',
      customer_email: 'sample@test.com',
      title: 'Example Job',
      created_at: '2025-01-01T00:00:00Z',
    },
  ]

  console.log(`Total jobs: ${mockJobs.length}`)

  // Identify candidates
  const candidates = identifyDemoJobs(mockJobs)
  console.log(`Demo job candidates: ${candidates.length}`)
  console.log('')

  if (candidates.length === 0) {
    console.log('✓ No demo jobs found. Database is clean.')
    return
  }

  // Show sample
  console.log('Sample candidates (first 5):')
  candidates.slice(0, 5).forEach((job) => {
    console.log(`  - ${job.job_number || job.id}: ${job.customer_name}`)
  })
  console.log('')

  // Export to CSV
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const csvPath = path.join(__dirname, '..', '.artifacts', `demo-jobs-${timestamp}.csv`)

  // Ensure .artifacts directory exists
  const artifactsDir = path.join(__dirname, '..', '.artifacts')
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true })
  }

  exportToCSV(candidates, csvPath)

  console.log('\n✓ DRY-RUN complete. No changes made.')
  console.log(`Ledger CSV: ${csvPath}`)
}

// Run
main().catch((err) => {
  console.error('ERROR:', err.message)
  process.exit(1)
})
