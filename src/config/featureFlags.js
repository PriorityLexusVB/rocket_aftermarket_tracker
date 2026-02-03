// Feature flags (UI-only) for safe, incremental rollouts.
// Guardrails: no process.env usage under src/** (Vite client env only).

const FLAG_ENV_KEYS = {
  calendar_unified_shell: 'VITE_FF_CALENDAR_UNIFIED_SHELL',
}

function parseBooleanEnv(value) {
  if (value == null) return null
  const normalized = String(value).trim().toLowerCase()
  if (normalized === 'true') return true
  if (normalized === 'false') return false
  return null
}

/**
 * Feature flags default to OFF unless explicitly enabled by env.
 *
 * Example:
 * - `VITE_FF_CALENDAR_UNIFIED_SHELL=true`
 */
export function isFeatureEnabled(key) {
  const envKey = FLAG_ENV_KEYS?.[key]
  const raw = envKey ? import.meta.env?.[envKey] : undefined
  const parsed = parseBooleanEnv(raw)
  return parsed === true
}

export function isCalendarUnifiedShellEnabled() {
  return isFeatureEnabled('calendar_unified_shell')
}
