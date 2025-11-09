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
      probeResults.checks.push({
        name: 'job_parts_scheduled_times',
        status: 'unavailable',
        error: scheduledStartError.message,
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
      probeResults.checks.push({
        name: 'job_parts_vendor_id',
        status: 'unavailable',
        error: vendorIdError.message,
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
      probeResults.checks.push({
        name: 'job_parts_vendor_relationship',
        status: 'unavailable',
        error: vendorRelError.message,
      })
    }

    // Probe 4: Check user_profiles.name column
    const { error: userProfileNameError } = await supabase
      .from('user_profiles')
      .select('id, name')
      .limit(1)

    if (!userProfileNameError) {
      capabilities.userProfilesName = true
      probeResults.checks.push({
        name: 'user_profiles_name',
        status: 'ok',
      })
    } else {
      probeResults.checks.push({
        name: 'user_profiles_name',
        status: 'unavailable',
        error: userProfileNameError.message,
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
