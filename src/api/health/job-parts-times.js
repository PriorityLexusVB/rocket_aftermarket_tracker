// /api/health/job-parts-times (server route)
// Health check endpoint to verify job_parts scheduling time columns
import { supabase } from '@/lib/supabase'
import { getRemediationGuidance, SchemaErrorCode } from '@/utils/schemaErrorClassifier'

export default async function handler(req, res) {
  const timestamp = new Date().toISOString()
  const details = {
    checks: [],
    timestamp,
  }

  try {
    // Test 1: Basic Supabase connectivity
    const { error: pingError } = await supabase.from('job_parts').select('id').limit(1)

    if (pingError) {
      details.checks.push({
        name: 'supabase_connectivity',
        status: 'fail',
        error: pingError.message,
      })
      return res.status(503).json({
        scheduledTimes: 'degraded',
        timestamp,
        details,
      })
    }

    details.checks.push({
      name: 'supabase_connectivity',
      status: 'ok',
    })

    // Test 2: Check scheduled_start_time column
    const { data: startTimeTest, error: startTimeError } = await supabase
      .from('job_parts')
      .select('id, scheduled_start_time')
      .limit(1)

    if (startTimeError) {
      const isMissingColumn = /column .* does not exist/i.test(startTimeError.message)
      const guidance = getRemediationGuidance(startTimeError)

      details.checks.push({
        name: 'scheduled_start_time_column',
        status: 'fail',
        error: startTimeError.message,
        isMissingColumn,
        remediation: guidance,
      })

      return res.status(503).json({
        scheduledTimes: 'missing',
        timestamp,
        details,
      })
    }

    details.checks.push({
      name: 'scheduled_start_time_column',
      status: 'ok',
    })

    // Test 3: Check scheduled_end_time column
    const { data: endTimeTest, error: endTimeError } = await supabase
      .from('job_parts')
      .select('id, scheduled_end_time')
      .limit(1)

    if (endTimeError) {
      const isMissingColumn = /column .* does not exist/i.test(endTimeError.message)
      const guidance = getRemediationGuidance(endTimeError)

      details.checks.push({
        name: 'scheduled_end_time_column',
        status: 'fail',
        error: endTimeError.message,
        isMissingColumn,
        remediation: guidance,
      })

      return res.status(503).json({
        scheduledTimes: 'partial',
        timestamp,
        details,
      })
    }

    details.checks.push({
      name: 'scheduled_end_time_column',
      status: 'ok',
    })

    // Test 4: Check indexes exist for performance
    try {
      const { data: indexCheck, error: indexError } = await supabase.rpc(
        'check_job_parts_scheduled_indexes',
        {}
      )

      if (!indexError && indexCheck) {
        details.checks.push({
          name: 'performance_indexes',
          status: 'ok',
          indexes: indexCheck,
        })
      } else {
        details.checks.push({
          name: 'performance_indexes',
          status: 'skip',
          reason: 'Helper function not available or indexes not verified',
        })
      }
    } catch (rpcError) {
      details.checks.push({
        name: 'performance_indexes',
        status: 'skip',
        reason: 'RPC check failed: ' + (rpcError?.message || 'Unknown error'),
      })
    }

    // All checks passed
    return res.status(200).json({
      scheduledTimes: 'ok',
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
      scheduledTimes: 'error',
      timestamp,
      details,
      error: error?.message || 'Unexpected error during health check',
    })
  }
}
