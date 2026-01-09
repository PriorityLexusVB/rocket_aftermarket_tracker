#!/usr/bin/env node
// scripts/rlsPolicyAudit.js
// Read-only RLS policy audit: compares expected policies against MCP introspection artifacts

const fs = require('fs')
const path = require('path')

// Expected RLS policy names (from code and docs)
const EXPECTED_POLICIES = {
  jobs: ['select_jobs_by_org', 'insert_jobs_by_org', 'update_jobs_by_org', 'delete_jobs_by_org'],
  job_parts: [
    'select_job_parts_by_org',
    'insert_job_parts_by_org',
    'update_job_parts_by_org',
    'delete_job_parts_by_org',
  ],
  vendors: ['select_vendors_by_org', 'insert_vendors_by_org', 'update_vendors_by_org'],
  vehicles: [
    'select_vehicles_by_org',
    'insert_vehicles_by_org',
    'update_vehicles_by_org',
    'delete_vehicles_by_org',
  ],
  user_profiles: [
    'select_user_profiles_by_org',
    'insert_user_profiles',
    'update_user_profiles_by_org',
  ],
  loaner_assignments: [
    'select_loaner_assignments_by_org',
    'insert_loaner_assignments_by_org',
    'update_loaner_assignments_by_org',
    'delete_loaner_assignments_by_org',
  ],
}

function loadPoliciesFromArtifacts() {
  const artifactsDir = path.join(__dirname, '..', '.artifacts', 'mcp-introspect')
  const found = {}

  try {
    const files = fs.readdirSync(artifactsDir)
    for (const file of files) {
      if (file.startsWith('policies-') && file.endsWith('.json')) {
        const tableName = file.replace('policies-', '').replace('.json', '')
        const filePath = path.join(artifactsDir, file)
        const content = JSON.parse(fs.readFileSync(filePath, 'utf8'))

        if (content.expected_policies && Array.isArray(content.expected_policies)) {
          found[tableName] = content.expected_policies.map((p) => p.name)
        }
      }
    }
  } catch (error) {
    console.warn(`Warning: Could not read artifacts directory: ${error.message}`)
  }

  return found
}

function auditPolicies() {
  const foundPolicies = loadPoliciesFromArtifacts()
  const results = {
    timestamp: new Date().toISOString(),
    summary: {
      tablesChecked: 0,
      policiesExpected: 0,
      policiesFound: 0,
      missing: 0,
      extra: 0,
    },
    tables: {},
  }

  // Audit each table
  for (const [table, expectedNames] of Object.entries(EXPECTED_POLICIES)) {
    results.summary.tablesChecked++
    results.summary.policiesExpected += expectedNames.length

    const foundNames = foundPolicies[table] || []
    results.summary.policiesFound += foundNames.length

    const missing = expectedNames.filter((name) => !foundNames.includes(name))
    const extra = foundNames.filter((name) => !expectedNames.includes(name))

    results.summary.missing += missing.length
    results.summary.extra += extra.length

    results.tables[table] = {
      expected: expectedNames,
      found: foundNames,
      missing,
      extra,
      status: missing.length === 0 && extra.length === 0 ? 'ok' : 'drift',
    }
  }

  return results
}

function formatDiffOutput(results) {
  const lines = []
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('  RLS POLICY AUDIT REPORT')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push(`Timestamp: ${results.timestamp}`)
  lines.push('')
  lines.push('Summary:')
  lines.push(`  Tables checked:     ${results.summary.tablesChecked}`)
  lines.push(`  Policies expected:  ${results.summary.policiesExpected}`)
  lines.push(`  Policies found:     ${results.summary.policiesFound}`)
  lines.push(`  Missing:            ${results.summary.missing}`)
  lines.push(`  Extra:              ${results.summary.extra}`)
  lines.push('')
  lines.push('─────────────────────────────────────────────────────────────────')
  lines.push('')

  for (const [table, details] of Object.entries(results.tables)) {
    lines.push(`Table: ${table}`)
    lines.push(`  Status: ${details.status.toUpperCase()}`)

    if (details.missing.length > 0) {
      lines.push('  ⚠️  Missing policies:')
      details.missing.forEach((name) => {
        lines.push(`     - ${name}`)
      })
    }

    if (details.extra.length > 0) {
      lines.push('  ℹ️  Extra policies (not in expected list):')
      details.extra.forEach((name) => {
        lines.push(`     - ${name}`)
      })
    }

    if (details.status === 'ok') {
      lines.push('  ✅ All expected policies found')
    }

    lines.push('')
  }

  lines.push('─────────────────────────────────────────────────────────────────')
  lines.push('')
  lines.push('Note: This is a read-only audit comparing expected policy names')
  lines.push('      against MCP introspection artifacts. For live verification,')
  lines.push('      use Supabase MCP tools to query pg_policies directly.')
  lines.push('')
  lines.push('Next Steps:')
  lines.push('  1. Review missing policies and add if needed')
  lines.push('  2. Verify extra policies are intentional or remove if not')
  lines.push('  3. Run MCP introspection to get live policy data:')
  lines.push('     supabase-mcp list_policies --table=<table_name>')
  lines.push('')

  return lines.join('\n')
}

function main() {
  console.log('RLS Policy Audit - Read-only comparison')
  console.log('')

  const results = auditPolicies()
  const diffText = formatDiffOutput(results)

  // Write to artifacts
  const artifactsDir = path.join(__dirname, '..', '.artifacts')
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true })
  }

  const dateStr = new Date().toISOString().split('T')[0]
  const outputPath = path.join(artifactsDir, `rls-policy-audit-${dateStr}.txt`)

  fs.writeFileSync(outputPath, diffText, 'utf8')

  // Print to console
  console.log(diffText)
  console.log(`Report saved to: ${outputPath}`)

  // Exit with non-zero if there are issues
  if (results.summary.missing > 0 || results.summary.extra > 0) {
    console.log('')
    console.log('⚠️  Policy drift detected. Review the report above.')
    process.exit(1)
  } else {
    console.log('')
    console.log('✅ All policies match expected configuration.')
    process.exit(0)
  }
}

// Run if called directly
if (require.main === module) {
  main()
}

module.exports = { auditPolicies, formatDiffOutput }
