// src/services/dropdownService.js
import { supabase } from '@/lib/supabase'

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
  // 1) exact filter by department/role
  let q = supabase
    .from('user_profiles')
    .select('id, full_name, email, department, role, is_active, vendor_id', { count: 'exact' })
    .order('full_name', { ascending: true })

  if (activeOnly) q = q.eq('is_active', true)
  if (departments.length) q = q.in('department', departments)
  if (roles.length) q = q.in('role', roles)

  try {
    const { data: exact, count } = await q.throwOnError()
    if ((count ?? 0) > 0) return toOptions(exact, 'full_name')
    // if no exact results and no filters provided, just return whatever we have
    if (!departments.length && !roles.length) return toOptions(exact || [], 'full_name')
  } catch (err) {
    // fallthrough to fuzzy attempt but log loudly
    console.error('getStaff exact query failed:', { err, departments, roles })
  }

  // 2) fuzzy fallback if exact returns zero
  const fuzzTerms = [...departments, ...roles].map((s) => s.trim()).filter(Boolean)
  const ors = fuzzTerms
    .map((t) => `department.ilike.%${t}%,role.ilike.%${t}%,full_name.ilike.%${t}%`)
    .join(',')

  try {
    const { data: fuzzy } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, department, role, is_active, vendor_id')
      .eq('is_active', true)
      .or(ors || 'full_name.ilike.%')
      .order('full_name', { ascending: true })
      .throwOnError()
    return toOptions(fuzzy || [], 'full_name')
  } catch (err) {
    console.error('getStaff fuzzy query failed:', { err, departments, roles })
    return []
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
    let q = supabase
      .from('vendors')
      .select('id, name, is_active, phone, email, specialty')
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    const { data } = await q.throwOnError()
    return toOptions(data, 'name')
  } catch (e) {
    console.error('getVendors error:', e)
    return []
  }
}

/** Products → { id, value, label, unit_price } (label includes brand if present) */
export async function getProducts({ activeOnly = true } = {}) {
  try {
    let q = supabase
      .from('products')
      .select('id, name, brand, unit_price, is_active, op_code, cost, category')
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    const { data } = await q.throwOnError()
    return (data || []).map((p) => ({
      id: p.id,
      value: p.id,
      label: p.brand ? `${p.name} - ${p.brand}` : p.name,
      unit_price: p.unit_price,
    }))
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
    const [uData, vData, pData] = await Promise.all([
      supabase
        .from('user_profiles')
        .select('id, full_name, email, department, role')
        .or(`full_name.ilike.${q},email.ilike.${q}`)
        .limit(20)
        .throwOnError(),
      supabase
        .from('vendors')
        .select('id, name, specialty')
        .or(`name.ilike.${q},specialty.ilike.${q}`)
        .limit(20)
        .throwOnError(),
      supabase
        .from('products')
        .select('id, name, brand, unit_price')
        .or(`name.ilike.${q},brand.ilike.${q}`)
        .limit(20)
        .throwOnError(),
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
