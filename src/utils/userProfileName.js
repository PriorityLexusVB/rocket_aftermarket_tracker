// src/utils/userProfileName.js
// Unified user profile display-name resolution and capability management.

// Capability flags are cached in sessionStorage to avoid repeated probing.
// Default ALL to false to avoid query failures when columns don't exist.
// Queries will use only id+email initially (which should always exist).
// Capability detection is performed via health endpoints (e.g., /api/health-user-profiles
// called from ensureUserProfileCapsLoaded()). The service layer's downgradeCapForErrorMessage()
// only disables capabilities when columns are missing; it does NOT upgrade capabilities.
// To reset capability detection after schema changes, clear sessionStorage.
let CAP_NAME = false
let CAP_FULL_NAME = false
let CAP_DISPLAY_NAME = false
let CAPS_LOADED = false

// Bump this when the client-side capability caching logic changes or when we need
// to force a re-probe after schema changes.
const CAPS_CACHE_VERSION = 2

const SS_KEYS = {
  name: 'cap_userProfilesName',
  full: 'cap_userProfilesFullName',
  display: 'cap_userProfilesDisplayName',
  verified: 'cap_userProfilesCapsVerified',
  checkedAt: 'cap_userProfilesCapsCheckedAt',
  version: 'cap_userProfilesCapsVersion',
}

function readCapsFromStorage() {
  if (typeof sessionStorage === 'undefined') return
  const version = Number(sessionStorage.getItem(SS_KEYS.version) || 0)
  const verified =
    version === CAPS_CACHE_VERSION && sessionStorage.getItem(SS_KEYS.verified) === 'true'
  const name = sessionStorage.getItem(SS_KEYS.name)
  const full = sessionStorage.getItem(SS_KEYS.full)
  const display = sessionStorage.getItem(SS_KEYS.display)

  // Safety rule: only trust stored "true" after we've verified caps via the
  // /api/health-user-profiles probe. Schema changes can make stored truths stale
  // and cause PostgREST 400s (e.g. selecting user_profiles.name when it no longer exists).
  if (name === 'false') CAP_NAME = false
  else if (verified && name === 'true') CAP_NAME = true

  if (full === 'false') CAP_FULL_NAME = false
  else if (verified && full === 'true') CAP_FULL_NAME = true

  if (display === 'false') CAP_DISPLAY_NAME = false
  else if (verified && display === 'true') CAP_DISPLAY_NAME = true
}

function writeCapsToStorage() {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(SS_KEYS.name, String(!!CAP_NAME))
  sessionStorage.setItem(SS_KEYS.full, String(!!CAP_FULL_NAME))
  sessionStorage.setItem(SS_KEYS.display, String(!!CAP_DISPLAY_NAME))
}

export function setProfileCaps({ name, full_name, display_name } = {}) {
  if (typeof name === 'boolean') CAP_NAME = name
  if (typeof full_name === 'boolean') CAP_FULL_NAME = full_name
  if (typeof display_name === 'boolean') CAP_DISPLAY_NAME = display_name
  CAPS_LOADED = true
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem(SS_KEYS.version, String(CAPS_CACHE_VERSION))
    sessionStorage.setItem(SS_KEYS.verified, 'true')
    sessionStorage.setItem(SS_KEYS.checkedAt, String(Date.now()))
  }
  writeCapsToStorage()
}

export function downgradeCapForErrorMessage(msg = '') {
  const m = String(msg || '').toLowerCase()
  if (
    m.includes('user_profiles') &&
    m.includes('name') &&
    !m.includes('full_') &&
    !m.includes('display_')
  ) {
    CAP_NAME = false
  }
  if (m.includes('user_profiles') && m.includes('full_name')) {
    CAP_FULL_NAME = false
  }
  if (m.includes('user_profiles') && m.includes('display_name')) {
    CAP_DISPLAY_NAME = false
  }
  writeCapsToStorage()
}

export async function ensureUserProfileCapsLoaded() {
  if (CAPS_LOADED) return
  // Initialize from storage first
  readCapsFromStorage()

  const now = Date.now()
  const version =
    typeof sessionStorage !== 'undefined' ? Number(sessionStorage.getItem(SS_KEYS.version) || 0) : 0
  const verified =
    typeof sessionStorage !== 'undefined' &&
    version === CAPS_CACHE_VERSION &&
    sessionStorage.getItem(SS_KEYS.verified) === 'true'
  const checkedAtRaw =
    typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SS_KEYS.checkedAt) : null
  const checkedAt = checkedAtRaw ? Number(checkedAtRaw) : 0
  const recentlyChecked = Number.isFinite(checkedAt) && now - checkedAt < 10 * 60 * 1000

  // Check if we already have caps from storage
  const hasStoredCaps =
    typeof sessionStorage !== 'undefined' &&
    (sessionStorage.getItem(SS_KEYS.name) !== null ||
      sessionStorage.getItem(SS_KEYS.full) !== null ||
      sessionStorage.getItem(SS_KEYS.display) !== null)

  // If caps were verified recently, trust them.
  if (hasStoredCaps && verified && recentlyChecked) {
    CAPS_LOADED = true
    return
  }

  // Try probing the serverless health endpoint (best-effort)
  if (typeof fetch === 'function' && typeof window !== 'undefined') {
    try {
      const resp = await fetch('/api/health-user-profiles', { method: 'GET' })
      if (resp.ok) {
        const json = await resp.json()
        if (json && json.columns) {
          setProfileCaps({
            name: !!json.columns.name,
            full_name: !!json.columns.full_name,
            display_name: !!json.columns.display_name,
          })
          return
        }
      }
    } catch {
      // Health endpoint not available (e.g., local dev without Vercel)
      // Capabilities remain at their default (false) values, meaning queries will only use id+email.
      // When columns are detected to exist, they'll be enabled via the health endpoint on subsequent loads.
    }
  }

  // Mark "checked" even if probe didn't provide columns, so we don't hammer the endpoint.
  if (typeof sessionStorage !== 'undefined') {
    // Ensure we don't keep trusting a legacy cache format.
    sessionStorage.setItem(SS_KEYS.version, String(CAPS_CACHE_VERSION))
    sessionStorage.setItem(SS_KEYS.checkedAt, String(Date.now()))
  }
  CAPS_LOADED = true
}

// Build a PostgREST select fragment for user_profiles respecting available columns.
// Always includes id; include the best available of name/full_name/display_name; include email as last-resort.
export function buildUserProfileSelectFragment() {
  const parts = ['id']
  if (CAP_NAME) parts.push('name')
  else if (CAP_FULL_NAME) parts.push('full_name')
  else if (CAP_DISPLAY_NAME) parts.push('display_name')
  // Include email for last-resort fallback (generally present on user_profiles)
  parts.push('email')
  return `(${parts.join(', ')})`
}

// Resolve a friendly display name from a user_profiles row
export function resolveUserProfileName(profile) {
  if (!profile || typeof profile !== 'object') return null
  const name = (profile.name || '').trim()
  const full = (profile.full_name || '').trim()
  const display = (profile.display_name || '').trim()
  if (name) return name
  if (full) return full
  if (display) return display
  const email = (profile.email || '').trim()
  if (email && email.includes('@')) return email.split('@')[0]
  return null
}

export function getProfileCaps() {
  return { name: CAP_NAME, full_name: CAP_FULL_NAME, display_name: CAP_DISPLAY_NAME }
}
