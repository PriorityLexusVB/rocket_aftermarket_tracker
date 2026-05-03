// Shared auth-error detection + redirect-to-/auth handler.
// Promoted from dropdownService.js so dashboard, deals, analytics, claims-management,
// calendar, overdue-inbox, etc. can all use the same logic.
//
// Discriminates between:
//   - REAL auth failures (401/403 with JWT/token/auth signal) → redirect to /auth
//   - RLS / permission denials (PostgreSQL 42501, PostgREST PGRST*) → leave alone

// Stricter RLS classifier — code-based ONLY. Used by isAuthFailure for early-out.
// A real Supabase Auth 403 (no PG code) with a message containing "permission" should
// NOT be caught by the loose keyword fallback, or auth errors get classified as RLS
// and the user never gets redirected to re-authenticate.
function isStrictRlsError(error) {
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
  // Use STRICT RLS check — only PG/PostgREST codes can override an HTTP 401/403.
  // Avoids the "codeless 403 with 'permission' in message" false negative.
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

// Map internal labels → user-facing reasons. Pages that catch auth failures pass
// a label like 'dashboard' or 'deals'; never expose those raw to the user.
const REASON_MAP = {
  dashboard: 'Your session expired. Please sign in again.',
  deals: 'Your session expired. Please sign in again.',
  dropdown: 'Your session expired. Please sign in again.',
  analytics: 'Your session expired. Please sign in again.',
  claims: 'Your session expired. Please sign in again.',
  calendar: 'Your session expired. Please sign in again.',
  overdue: 'Your session expired. Please sign in again.',
  boot: 'Your session expired. Please sign in again.',
  session: 'Your session expired. Please sign in again.',
}

// Module-level guard: if a redirect is already in flight (e.g., boot signOut
// triggered + a service catch block fires the same redirect), the second call
// is a no-op. Prevents double-navigation flash.
let _redirectInFlight = false

export function setAuthRedirectReason(label = 'session') {
  try {
    const reason = REASON_MAP[label] ?? REASON_MAP.session
    sessionStorage.setItem('authRedirectReason', reason)
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

/**
 * If `error` is a real auth failure (not an RLS denial), redirect the user to
 * /auth and store a friendly reason. Returns true if redirected, false otherwise.
 *
 * Use in service-layer catch blocks where a 401 means the session is dead.
 * DO NOT use on routine RLS denials — those are handled by the calling code.
 */
export function handleAuthError(error, label = 'session') {
  if (!isAuthFailure(error)) return false
  if (_redirectInFlight) return true

  setAuthRedirectReason(label)

  if (typeof window !== 'undefined') {
    if (window.location?.pathname?.startsWith('/auth')) {
      return true
    }
    _redirectInFlight = true
    window.location.assign('/auth')
  }
  return true
}
