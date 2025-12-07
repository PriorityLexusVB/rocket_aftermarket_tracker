// /api/health/capabilities (server route)
// Health check endpoint to report capability flags and telemetry
import { supabase } from '@/lib/supabase'

export default async function handler(req, res) {
  const timestamp = new Date().toISOString()

  try {
    // Check sessionStorage capability flags (these are client-side only)
    // For server-side health check, we'll probe the schema directly
    const capabilities = {
      jobPartsScheduledTimes: false,
      jobPartsVendorId: false,
      jobPartsVendorRel: false,
      userProfilesName: false,
    }

    const probeResults = {
      checks: [],
      timestamp,
    }

    // Probe 1: Check scheduled_start_time column
    const { error: scheduledStartError } = await supabase
      .from('job_parts')
      .select('id, scheduled_start_time')
      .limit(1)

    if (!scheduledStartError) {
      capabilities.jobPartsScheduledTimes = true
      probeResults.checks.push({
        name: 'job_parts_scheduled_times',
        status: 'ok',
      })
    } else {
      const hint = scheduledStartError.message?.includes('column')
        ? 'Column missing. If recently migrated, trigger Admin > Reload Schema Cache.'
        : undefined
      probeResults.checks.push({
        name: 'job_parts_scheduled_times',
        status: 'unavailable',
        error: scheduledStartError.message,
        hint,
      })
    }

    // Probe 2: Check vendor_id column
    const { error: vendorIdError } = await supabase
      .from('job_parts')
      .select('id, vendor_id')
      .limit(1)

    if (!vendorIdError) {
      capabilities.jobPartsVendorId = true
      probeResults.checks.push({
        name: 'job_parts_vendor_id',
        status: 'ok',
      })
    } else {
      const hint = vendorIdError.message?.includes('column')
        ? 'Column missing. If recently migrated, trigger Admin > Reload Schema Cache.'
        : undefined
      probeResults.checks.push({
        name: 'job_parts_vendor_id',
        status: 'unavailable',
        error: vendorIdError.message,
        hint,
      })
    }

    // Probe 3: Check vendor relationship
    const { error: vendorRelError } = await supabase
      .from('job_parts')
      .select('id, vendor:vendors(id, name)')
      .limit(1)

    if (!vendorRelError) {
      capabilities.jobPartsVendorRel = true
      probeResults.checks.push({
        name: 'job_parts_vendor_relationship',
        status: 'ok',
      })
    } else {
      const hint = vendorRelError.message?.toLowerCase?.().includes('relation')
        ? 'Relationship missing. If recently migrated, trigger Admin > Reload Schema Cache.'
        : undefined
      probeResults.checks.push({
        name: 'job_parts_vendor_relationship',
        status: 'unavailable',
        error: vendorRelError.message,
        hint,
      })
    }

    // Probe 4: Check user_profiles.full_name column (correct schema)
    const { error: userProfileNameError } = await supabase
      .from('user_profiles')
      .select('id, full_name')
      .limit(1)

    if (!userProfileNameError) {
      capabilities.userProfilesName = true
      probeResults.checks.push({
        name: 'user_profiles_full_name',
        status: 'ok',
      })
    } else {
      const hint = userProfileNameError.message?.includes('column')
        ? 'Column missing. If recently migrated, trigger Admin > Reload Schema Cache.'
        : undefined
      probeResults.checks.push({
        name: 'user_profiles_full_name',
        status: 'unavailable',
        error: userProfileNameError.message,
        hint,
      })
    }

    // Note: Telemetry counters are client-side only (sessionStorage)
    // We can't access them from the server, but we can provide guidance
    const telemetryNote =
      'Telemetry counters are tracked client-side in sessionStorage. Access them via window.sessionStorage or the browser DevTools.'

    return res.status(200).json({
      capabilities,
      probeResults,
      telemetryNote,
      timestamp,
    })
  } catch (error) {
    return res.status(500).json({
      error: error?.message || 'Unexpected error during capability check',
      timestamp,
    })
  }
}
