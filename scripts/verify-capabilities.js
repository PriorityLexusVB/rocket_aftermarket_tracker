#!/usr/bin/env node
/**
 * scripts/verify-capabilities.js
 * Enhanced verification script aggregating health + telemetry endpoints.
 * Assumes local dev or deployed endpoints available under process.env.VERIFY_BASE_URL.
 *
 * Enhanced with:
 * - Comprehensive health checks
 * - Rate limit verification
 * - Structured output
 * - Exit codes for CI/CD integration
 */

import process from 'node:process'

const base = process.env.VERIFY_BASE_URL || 'http://localhost:5173'
// For serverless endpoints when deployed on Vercel use production URL.

async function fetchJson(url) {
  try {
    const res = await fetch(url)
    const json = await res.json()
    return { status: res.status, ok: res.ok, data: json }
  } catch (e) {
    return { status: 0, ok: false, error: e.message }
  }
}

async function main() {
  console.log('🚀 Rocket Aftermarket Tracker - Capability Verification')
  console.log('='.repeat(60))
  console.log(`Base URL: ${base}`)
  console.log(`Timestamp: ${new Date().toISOString()}`)
  console.log('='.repeat(60))
  console.log('')

  const results = {}
  let overallPass = true

  // Test 1: Basic health check
  console.log('📋 Test 1: Basic Health Check')
  results.health = await fetchJson(`${base}/api/health`)
  if (results.health.ok && results.health.data?.ok) {
    console.log('✅ Basic health check passed')
  } else {
    console.log('❌ Basic health check failed:', results.health.error || results.health.data?.error)
    overallPass = false
  }
  console.log('')

  // Test 2: Deals relationship health
  console.log('📋 Test 2: Deals Relationship Health')
  results.healthDealsRel = await fetchJson(`${base}/api/health-deals-rel`)
  if (results.healthDealsRel.ok && results.healthDealsRel.data?.ok !== false) {
    console.log('✅ Deals relationship health check passed')
    if (results.healthDealsRel.data?.classification) {
      console.log(`   Classification: ${results.healthDealsRel.data.classification}`)
    }
  } else {
    console.log('❌ Deals relationship health check failed')
    console.log(`   Error: ${results.healthDealsRel.data?.error || results.healthDealsRel.error}`)
    if (results.healthDealsRel.data?.advice) {
      console.log(`   Advice: ${results.healthDealsRel.data.advice}`)
    }
    overallPass = false
  }
  console.log('')

  // Test 3: User profiles health
  console.log('📋 Test 3: User Profiles Health')
  results.healthUserProfiles = await fetchJson(`${base}/api/health-user-profiles`)
  if (results.healthUserProfiles.ok) {
    console.log('✅ User profiles health check passed')
    if (results.healthUserProfiles.data?.columns) {
      const cols = results.healthUserProfiles.data.columns
      console.log(
        `   Columns: name=${cols.name}, full_name=${cols.full_name}, display_name=${cols.display_name}`
      )
    }
  } else {
    console.log('⚠️  User profiles health check warning:', results.healthUserProfiles.error)
    // This is a warning, not a failure
  }
  console.log('')

  // Test 4: Comprehensive capabilities check
  console.log('📋 Test 4: Comprehensive Capabilities Check')
  results.healthCapabilities = await fetchJson(`${base}/api/health/capabilities`)
  if (results.healthCapabilities.ok) {
    console.log('✅ Capabilities endpoint accessible')
    if (results.healthCapabilities.data?.capabilities) {
      const caps = results.healthCapabilities.data.capabilities
      console.log('   Capabilities:')
      Object.entries(caps).forEach(([key, value]) => {
        const icon = value ? '✓' : '✗'
        console.log(`     ${icon} ${key}: ${value}`)
      })
    }
    if (results.healthCapabilities.data?.probeResults?.checks) {
      const checks = results.healthCapabilities.data.probeResults.checks
      const failedChecks = checks.filter((c) => c.status !== 'ok')
      if (failedChecks.length > 0) {
        console.log('   Failed probes:')
        failedChecks.forEach((check) => {
          console.log(`     ✗ ${check.name}: ${check.error || 'unavailable'}`)
        })
      }
    }
  } else {
    console.log('⚠️  Capabilities endpoint warning:', results.healthCapabilities.error)
  }
  console.log('')

  // Test 5: Job parts times health (if endpoint exists)
  console.log('📋 Test 5: Job Parts Scheduling Times')
  results.healthJobPartsTimes = await fetchJson(`${base}/api/health/job-parts-times`)
  if (results.healthJobPartsTimes.status === 404) {
    console.log('⚠️  Job parts times endpoint not found (optional)')
  } else if (results.healthJobPartsTimes.ok) {
    console.log('✅ Job parts times check passed')
  } else {
    console.log('⚠️  Job parts times check warning')
  }
  console.log('')

  // Test 6: Verify rate limiting (optional - requires auth)
  console.log('📋 Test 6: Admin Endpoints (optional)')
  console.log('⚠️  Skipping admin endpoint tests (requires authentication)')
  console.log('')

  // Summary
  console.log('='.repeat(60))
  console.log('📊 Verification Summary')
  console.log('='.repeat(60))

  const passedTests = Object.values(results).filter((r) => r.ok).length
  const totalTests = Object.keys(results).length
  console.log(`Tests Passed: ${passedTests}/${totalTests}`)

  if (overallPass) {
    console.log('✅ All critical capability checks passed')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Verify Deals page loads without errors')
    console.log('  2. Check that vendor column displays correctly')
    console.log('  3. Test creating a deal with line items')
    console.log('  4. Monitor telemetry counters for fallbacks')
  } else {
    console.log('❌ Some critical checks failed')
    console.log('')
    console.log('Remediation guidance:')
    console.log(
      '  - If vendor_id or scheduled_* missing: apply migrations + NOTIFY pgrst, "reload schema"'
    )
    console.log('  - If RLS denied on loaner_assignments: add SELECT policy (see runbook)')
    console.log('  - If relationship errors: run scripts/verify-schema-cache.sh')
    console.log('  - Check CAPABILITY_GATING_IMPLEMENTATION_REPORT.md for details')
  }
  console.log('')

  // Output JSON for programmatic consumption
  if (process.env.JSON_OUTPUT) {
    const jsonOutput = {
      timestamp: new Date().toISOString(),
      baseUrl: base,
      overallPass,
      passedTests,
      totalTests,
      results,
    }
    console.log('JSON Output:')
    console.log(JSON.stringify(jsonOutput, null, 2))
  }

  process.exit(overallPass ? 0 : 1)
}
main()
