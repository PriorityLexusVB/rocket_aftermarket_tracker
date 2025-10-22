// src/services/tenantService.js
import { supabase } from '@/lib/supabase'
import safeSelect from '@/lib/safeSelect'

export async function listVendorsByOrg(orgId, { activeOnly = true } = {}) {
  if (!orgId) return []
  try {
    let q = supabase
      .from('vendors')
      .select('id, name, is_active, phone, email, specialty')
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    q = q.eq('org_id', orgId)
    const res = await safeSelect(q).exec()
    return (res?.data || []).map((v) => ({ id: v.id, value: v.id, label: v.name, ...v }))
  } catch (err) {
    console.error('listVendorsByOrg error:', err?.message || err)
    return []
  }
}

export async function listProductsByOrg(orgId, { activeOnly = true } = {}) {
  if (!orgId) return []
  try {
    let q = supabase
      .from('products')
      .select('id, name, brand, unit_price, is_active, op_code, cost, category')
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    q = q.eq('org_id', orgId)
    const res = await safeSelect(q).exec()
    return (res?.data || []).map((p) => ({
      id: p.id,
      value: p.id,
      label: p.brand ? `${p.name} - ${p.brand}` : p.name,
      unit_price: p.unit_price,
      ...p,
    }))
  } catch (err) {
    console.error('listProductsByOrg error:', err?.message || err)
    return []
  }
}

export async function listStaffByOrg(
  orgId,
  { departments = [], roles = [], activeOnly = true } = {}
) {
  if (!orgId) return []
  try {
    let q = supabase
      .from('user_profiles')
      .select('id, full_name, email, department, role, is_active, vendor_id')
      .order('full_name', { ascending: true })
    q = q.eq('org_id', orgId)
    if (activeOnly) q = q.eq('is_active', true)
    if (departments.length) q = q.in('department', departments)
    if (roles.length) q = q.in('role', roles)
    const res = await safeSelect(q).exec()
    return (res?.data || []).map((u) => ({ id: u.id, value: u.id, label: u.full_name, ...u }))
  } catch (err) {
    console.error('listStaffByOrg error:', err?.message || err)
    return []
  }
}

export async function listSmsTemplatesByOrg(orgId, { activeOnly = true } = {}) {
  if (!orgId) return []
  try {
    let q = supabase
      .from('sms_templates')
      .select('id, name, body, is_active')
      .order('created_at', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    q = q.eq('org_id', orgId)
    const res = await safeSelect(q).exec()
    return (res?.data || []).map((s) => ({ id: s.id, value: s.id, label: s.name, ...s }))
  } catch (err) {
    console.error('listSmsTemplatesByOrg error:', err?.message || err)
    return []
  }
}
