// src/services/dropdownService.js
import { supabase } from '../lib/supabase'

async function getStaff({ departments = [], roles = [], activeOnly = true } = {}) {
  let query = supabase
    .from('user_profiles')
    .select('id, full_name, email, department, role, is_active, vendor_id', { count: 'exact' })

  if (activeOnly) query = query.eq('is_active', true)
  if (departments.length) query = query.in('department', departments)
  if (roles.length) query = query.in('role', roles)

  const { data: exact, error: exactErr, count } = await query.order('full_name', { ascending: true })
  if (!exactErr && (count ?? 0) > 0) return exact || []

  // Fallback fuzzy OR for department/role/name
  if (!departments.length && !roles.length) return exact || []
  const fuzzTerms = [...departments, ...roles].map((t) => t.trim()).filter(Boolean)
  const ors = fuzzTerms
    .map((t) => `department.ilike.%${t}%,role.ilike.%${t}%,full_name.ilike.%${t}%`)
    .join(',')

  const { data: fuzzy, error: fuzzyErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, email, department, role, is_active, vendor_id')
    .eq('is_active', true)
    .or(ors || 'full_name.ilike.%')
    .order('full_name', { ascending: true })

  if (fuzzyErr) {
    console.error('getStaff fuzzy error:', { fuzzyErr, departments, roles })
    return exact || []
  }
  return (fuzzy || []).length ? fuzzy : (exact || [])
}

export async function getSalesConsultants() {
  return getStaff({ departments: ['Sales', 'Sales Consultant', 'Sales Consultants'] })
}
export async function getDeliveryCoordinators() {
  return getStaff({ departments: ['Delivery', 'Delivery Coordinator', 'Delivery Coordinators'] })
}
export async function getFinanceManagers() {
  return getStaff({ departments: ['Finance', 'Finance Manager', 'Finance Managers'] })
}

export async function getVendors({ activeOnly = true } = {}) {
  try {
    let q = supabase
      .from('vendors')
      .select('id, name, specialty, email, phone, is_active, contact_person, notes')
    if (activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q.order('name', { ascending: true })
    if (error) throw error
    return (data || []).map((v) => ({
      id: v.id,
      value: v.id,
      label: v.name,
      name: v.name,
      specialty: v.specialty,
      email: v.email,
      phone: v.phone,
      contact_person: v.contact_person,
      notes: v.notes
    }))
  } catch (e) {
    console.error('getVendors error:', e)
    return []
  }
}

export async function getProducts({ activeOnly = true } = {}) {
  try {
    let q = supabase
      .from('products')
      .select('id, name, category, unit_price, cost, brand, op_code, is_active, vendor_id')
    if (activeOnly) q = q.eq('is_active', true)
    const { data, error } = await q.order('name', { ascending: true })
    if (error) throw error
    return (data || []).map((p) => ({
      id: p.id,
      value: p.id,
      label: `${p.name}${p.brand ? ` - ${p.brand}` : ''}`,
      name: p.name,
      category: p.category,
      unit_price: p.unit_price,
      cost: p.cost,
      brand: p.brand,
      op_code: p.op_code,
      vendor_id: p.vendor_id
    }))
  } catch (e) {
    console.error('getProducts error:', e)
    return []
  }
}

export const getUserProfiles = getStaff
