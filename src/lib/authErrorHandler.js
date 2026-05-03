// Shared auth-error detection + redirect-to-/auth handler. Used by dashboard,
// deals, analytics, claims-management, calendar, overdue-inbox, dropdown
// services, and the supabase.js boot session check.
//
// Discriminates between:
//   - REAL auth failures (401/403 with JWT/token/auth signal) → redirect to /auth
//   - RLS / permission denials (PostgreSQL 42501, PostgREST PGRST*) → leave alone

// Strict RLS classifier — code-based ONLY. A real Supabase Auth 403 (no PG code)
// with a message containing "permission" must NOT be caught by the loose keyword
// fallback, or auth errors get classified as RLS and the user never gets redirected.
export function isStrictRlsError(error) {
  if (!error) return false
  const code = error?.code
  return (
    code === '42501' ||
    (code && String(code).toUpperCase().startsWith('PGRST'))
  )
}

// Permissive RLS classifier — code OR message keyword. Useful for presentation
// logic ("show RLS-friendly empty state"). NOT used in the auth-redirect path.
export function isRlsError(error) {
  if (!error) return false
  if (isStrictRlsError(error)) return true
  const msg = String(error?.message || '').toLowerCase()
  return (
    msg.includes('policy') ||
    msg.includes('permission') ||
    msg.includes('rls') ||
    msg.includes('row-level security')
  )
}

export function isAuthFailure(error) {
  if (!error) return false
  if (isStrictRlsError(error)) return false
  const code = Number(error?.status ?? error?.statusCode)
  const msg = String(error?.message || '').toLowerCase()
  return (
    [401, 403].includes(code) ||
    msg.includes('jwt') ||
    msg.includes('token') ||
    msg.includes('not authenticated') ||
    msg.includes('invalid login') ||
    msg.includes('expected 3 parts')
  )
}

// Regex matching technical/internal error messages that should never reach the
// user (JWT internals, Postgres infinite-recursion, RLS messages, missing-relation
// errors). Page-level load-failure catches use this to swap a friendly fallback
// for the raw e.message.
export const TECH_NOISE_RE = /JWT|jwt|PostgrestError|infinite recursion|permission denied|RLS|relation .* does not exist/i

export function isTechNoiseMessage(message) {
  return TECH_NOISE_RE.test(String(message || ''))
}

// Single user-facing reason — same string for every label today. If we ever want
// per-context messages, swap this constant for a label→message map.
const SESSION_EXPIRED_MSG = 'Your session expired. Please sign in again.'

// Module-level guard: if a redirect is already in flight (e.g., boot signOut
// triggered + a service catch block fires the same redirect), the second call
// is a no-op. Prevents double-navigation flash.
let _redirectInFlight = false

export function setAuthRedirectReason() {
  try {
    sessionStorage.setItem('authRedirectReason', SESSION_EXPIRED_MSG)
  } catch {
    // private mode / quota — ignore
  }
}

/**
 * If `error` is a real auth failure (not an RLS denial), redirect the user to
 * /auth and store a friendly reason. Returns true if redirected, false otherwise.
 *
 * Use in service-layer catch blocks where a 401 means the session is dead.
 * DO NOT use on routine RLS denials — those are handled by the calling code.
 */
export function handleAuthError(error, _label) {
  if (!isAuthFailure(error)) return false
  if (_redirectInFlight) return true

  setAuthRedirectReason()

  if (typeof window !== 'undefined') {
    if (window.location?.pathname?.startsWith('/auth')) {
      return true
    }
    _redirectInFlight = true
    window.location.assign('/auth')
  }
  return true
}
