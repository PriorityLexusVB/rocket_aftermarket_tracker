// src/utils/userProfileName.js
// Unified user profile display-name resolution and capability management.

// Capability flags are cached in sessionStorage to avoid repeated probing.
// Default to false to avoid query failures when columns don't exist.
// The ensureUserProfileCapsLoaded() function will probe the database to detect available columns.
let CAP_NAME = false
let CAP_FULL_NAME = false
let CAP_DISPLAY_NAME = true // display_name is the most common fallback
let CAPS_LOADED = false

const SS_KEYS = {
  name: 'cap_userProfilesName',
  full: 'cap_userProfilesFullName',
  display: 'cap_userProfilesDisplayName',
}

function readCapsFromStorage() {
  if (typeof sessionStorage === 'undefined') return
  const name = sessionStorage.getItem(SS_KEYS.name)
  const full = sessionStorage.getItem(SS_KEYS.full)
  const display = sessionStorage.getItem(SS_KEYS.display)
  // Read both true and false values from storage
  if (name === 'false') CAP_NAME = false
  else if (name === 'true') CAP_NAME = true
  if (full === 'false') CAP_FULL_NAME = false
  else if (full === 'true') CAP_FULL_NAME = true
  if (display === 'false') CAP_DISPLAY_NAME = false
  else if (display === 'true') CAP_DISPLAY_NAME = true
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
  
  // Check if we already have caps from storage
  const hasStoredCaps = typeof sessionStorage !== 'undefined' && 
    (sessionStorage.getItem(SS_KEYS.name) !== null ||
     sessionStorage.getItem(SS_KEYS.full) !== null ||
     sessionStorage.getItem(SS_KEYS.display) !== null)
  
  if (hasStoredCaps) {
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
    } catch (_) {
      // Health endpoint not available (e.g., local dev without Vercel)
      // Use conservative defaults - display_name is the most common column
      // The service layer's retry logic will handle detecting other columns if available
    }
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
