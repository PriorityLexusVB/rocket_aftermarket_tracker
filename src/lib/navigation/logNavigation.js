// Lightweight navigation logging.
// Guardrails:
// - MUST be no-throw
// - MUST NOT log PII (no customer names, phone numbers, free-form search)
// - MUST be safe in tests (no spam)

function shouldDebugLog() {
  const debug =
    String(import.meta.env?.VITE_DEBUG_NAV || '')
      .trim()
      .toLowerCase() === 'true'
  if (!debug) return false

  // Keep production silent.
  if (import.meta.env?.PROD) return false

  // Keep tests silent.
  if (import.meta.env?.VITEST) return false

  // Prefer dev-only logging.
  return import.meta.env?.DEV === true
}

function safeCurrentRoute() {
  try {
    if (typeof window === 'undefined') return null
    return `${window.location?.pathname || ''}${window.location?.search || ''}`
  } catch {
    return null
  }
}

function pickIdOnlyContext(context) {
  if (!context || typeof context !== 'object') return null

  // Only pass through a small allowlist of keys that are known-safe.
  const allowed = ['from', 'fromPath', 'fromSearch', 'focusId', 'dealId', 'jobId', 'label', 'tab']
  const out = {}

  for (const key of allowed) {
    const value = context[key]
    if (value == null) continue
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      out[key] = value
    }
  }

  return Object.keys(out).length ? out : null
}

/**
 * Calendar navigation logger.
 *
 * @param {Object} args
 * @param {string} args.source - Grep-friendly source identifier (e.g., Dashboard.OpenCalendar)
 * @param {string} args.destination - Destination path (may include query params)
 * @param {Object} [args.context] - IDs/route info only (NO PII)
 * @param {Object} [args.flags] - feature flag state snapshot
 */
export function logCalendarNavigation(args = {}) {
  try {
    const { source = 'unknown', destination = 'unknown', context = null, flags = null } = args || {}

    if (!shouldDebugLog()) return

    const safeContext = pickIdOnlyContext(context)
    const from =
      (safeContext && (safeContext.from || safeContext.fromPath)) || safeCurrentRoute() || null

    // eslint-disable-next-line no-console
    console.debug('[calendar-nav]', {
      from,
      destination,
      flags: flags && typeof flags === 'object' ? flags : null,
      context: safeContext,
    })
  } catch {
    // no-op
  }
}
