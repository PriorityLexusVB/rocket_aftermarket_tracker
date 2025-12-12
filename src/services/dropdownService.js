// src/services/dropdownService.js
import { supabase } from '@/lib/supabase'
import {
  ensureUserProfileCapsLoaded,
  getProfileCaps,
  resolveUserProfileName,
  downgradeCapForErrorMessage,
} from '@/utils/userProfileName'
import { incrementTelemetry, TelemetryKey } from '@/utils/capabilityTelemetry'
import { persistOrgId, readOrgId } from '@/utils/orgStorage'

// ---------------------------------------------------------------------------
// Capability: user_profiles.vendor_id column (some environments may not have it yet)
// We detect 400 errors / missing column messages and degrade selects to omit vendor_id.
let USER_PROFILES_VENDOR_ID_AVAILABLE = true
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_userProfilesVendorId')
  if (stored === 'false') USER_PROFILES_VENDOR_ID_AVAILABLE = false
}
function disableUserProfilesVendorIdCapability() {
  USER_PROFILES_VENDOR_ID_AVAILABLE = false
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_userProfilesVendorId', 'false')
  }
}
// (enable helper reserved for future positive detections)

// Simple in-memory cache with TTL to speed dropdowns
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const _cache = new Map()
// Track in-flight fetches to dedupe parallel requests
const _pending = new Map()

function _cacheKey(base, extras = {}) {
  const suffix = Object.entries(extras)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}:${v}`)
    .join('|')
  return suffix ? `${base}?${suffix}` : base
}

function _setCache(key, value) {
  _cache.set(key, { value, ts: Date.now() })
}

function _getCache(key) {
  const hit = _cache.get(key)
  if (!hit) return null
  if (Date.now() - hit.ts > CACHE_TTL_MS) {
    _cache.delete(key)
    return null
  }
  return hit.value
}

function _getPending(key) {
  return _pending.get(key) || null
}

function _setPending(key, promise) {
  _pending.set(key, promise)
}

function _clearPending(key) {
  _pending.delete(key)
}

// Resolve current user's org_id once per session for org-scoped dropdowns
// Returns cached org_id if available, or null if user has no org (deliberately not caching errors)
let _orgIdCache = null
let _orgIdPending = null
let _orgIdCacheValid = false // Track whether cache is valid (vs. error state)

/**
 * Helper: Check if an error is an RLS/permission error
 */
function _isRlsError(error) {
  if (!error) return false
  const msg = String(error?.message || '').toLowerCase()
  const code = error?.code
  return (
    code === '42501' ||
    (code && String(code).toUpperCase().startsWith('PGRST')) ||
    msg.includes('policy') ||
    msg.includes('permission') ||
    msg.includes('rls') ||
    msg.includes('row-level security')
  )
}

function handleAuthError(error, label = 'dropdown') {
  const code = Number(error?.status ?? error?.statusCode ?? error?.code)
  const msg = String(error?.message || '').toLowerCase()
  if ([401, 403].includes(code) || msg.includes('permission denied')) {
    try {
      sessionStorage.setItem('authRedirectReason', `Please sign in again (${label})`)
    } catch (_) {}
    if (typeof window !== 'undefined') {
      window.location.assign('/auth')
    }
    return true
  }
  return false
}

async function requireAuthenticatedUser(label = 'dropdown') {
  try {
    const { data } = await supabase?.auth?.getSession?.()
    const user = data?.session?.user
    if (!user) return null
    return user
  } catch (e) {
    console.warn(`[dropdownService] auth check failed (${label}):`, e?.message || e)
    handleAuthError(e, label)
    return null
  }
}

async function getScopedOrgId() {
  // If we have a valid cached value, return it immediately
  if (_orgIdCacheValid && _orgIdCache !== undefined) return _orgIdCache
  if (_orgIdPending) return _orgIdPending

  _orgIdPending = (async () => {
    try {
      const { data: auth } = await supabase?.auth?.getUser?.()
      const userId = auth?.user?.id
      const email = auth?.user?.email

      if (!userId && !email) {
        _orgIdCache = null
        _orgIdCacheValid = false
        return null
      }

      // Prefer org_id cached for this authenticated user to avoid redundant lookups
      const stored = readOrgId(userId)
      if (stored && !_orgIdCacheValid) {
        _orgIdCache = stored
        _orgIdCacheValid = true
        return _orgIdCache
      }

      if (!userId && !email) {
        // User is not authenticated - cache null as valid (no org available)
        _orgIdCache = null
        _orgIdCacheValid = true
        persistOrgId(null, userId)
        return null
      }

      // Primary: match by id
      let prof = null
      let primaryError = null
      let emailError = null
      if (userId) {
        const { data, error } = await supabase
          .from('user_profiles')
          .select('org_id')
          .eq('id', userId)
          .single()
        prof = data
        primaryError = error

        // If RLS error on primary lookup, log but don't fail - try email fallback
        if (error && _isRlsError(error)) {
          console.warn(
            '[dropdownService] getScopedOrgId: RLS error on primary lookup, trying email fallback:',
            error?.message
          )
        }
      }

      // Fallback: match by email if id lookup failed or returned null
      if ((!prof || !prof.org_id) && email) {
        const { data: profByEmail, error: emailErr } = await supabase
          .from('user_profiles')
          .select('org_id')
          .eq('email', email)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        
        emailError = emailErr

        if (profByEmail?.org_id) {
          prof = profByEmail
        } else if (emailError && _isRlsError(emailError)) {
          console.warn(
            '[dropdownService] getScopedOrgId: RLS error on email fallback:',
            emailError?.message
          )
        }
      }

      // If we found an org_id, cache it as valid
      if (prof?.org_id) {
        _orgIdCache = prof.org_id
        _orgIdCacheValid = true
        persistOrgId(_orgIdCache, userId)
        return _orgIdCache
      }

      // No org_id found from either lookup - this may be:
      // 1. User genuinely has no org_id (valid state)
      // 2. RLS blocked our query (transient state, should retry)
      // If we had RLS errors from either lookup, don't cache - allow retry on next call
      if ((primaryError && _isRlsError(primaryError)) || (emailError && _isRlsError(emailError))) {
        console.warn(
          '[dropdownService] getScopedOrgId: No org_id found due to RLS - will retry on next call'
        )
        // Track RLS fallback in telemetry for auditing
        incrementTelemetry(TelemetryKey.DROPDOWN_ORG_FALLBACK)
        // Don't cache - allow retry
        return null
      }

      // No RLS errors, user just doesn't have org_id - cache null as valid
      _orgIdCache = null
      _orgIdCacheValid = true
      persistOrgId(null, userId)
      return null
    } catch (e) {
      // Unexpected error - don't cache, allow retry
      console.warn('[dropdownService] getScopedOrgId failed:', e?.message || e)
      return null
    } finally {
      _orgIdPending = null
    }
  })()
  return _orgIdPending
}

// Lightweight cache peekers to enable cached-first UI rendering without awaiting network
export function peekVendors({ activeOnly = true } = {}) {
  const orgId = null
  const key = _cacheKey('vendors', { activeOnly, orgId })
  return _getCache(key) || []
}

export function peekProducts({ activeOnly = true } = {}) {
  const orgId = null
  const key = _cacheKey('products', { activeOnly, orgId })
  return _getCache(key) || []
}

export function peekStaff({ departments = [], roles = [], activeOnly = true } = {}) {
  const orgId = null
  const key = _cacheKey('staff', {
    departments: departments?.join(','),
    roles: roles?.join(','),
    activeOnly,
    orgId,
  })
  return _getCache(key) || []
}

/**
 * Map any list to { id, value, label } options (keeps extra props if you spread them later).
 */
function toOptions(list) {
  return (list || []).map((r) => ({
    id: r.id,
    value: r.id,
    label:
      resolveUserProfileName(r) ??
      r.name ??
      r.full_name ??
      r.display_name ??
      r.email ??
      String(r.id),
  }))
}

/**
 * Staff fetcher with exact-first, fuzzy-fallback by departments/roles.
 * Uses user_profiles saved via Admin page (department/role/is_active).
 */
async function getStaff({ departments = [], roles = [], activeOnly = true } = {}) {
  const user = await requireAuthenticatedUser('getStaff')
  if (!user) return []

  const orgId = await getScopedOrgId()
  const key = _cacheKey('staff', {
    departments: departments?.join(','),
    roles: roles?.join(','),
    activeOnly,
    orgId,
  })
  const cached = _getCache(key)
  if (cached) return cached
  const inflight = _getPending(key)
  if (inflight) return inflight

  const promise = (async () => {
    await ensureUserProfileCapsLoaded()
    let attempt = 0
    const MAX_ATTEMPTS = 3

    while (attempt < MAX_ATTEMPTS) {
      attempt++
      const caps = getProfileCaps()
      let nameCol = caps.name
        ? 'name'
        : caps.full_name
          ? 'full_name'
          : caps.display_name
            ? 'display_name'
            : 'email'

      try {
        // 1) exact filter by department/role
      let q = supabase
        .from('user_profiles')
        .select(
          [
            'id',
              nameCol,
              'email',
              'department',
              'role',
              'is_active',
              USER_PROFILES_VENDOR_ID_AVAILABLE ? 'vendor_id' : null,
            ]
              .filter(Boolean)
              .join(', '),
            { count: 'exact' }
          )
        if (nameCol) q = q.order(nameCol, { ascending: true })
        else q = q.order('email', { ascending: true })

        if (activeOnly) q = q.eq('is_active', true)
        if (departments.length) q = q.in('department', departments)
        if (roles.length) q = q.in('role', roles)
        if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)

        const { data: exact, count } = await q.throwOnError()
        if ((count ?? 0) > 0) {
          const opts = toOptions(exact)
          _setCache(key, opts)
          return opts
        }
        // if no exact results and no filters provided, just return whatever we have
        if (!departments.length && !roles.length) return toOptions(exact || [])

        // Break out of retry loop if successful (no errors)
        break
      } catch (err) {
        console.error(`getStaff exact query failed (attempt ${attempt}):`, {
          err,
          departments,
          roles,
        })
        // Downgrade capability flags if the error references missing columns
        const msg = String(err?.message || '').toLowerCase()
        let degraded = false

        // Detect and handle vendor_id missing column
        if (msg.includes('vendor_id') && msg.includes('user_profiles')) {
          if (USER_PROFILES_VENDOR_ID_AVAILABLE) {
            console.warn(
              '[dropdownService:getStaff] vendor_id column missing on user_profiles; degrading capability'
            )
            disableUserProfilesVendorIdCapability()
            degraded = true
          }
        }

        // Detect and handle name/full_name/display_name missing columns
        if (msg.includes('user_profiles') && (msg.includes('name') || msg.includes('column'))) {
          downgradeCapForErrorMessage(msg)
          degraded = true
        }

        // If we degraded a capability, retry the exact query with updated caps
        if (degraded && attempt < MAX_ATTEMPTS) {
          console.log(`[dropdownService:getStaff] Retrying with degraded capabilities`)
          continue
        }

        // Otherwise break and try fuzzy
        break
      }
    }

    // 2) fuzzy fallback if exact returns zero or had errors
    const caps2 = getProfileCaps()
    const nameCol2 = caps2.name
      ? 'name'
      : caps2.full_name
        ? 'full_name'
        : caps2.display_name
          ? 'display_name'
          : 'email'

    const fuzzTerms = [...departments, ...roles].map((s) => s.trim()).filter(Boolean)
    // Important: do not use ilike on enum columns (role). Some environments store role as an enum,
    // which doesn't support ILIKE. Restrict fuzzy matching to text columns only.
    const ors = fuzzTerms
      .map((t) =>
        [
          'department.ilike.%' + t + '%',
          nameCol2 ? `${nameCol2}.ilike.%${t}%` : null,
          'email.ilike.%' + t + '%',
        ]
          .filter(Boolean)
          .join(',')
      )
      .join(',')

    try {
      let q2 = supabase
        .from('user_profiles')
        .select(
          [
            'id',
            nameCol2,
            'email',
            'department',
            'role',
            'is_active',
            USER_PROFILES_VENDOR_ID_AVAILABLE ? 'vendor_id' : null,
          ]
            .filter(Boolean)
            .join(', ')
        )
        .eq('is_active', true)
        // Only apply OR when we have filters; otherwise skip fuzzy query
        .or(ors || (nameCol2 ? `${nameCol2}.ilike.%placeholder%` : 'email.ilike.%placeholder%'))
      if (nameCol2) q2 = q2.order(nameCol2, { ascending: true })
      else q2 = q2.order('email', { ascending: true })

      if (orgId) q2 = q2.or(`org_id.eq.${orgId},org_id.is.null`)

      const { data: fuzzy, error: fuzzyErr } = await q2.throwOnError()
      if (fuzzyErr) {
        const msg = String(fuzzyErr?.message || '').toLowerCase()
        if (msg.includes('vendor_id') && msg.includes('user_profiles')) {
          if (USER_PROFILES_VENDOR_ID_AVAILABLE) {
            console.warn(
              '[dropdownService:getStaff] vendor_id column missing on fuzzy query; degrading capability'
            )
            disableUserProfilesVendorIdCapability()
            // Retry once without vendor_id immediately
            let qRetry = supabase
              .from('user_profiles')
              .select(
                ['id', nameCol2, 'email', 'department', 'role', 'is_active']
                  .filter(Boolean)
                  .join(', ')
              )
              .eq('is_active', true)
              .or(
                ors || (nameCol2 ? `${nameCol2}.ilike.%placeholder%` : 'email.ilike.%placeholder%')
              )
            if (orgId) qRetry = qRetry.or(`org_id.eq.${orgId},org_id.is.null`)
            const r = await qRetry
            const opts2 = toOptions(r?.data || [])
            _setCache(key, opts2)
            return opts2
          }
        }
        handleAuthError(fuzzyErr, 'getStaff')
      }
      const opts = toOptions(fuzzy || [])
      _setCache(key, opts)
      return opts
    } catch (err) {
      if (!handleAuthError(err, 'getStaff')) {
        console.error('getStaff fuzzy query failed:', { err, departments, roles })
      }
      return []
    }
  })()

  _setPending(key, promise)
  try {
    const result = await promise
    return result
  } finally {
    _clearPending(key)
  }
}

/** Specific staff dropdowns (Admin sets department text) */
export async function getSalesConsultants() {
  return getStaff({
    departments: ['Sales', 'Sales Consultant', 'Sales Consultants'],
    roles: ['staff'],
  })
}
export async function getDeliveryCoordinators() {
  return getStaff({
    departments: ['Delivery', 'Delivery Coordinator', 'Delivery Coordinators'],
    roles: ['staff'],
  })
}
export async function getFinanceManagers() {
  return getStaff({
    departments: ['Finance', 'Finance Manager', 'Finance Managers'],
    roles: ['staff'],
  })
}

/** Vendors → { id, value, label } */
export async function getVendors({ activeOnly = true } = {}) {
  try {
    const user = await requireAuthenticatedUser('getVendors')
    if (!user) return []

    const orgId = await getScopedOrgId()
    const key = _cacheKey('vendors', { activeOnly, orgId })
    const cached = _getCache(key)
    if (cached) return cached
    const inflight = _getPending(key)
    if (inflight) return inflight
    let q = supabase
      .from('vendors')
      .select('id, name, is_active, phone, email, specialty')
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
    const promise = (async () => {
      const { data } = await q.throwOnError()
      const opts = toOptions(data, 'name')
      _setCache(key, opts)
      return opts
    })()
    _setPending(key, promise)
    try {
      const result = await promise
      return result
    } finally {
      _clearPending(key)
    }
  } catch (e) {
    if (!handleAuthError(e, 'getVendors')) {
      console.error('getVendors error:', e)
    }
    return []
  }
}

/** Products → { id, value, label, unit_price } (label includes brand if present) */
export async function getProducts({ activeOnly = true } = {}) {
  try {
    const user = await requireAuthenticatedUser('getProducts')
    if (!user) return []

    const orgId = await getScopedOrgId()
    const key = _cacheKey('products', { activeOnly, orgId })
    const cached = _getCache(key)
    if (cached) return cached
    const inflight = _getPending(key)
    if (inflight) return inflight
    let q = supabase
      .from('products')
      .select('id, name, brand, unit_price, is_active, op_code, cost, category')
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
    const promise = (async () => {
      const { data } = await q.throwOnError()
      const opts = (data || []).map((p) => ({
        id: p.id,
        value: p.id,
        label: p.brand ? `${p.name} - ${p.brand}` : p.name,
        unit_price: p.unit_price,
      }))
      _setCache(key, opts)
      return opts
    })()
    _setPending(key, promise)
    try {
      const result = await promise
      return result
    } finally {
      _clearPending(key)
    }
  } catch (e) {
    if (!handleAuthError(e, 'getProducts')) {
      console.error('getProducts error:', e)
    }
    return []
  }
}

/** Export for any other page that needs profiles */
export const getUserProfiles = getStaff

/**
 * Global fuzzy search across users, vendors and products.
 * Returns { users: [...], vendors: [...], products: [...] } with option-shaped items.
 */
export async function globalSearch(term) {
  if (!term || !String(term).trim()) return { users: [], vendors: [], products: [] }
  const q = `%${String(term).trim()}%`
  try {
    const user = await requireAuthenticatedUser('globalSearch')
    if (!user) return { users: [], vendors: [], products: [] }

    const orgId = await getScopedOrgId()
    await ensureUserProfileCapsLoaded()
    const caps = getProfileCaps()
    const nameCol = caps.name
      ? 'name'
      : caps.full_name
        ? 'full_name'
        : caps.display_name
          ? 'display_name'
          : 'email'
    const [uData, vData, pData] = await Promise.all([
      (async () => {
        let uq = supabase
          .from('user_profiles')
          .select(['id', nameCol, 'email', 'department', 'role'].filter(Boolean).join(', '))
          .or(
            [nameCol ? `${nameCol}.ilike.${q}` : null, `email.ilike.${q}`].filter(Boolean).join(',')
          )
          .limit(20)
        if (orgId) uq = uq.or(`org_id.eq.${orgId},org_id.is.null`)
        return uq.throwOnError()
      })(),
      (async () => {
        let vq = supabase
          .from('vendors')
          .select('id, name, specialty')
          .or(`name.ilike.${q},specialty.ilike.${q}`)
          .limit(20)
        if (orgId) vq = vq.or(`org_id.eq.${orgId},org_id.is.null`)
        return vq.throwOnError()
      })(),
      (async () => {
        let pq = supabase
          .from('products')
          .select('id, name, brand, unit_price')
          .or(`name.ilike.${q},brand.ilike.${q}`)
          .limit(20)
        if (orgId) pq = pq.or(`org_id.eq.${orgId},org_id.is.null`)
        return pq.throwOnError()
      })(),
    ])

    const users = (uData?.data || uData || []).map((u) => ({
      id: u.id,
      value: u.id,
      label: resolveUserProfileName(u) ?? u.email ?? String(u.id),
      email: u.email,
      department: u.department,
      role: u.role,
    }))
    const vendors = (vData?.data || vData || []).map((v) => ({
      id: v.id,
      value: v.id,
      label: v.name,
      specialty: v.specialty,
    }))
    const products = (pData?.data || pData || []).map((p) => ({
      id: p.id,
      value: p.id,
      label: p.brand ? `${p.name} - ${p.brand}` : p.name,
      unit_price: p.unit_price,
    }))

    return { users, vendors, products }
  } catch (e) {
    if (!handleAuthError(e, 'globalSearch')) {
      console.error('globalSearch error:', e)
    }
    return { users: [], vendors: [], products: [] }
  }
}

// Fire-and-forget prefetch to warm common dropdowns on app load
export async function prefetchDropdowns() {
  try {
    const user = await requireAuthenticatedUser('prefetchDropdowns')
    if (!user) return

    await Promise.all([
      getVendors({ activeOnly: true }),
      getProducts({ activeOnly: true }),
      getSalesConsultants(),
      getFinanceManagers(),
      getDeliveryCoordinators(),
    ])
  } catch (e) {
    // non-fatal
    console.warn('prefetchDropdowns failed:', e)
  }
}

// Utility for tests or troubleshooting to clear the in-memory cache
export function clearDropdownCache() {
  try {
    _cache.clear()
    // Also clear in-flight dedupers so tests don't hang onto prior promises
    if (typeof _pending?.clear === 'function') {
      _pending.clear()
    }
    // Reset org_id cache to allow re-fetch
    _orgIdCache = null
    _orgIdCacheValid = false
    _orgIdPending = null
  } catch {}
}
