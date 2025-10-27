// src/services/dropdownService.js
import { supabase } from '@/lib/supabase'

// Simple in-memory cache with TTL to speed dropdowns
const CACHE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const _cache = new Map()
// Track in-flight fetches to dedupe parallel requests
const _pending = new Map()

function _cacheKey(base, extras = {}) {
  const suffix = Object.entries(extras)
    .filter(([_, v]) => v !== undefined && v !== null)
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
let _orgIdCache = null
let _orgIdPending = null
async function getScopedOrgId() {
  if (_orgIdCache) return _orgIdCache
  if (_orgIdPending) return _orgIdPending
  _orgIdPending = (async () => {
    try {
      const { data: auth } = await supabase?.auth?.getUser?.()
      const userId = auth?.user?.id
      if (!userId) return null
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('org_id')
        .eq('id', userId)
        .single()
      _orgIdCache = prof?.org_id || null
      return _orgIdCache
    } catch (e) {
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
function toOptions(list, labelKeyA = 'name', labelKeyB = 'full_name') {
  return (list || []).map((r) => ({
    id: r.id,
    value: r.id,
    label: r[labelKeyA] ?? r[labelKeyB] ?? String(r.id),
  }))
}

/**
 * Staff fetcher with exact-first, fuzzy-fallback by departments/roles.
 * Uses user_profiles saved via Admin page (department/role/is_active).
 */
async function getStaff({ departments = [], roles = [], activeOnly = true } = {}) {
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
    // 1) exact filter by department/role
    let q = supabase
      .from('user_profiles')
      .select('id, full_name, email, department, role, is_active, vendor_id', { count: 'exact' })
      .order('full_name', { ascending: true })

    if (activeOnly) q = q.eq('is_active', true)
    if (departments.length) q = q.in('department', departments)
    if (roles.length) q = q.in('role', roles)
    if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)

    try {
      const { data: exact, count } = await q.throwOnError()
      if ((count ?? 0) > 0) {
        const opts = toOptions(exact, 'full_name')
        _setCache(key, opts)
        return opts
      }
      // if no exact results and no filters provided, just return whatever we have
      if (!departments.length && !roles.length) return toOptions(exact || [], 'full_name')
    } catch (err) {
      // fallthrough to fuzzy attempt but log loudly
      console.error('getStaff exact query failed:', { err, departments, roles })
    }

    // 2) fuzzy fallback if exact returns zero
    const fuzzTerms = [...departments, ...roles].map((s) => s.trim()).filter(Boolean)
    // Important: do not use ilike on enum columns (role). Some environments store role as an enum,
    // which doesn't support ILIKE. Restrict fuzzy matching to text columns only.
    const ors = fuzzTerms.map((t) => `department.ilike.%${t}%,full_name.ilike.%${t}%`).join(',')

    try {
      let q2 = supabase
        .from('user_profiles')
        .select('id, full_name, email, department, role, is_active, vendor_id')
        .eq('is_active', true)
        // Only apply OR when we have filters; otherwise skip fuzzy query
        .or(ors || 'full_name.ilike.%placeholder%')
        .order('full_name', { ascending: true })

      if (orgId) q2 = q2.or(`org_id.eq.${orgId},org_id.is.null`)

      const { data: fuzzy } = await q2.throwOnError()
      const opts = toOptions(fuzzy || [], 'full_name')
      _setCache(key, opts)
      return opts
    } catch (err) {
      console.error('getStaff fuzzy query failed:', { err, departments, roles })
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
  return getStaff({ departments: ['Sales', 'Sales Consultant', 'Sales Consultants'] })
}
export async function getDeliveryCoordinators() {
  return getStaff({ departments: ['Delivery', 'Delivery Coordinator', 'Delivery Coordinators'] })
}
export async function getFinanceManagers() {
  return getStaff({ departments: ['Finance', 'Finance Manager', 'Finance Managers'] })
}

/** Vendors → { id, value, label } */
export async function getVendors({ activeOnly = true } = {}) {
  try {
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
    console.error('getVendors error:', e)
    return []
  }
}

/** Products → { id, value, label, unit_price } (label includes brand if present) */
export async function getProducts({ activeOnly = true } = {}) {
  try {
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
    console.error('getProducts error:', e)
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
    const orgId = await getScopedOrgId()
    const [uData, vData, pData] = await Promise.all([
      (async () => {
        let uq = supabase
          .from('user_profiles')
          .select('id, full_name, email, department, role')
          .or(`full_name.ilike.${q},email.ilike.${q}`)
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
      label: u.full_name,
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
    console.error('globalSearch error:', e)
    return { users: [], vendors: [], products: [] }
  }
}

// Fire-and-forget prefetch to warm common dropdowns on app load
export async function prefetchDropdowns() {
  try {
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
  } catch {}
}
