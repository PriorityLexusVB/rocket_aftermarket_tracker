// /api/health/deals-rel (server route)
// Health check endpoint to verify vendor relationship integrity
import { supabase } from '@/lib/supabase'
import { getRemediationGuidance } from '@/utils/schemaErrorClassifier'

export default async function handler(req, res) {
  const timestamp = new Date().toISOString()
  const details = {
    checks: [],
    timestamp,
  }

  try {
    // Test 1: Basic Supabase connectivity
    const { error: pingError } = await supabase.from('vendors').select('id').limit(1)

    if (pingError) {
      details.checks.push({
        name: 'supabase_connectivity',
        status: 'fail',
        error: pingError.message,
      })
      return res.status(503).json({
        vendorRelationship: 'degraded',
        timestamp,
        details,
      })
    }

    details.checks.push({
      name: 'supabase_connectivity',
      status: 'ok',
    })

    // Test 2: Check vendor_id column exists in job_parts
    const { data: vendorIdTest, error: vendorIdError } = await supabase
      .from('job_parts')
      .select('id, vendor_id')
      .limit(1)

    if (vendorIdError) {
      const isMissingColumn = /column .* does not exist/i.test(vendorIdError.message)
      const guidance = getRemediationGuidance(vendorIdError)

      details.checks.push({
        name: 'job_parts_vendor_id_column',
        status: 'fail',
        error: vendorIdError.message,
        isMissingColumn,
        remediation: guidance,
      })

      return res.status(503).json({
        vendorRelationship: 'missing_column',
        timestamp,
        details,
      })
    }

    details.checks.push({
      name: 'job_parts_vendor_id_column',
      status: 'ok',
    })

    // Test 3: Verify job_parts -> vendors relationship via REST API
    const { data: relationshipTest, error: relError } = await supabase
      .from('job_parts')
      .select('id, vendor:vendors(id, name)')
      .limit(1)

    if (relError) {
      const isRelationshipError =
        /Could not find a relationship between .* in the schema cache/i.test(relError.message)
      const guidance = getRemediationGuidance(relError)

      details.checks.push({
        name: 'job_parts_vendor_relationship',
        status: 'fail',
        error: relError.message,
        isRelationshipError,
        remediation: guidance,
      })

      return res.status(503).json({
        vendorRelationship: 'fail',
        timestamp,
        details,
      })
    }

    details.checks.push({
      name: 'job_parts_vendor_relationship',
      status: 'ok',
      sample: relationshipTest?.[0] || null,
    })

    // Test 4: Verify FK constraint exists in database (optional check)
    // Note: This RPC function check_job_parts_vendor_fk may not exist in all environments
    try {
      const { data: fkCheck, error: fkError } = await supabase.rpc('check_job_parts_vendor_fk', {})

      if (!fkError && fkCheck) {
        details.checks.push({
          name: 'foreign_key_constraint',
          status: 'ok',
          exists: true,
        })
      } else if (fkError) {
        // Gracefully skip if function doesn't exist or other errors
        const isFunctionMissing =
          /function.*does not exist/i.test(fkError.message) ||
          /could not find function/i.test(fkError.message)
        details.checks.push({
          name: 'foreign_key_constraint',
          status: 'skip',
          reason: isFunctionMissing ? 'Helper function not available' : fkError.message,
        })
      }
    } catch (rpcError) {
      // Catch any unexpected errors from RPC call
      details.checks.push({
        name: 'foreign_key_constraint',
        status: 'skip',
        reason: 'RPC check failed: ' + (rpcError?.message || 'Unknown error'),
      })
    }

    // All checks passed
    return res.status(200).json({
      vendorRelationship: 'ok',
      timestamp,
      details,
    })
  } catch (error) {
    details.checks.push({
      name: 'unexpected_error',
      status: 'fail',
      error: error?.message || String(error),
    })

    return res.status(500).json({
      vendorRelationship: 'error',
      timestamp,
      details,
      error: error?.message || 'Unexpected error during health check',
    })
  }
}
