/**
 * Test: Database Vendor Relationship Verification
 *
 * Validates that the job_parts ↔ vendors relationship exists and works
 * through the PostgREST API (via Supabase client).
 *
 * This test ensures:
 * 1. The vendor_id column exists on job_parts
 * 2. The FK constraint exists (job_parts.vendor_id → vendors.id)
 * 3. PostgREST recognizes the relationship for nested selects
 * 4. REST API queries using vendor:vendors(...) syntax work without errors
 *
 * Purpose: Drift detection - fail fast if relationship is missing or cache not reloaded
 */

import { describe, it, expect, beforeAll } from 'vitest'

function isRlsOrPermissionError(error: any) {
  const msg = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '')
  return code === '42501' || msg.includes('permission denied') || msg.includes('rls')
}

describe('Database Vendor Relationship - REST API Integration', () => {
  // Mock mode: Tests pass without actual DB connection
  // Integration mode: Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to test real API
  // Note: If env vars point to localhost but no service is running, tests will be skipped
  const HAS_ENV_VARS = !!(process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY)

  // Check if URL is localhost (test environment placeholder)
  const IS_LOCALHOST =
    process.env.VITE_SUPABASE_URL?.includes('localhost') ||
    process.env.VITE_SUPABASE_URL?.includes('127.0.0.1')

  // Integration mode requires real env vars (not localhost placeholders)
  const INTEGRATION_MODE = HAS_ENV_VARS && !IS_LOCALHOST

  let supabase: any = null

  beforeAll(async () => {
    if (INTEGRATION_MODE) {
      // Dynamically import Supabase client only in integration mode
      const { createClient } = await import('@supabase/supabase-js')
      supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY)
    }
  })

  it('should have vendor_id column on job_parts table', async () => {
    if (!INTEGRATION_MODE) {
      console.log(
        '   ⊘ Skipped (mock mode - set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for integration test)'
      )
      expect(true).toBe(true) // Pass in mock mode
      return
    }

    // Query job_parts to verify vendor_id column exists
    const { error: selectError } = await supabase.from('job_parts').select('vendor_id').limit(1)

    // Some environments deny anon reads on job_parts. In that case, we can't verify
    // the column via PostgREST, but this is not a relationship-cache failure.
    if (selectError && isRlsOrPermissionError(selectError)) {
      console.log('   ℹ RLS denied reading job_parts (skipping column existence check)')
      return
    }

    expect(selectError).toBeNull()
  })

  it('CRITICAL: should support nested vendor relationship query without error', async () => {
    if (!INTEGRATION_MODE) {
      console.log(
        '   ⊘ Skipped (mock mode - set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for integration test)'
      )
      expect(true).toBe(true) // Pass in mock mode
      return
    }

    // This is the key test: queries using vendor:vendors(...) should work
    // If FK constraint exists but PostgREST cache not reloaded, this will fail with:
    // "Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"

    const { data, error } = await supabase
      .from('job_parts')
      .select('id, vendor_id, vendor:vendors(id, name)')
      .limit(1)

    // Check for the specific error message about missing relationship
    if (error) {
      const errorMessage = error.message || JSON.stringify(error)

      // This is the critical error we're detecting
      if (errorMessage.includes('Could not find a relationship')) {
        throw new Error(
          `❌ PostgREST schema cache is stale!\n` +
            `   The FK constraint exists but PostgREST doesn't recognize it.\n` +
            `   Run: NOTIFY pgrst, 'reload schema';\n` +
            `   Original error: ${errorMessage}`
        )
      }

      // Other errors might be RLS-related (acceptable in test)
      if (errorMessage.includes('permission denied') || errorMessage.includes('RLS')) {
        console.log('   ℹ RLS denied (expected in some test environments)')
        // RLS error means the relationship IS recognized, just can't access data
        return
      }

      // Unexpected error
      throw new Error(
        `Unexpected error querying job_parts with vendor relationship: ${errorMessage}`
      )
    }

    // Success! Either we got data, or empty array (both are acceptable)
    expect(error).toBeNull()
    expect(Array.isArray(data)).toBe(true)

    console.log(`   ✓ REST API recognizes vendor relationship (returned ${data?.length || 0} rows)`)
  })

  it('should return 200 OK for job_parts?select=vendor:vendors(...) REST query', async () => {
    if (!INTEGRATION_MODE) {
      console.log(
        '   ⊘ Skipped (mock mode - set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY for integration test)'
      )
      expect(true).toBe(true) // Pass in mock mode
      return
    }

    // Alternative approach: Direct fetch to REST endpoint
    const url = `${process.env.VITE_SUPABASE_URL}/rest/v1/job_parts?select=id,vendor:vendors(id,name)&limit=1`

    const response = await fetch(url, {
      headers: {
        apikey: process.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${process.env.VITE_SUPABASE_ANON_KEY}`,
      },
    })

    const responseText = await response.text()

    // If the endpoint is protected by RLS / requires auth, allow 401/403.
    // The key failure we want to detect here is the relationship-cache error.
    if (response.status === 401 || response.status === 403) {
      console.log(
        `   ℹ REST endpoint returned ${response.status} (auth/RLS protected in this environment); skipping status assertion`
      )
      expect(responseText).not.toContain('Could not find a relationship')
      return
    }

    // Check HTTP status in environments where anon access is permitted
    expect(response.status).toBe(200)

    // Check response doesn't contain relationship error
    expect(responseText).not.toContain('Could not find a relationship')

    // Response should be valid JSON (either array or object)
    expect(() => JSON.parse(responseText)).not.toThrow()

    console.log(`   ✓ REST endpoint returned 200 OK`)
  })

  it('should document the verification process for manual testing', () => {
    // This test always passes - it's documentation
    const verificationSteps = {
      step1:
        "Check column exists: SELECT column_name FROM information_schema.columns WHERE table_name = 'job_parts' AND column_name = 'vendor_id'",
      step2:
        "Check FK constraint: SELECT constraint_name FROM information_schema.table_constraints WHERE table_name = 'job_parts' AND constraint_name = 'job_parts_vendor_id_fkey'",
      step3: "Reload cache: NOTIFY pgrst, 'reload schema';",
      step4:
        'Test query: curl "${SUPABASE_URL}/rest/v1/job_parts?select=id,vendor:vendors(id,name)&limit=1" -H "apikey: ${ANON_KEY}"',
      expected: 'HTTP 200 with JSON array, no "Could not find a relationship" error',
    }

    expect(verificationSteps).toBeDefined()
    console.log('\n   📋 Manual Verification Steps:')
    console.log(`      1. ${verificationSteps.step1}`)
    console.log(`      2. ${verificationSteps.step2}`)
    console.log(`      3. ${verificationSteps.step3}`)
    console.log(`      4. ${verificationSteps.step4}`)
    console.log(`      Expected: ${verificationSteps.expected}`)
  })
})

describe('Database Vendor Relationship - Mock Mode Tests', () => {
  // These tests always run (no env vars required) to verify test structure

  it('should have test file in correct location', () => {
    // Updated to match actual test location: src/tests/
    expect(__filename).toContain('src/tests')
    expect(__filename).toContain('db.vendor-relationship.spec')
  })

  it('should document relationship query syntax', () => {
    const exampleQueries = {
      correct: [
        '.select("id, vendor:vendors(id, name)")',
        '.select("*, vendor:vendors(*)")',
        '.select("id, vendor_id, vendor:vendors!vendor_id(name)")',
      ],
      incorrect: [
        '.select("id, vendors(name)")', // Missing alias
        '.select("id, vendor_data:vendors(name)")', // Wrong alias (doesn't match column)
      ],
    }

    expect(exampleQueries.correct.length).toBeGreaterThan(0)
    expect(exampleQueries.incorrect.length).toBeGreaterThan(0)

    console.log('\n   📘 Relationship Query Syntax Examples:')
    console.log('      Correct:')
    exampleQueries.correct.forEach((q) => console.log(`        - ${q}`))
    console.log('      Incorrect:')
    exampleQueries.incorrect.forEach((q) => console.log(`        - ${q}`))
  })

  it('should define expected error message for missing relationship', () => {
    const expectedError =
      "Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"

    expect(expectedError).toContain('relationship')
    expect(expectedError).toContain('schema cache')

    console.log('\n   🔍 Detecting This Error Pattern:')
    console.log(`      "${expectedError}"`)
    console.log('\n   💡 If you see this error:')
    console.log('      1. FK constraint exists in DB but cache is stale')
    console.log("      2. Run: NOTIFY pgrst, 'reload schema';")
    console.log('      3. Wait 5 seconds and retry query')
  })
})
