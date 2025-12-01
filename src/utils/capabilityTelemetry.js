// src/utils/capabilityTelemetry.js
// Telemetry utility for tracking capability fallback events
// Enhanced with localStorage persistence and export/import capabilities

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
  DROPDOWN_ORG_FALLBACK: 'telemetry_dropdownOrgFallback', // When dropdown queries fail org-scoped and use fallback
  RLS_TRANSACTION_RECOVERY: 'telemetry_rlsTransactionRecovery', // When transaction RLS recovery is triggered
  CALENDAR_RENDER_MS: 'telemetry_calendarRenderMs', // Optional: Calendar render time metric
}

// Flag to enable calendar render time telemetry (defaults to false)
const CALENDAR_TELEMETRY_ENABLED =
  String(import.meta.env.VITE_TELEMETRY_CALENDAR_MS || '').toLowerCase() === 'true'

// Separate key for tracking the last time all telemetry was reset
const LAST_RESET_AT_KEY = 'telemetry_lastResetAt'

/**
 * Storage preference - checks availability and falls back gracefully
 * @returns {Storage | null} Available storage or null
 */
function getAvailableStorage() {
  try {
    if (typeof sessionStorage !== 'undefined' && sessionStorage) {
      sessionStorage.setItem('__test__', '1')
      sessionStorage.removeItem('__test__')
      return sessionStorage
    }
  } catch (_e) {
    // sessionStorage not available or blocked
  }

  try {
    if (typeof localStorage !== 'undefined' && localStorage) {
      localStorage.setItem('__test__', '1')
      localStorage.removeItem('__test__')
      return localStorage
    }
  } catch (_e) {
    // localStorage not available or blocked
  }

  return null
}

/**
 * Increment a telemetry counter
 * @param {string} key - One of TelemetryKey values
 */
export function incrementTelemetry(key) {
  const storage = getAvailableStorage()
  if (!storage) return

  try {
    const current = parseInt(storage.getItem(key) || '0', 10)
    storage.setItem(key, String(current + 1))
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
  const storage = getAvailableStorage()
  if (!storage) return 0

  try {
    const value = parseInt(storage.getItem(key) || '0', 10)
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
  const base = {
    vendorFallback: getTelemetry(TelemetryKey.VENDOR_FALLBACK),
    vendorIdFallback: getTelemetry(TelemetryKey.VENDOR_ID_FALLBACK),
    vendorRelFallback: getTelemetry(TelemetryKey.VENDOR_REL_FALLBACK),
    scheduledTimesFallback: getTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK),
    userProfileNameFallback: getTelemetry(TelemetryKey.USER_PROFILE_NAME_FALLBACK),
    rlsLoanerDenied: getTelemetry(TelemetryKey.RLS_LOANER_DENIED),
    dropdownOrgFallback: getTelemetry(TelemetryKey.DROPDOWN_ORG_FALLBACK),
    rlsTransactionRecovery: getTelemetry(TelemetryKey.RLS_TRANSACTION_RECOVERY),
  }
  // Optionally include calendar metric when enabled
  if (CALENDAR_TELEMETRY_ENABLED) {
    base.calendarRenderMs = getTelemetry(TelemetryKey.CALENDAR_RENDER_MS)
  }
  return base
}

/**
 * Reset a specific telemetry counter
 * @param {string} key - One of TelemetryKey values
 */
export function resetTelemetry(key) {
  const storage = getAvailableStorage()
  if (!storage) return

  try {
    storage.setItem(key, '0')
  } catch (error) {
    console.warn('[capabilityTelemetry] Failed to reset counter:', key, error)
  }
}

/**
 * Reset all telemetry counters
 */
export function resetAllTelemetry() {
  Object.values(TelemetryKey).forEach((key) => resetTelemetry(key))
  const storage = getAvailableStorage()
  try {
    storage?.setItem(LAST_RESET_AT_KEY, new Date().toISOString())
  } catch (e) {
    // non-fatal
  }
}

/**
 * Get telemetry summary with timestamps
 * @returns {Object} - Telemetry summary
 */
export function getTelemetrySummary() {
  const storage = getAvailableStorage()
  let lastResetAt = null
  try {
    lastResetAt = storage?.getItem(LAST_RESET_AT_KEY) || null
  } catch (_e) {
    lastResetAt = null
  }
  const now = new Date()
  let secondsSinceReset = null
  if (lastResetAt) {
    const resetDate = new Date(lastResetAt)
    if (!isNaN(resetDate.getTime())) {
      secondsSinceReset = Math.floor((now.getTime() - resetDate.getTime()) / 1000)
    }
  }
  return {
    timestamp: now.toISOString(),
    counters: getAllTelemetry(),
    sessionActive: storage !== null,
    storageType:
      storage === sessionStorage
        ? 'sessionStorage'
        : storage === localStorage
          ? 'localStorage'
          : 'none',
    lastResetAt,
    secondsSinceReset,
  }
}

/**
 * Export telemetry data as JSON string
 * @returns {string} - JSON string of telemetry data
 */
export function exportTelemetry() {
  return JSON.stringify(getTelemetrySummary(), null, 2)
}

/**
 * Import telemetry data from JSON string
 * @param {string} jsonString - JSON string of telemetry data
 * @returns {boolean} - Success status
 */
export function importTelemetry(jsonString) {
  const storage = getAvailableStorage()
  if (!storage) return false

  try {
    const data = JSON.parse(jsonString)
    if (data.counters) {
      Object.entries(data.counters).forEach(([key, value]) => {
        const telemetryKey = Object.values(TelemetryKey).find((k) => k.includes(key))
        if (telemetryKey && typeof value === 'number') {
          storage.setItem(telemetryKey, String(value))
        }
      })
      return true
    }
    return false
  } catch (error) {
    console.error('[capabilityTelemetry] Failed to import telemetry:', error)
    return false
  }
}

/**
 * Persist current sessionStorage telemetry to localStorage
 * Useful for preserving telemetry across sessions
 * @returns {boolean} - Success status
 */
export function persistToLocalStorage() {
  try {
    if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') return false

    let persisted = false
    Object.values(TelemetryKey).forEach((key) => {
      const value = sessionStorage.getItem(key)
      if (value) {
        localStorage.setItem(key, value)
        persisted = true
      }
    })
    return persisted
  } catch (error) {
    console.warn('[capabilityTelemetry] Failed to persist to localStorage:', error)
    return false
  }
}

/**
 * Restore telemetry from localStorage to sessionStorage
 * @returns {boolean} - Success status
 */
export function restoreFromLocalStorage() {
  try {
    if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') return false

    let restored = false
    Object.values(TelemetryKey).forEach((key) => {
      const value = localStorage.getItem(key)
      if (value) {
        sessionStorage.setItem(key, value)
        restored = true
      }
    })
    return restored
  } catch (error) {
    console.warn('[capabilityTelemetry] Failed to restore from localStorage:', error)
    return false
  }
}

/**
 * Record calendar render time (only when VITE_TELEMETRY_CALENDAR_MS=true)
 * Side-effect free when disabled - safe to call unconditionally
 * @param {number} durationMs - Render duration in milliseconds
 * @returns {void}
 */
export function recordCalendarRenderTime(durationMs) {
  if (!CALENDAR_TELEMETRY_ENABLED) return
  if (typeof durationMs !== 'number' || durationMs < 0) return

  const storage = getAvailableStorage()
  if (!storage) return

  try {
    // Store the most recent render time (not cumulative)
    storage.setItem(TelemetryKey.CALENDAR_RENDER_MS, String(Math.round(durationMs)))
  } catch (error) {
    console.warn('[capabilityTelemetry] Failed to record calendar render time:', error)
  }
}

/**
 * Check if calendar telemetry is enabled
 * @returns {boolean}
 */
export function isCalendarTelemetryEnabled() {
  return CALENDAR_TELEMETRY_ENABLED
}
