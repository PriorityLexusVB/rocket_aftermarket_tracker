// src/utils/capabilityTelemetry.js
// Telemetry utility for tracking capability fallback events

/**
 * Telemetry counter keys
 */
export const TelemetryKey = {
  VENDOR_FALLBACK: 'telemetry_vendorFallback',
  VENDOR_ID_FALLBACK: 'telemetry_vendorIdFallback',
  VENDOR_REL_FALLBACK: 'telemetry_vendorRelFallback',
  SCHEDULED_TIMES_FALLBACK: 'telemetry_scheduledTimesFallback',
  USER_PROFILE_NAME_FALLBACK: 'telemetry_userProfileNameFallback',
  RLS_LOANER_DENIED: 'telemetry_rlsLoanerDenied',
}

/**
 * Increment a telemetry counter
 * @param {string} key - One of TelemetryKey values
 */
export function incrementTelemetry(key) {
  if (typeof sessionStorage === 'undefined') return

  try {
    const current = parseInt(sessionStorage.getItem(key) || '0', 10)
    sessionStorage.setItem(key, String(current + 1))
  } catch (error) {
    console.warn('[capabilityTelemetry] Failed to increment counter:', key, error)
  }
}

/**
 * Get a telemetry counter value
 * @param {string} key - One of TelemetryKey values
 * @returns {number} - Current counter value
 */
export function getTelemetry(key) {
  if (typeof sessionStorage === 'undefined') return 0

  try {
    const value = parseInt(sessionStorage.getItem(key) || '0', 10)
    // Handle NaN by returning 0
    return isNaN(value) ? 0 : value
  } catch (error) {
    console.warn('[capabilityTelemetry] Failed to get counter:', key, error)
    return 0
  }
}

/**
 * Get all telemetry counters
 * @returns {Object} - Object with all counter values
 */
export function getAllTelemetry() {
  return {
    vendorFallback: getTelemetry(TelemetryKey.VENDOR_FALLBACK),
    vendorIdFallback: getTelemetry(TelemetryKey.VENDOR_ID_FALLBACK),
    vendorRelFallback: getTelemetry(TelemetryKey.VENDOR_REL_FALLBACK),
    scheduledTimesFallback: getTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK),
    userProfileNameFallback: getTelemetry(TelemetryKey.USER_PROFILE_NAME_FALLBACK),
    rlsLoanerDenied: getTelemetry(TelemetryKey.RLS_LOANER_DENIED),
  }
}

/**
 * Reset a specific telemetry counter
 * @param {string} key - One of TelemetryKey values
 */
export function resetTelemetry(key) {
  if (typeof sessionStorage === 'undefined') return

  try {
    sessionStorage.setItem(key, '0')
  } catch (error) {
    console.warn('[capabilityTelemetry] Failed to reset counter:', key, error)
  }
}

/**
 * Reset all telemetry counters
 */
export function resetAllTelemetry() {
  Object.values(TelemetryKey).forEach((key) => resetTelemetry(key))
}

/**
 * Get telemetry summary with timestamps
 * @returns {Object} - Telemetry summary
 */
export function getTelemetrySummary() {
  return {
    timestamp: new Date().toISOString(),
    counters: getAllTelemetry(),
    sessionActive: typeof sessionStorage !== 'undefined',
  }
}
