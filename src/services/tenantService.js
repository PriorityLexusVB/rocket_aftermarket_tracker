// src/services/tenantService.js
import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import { toOptions } from '@/lib/options'

export async function listVendorsByOrg(orgId, { activeOnly = true } = {}) {
  if (!orgId) return []
  try {
    let q = supabase
      .from('vendors')
      .select('id, name, is_active, phone, email, specialty')
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    q = q.or(`org_id.eq.${orgId},org_id.is.null`)
    const data = await safeSelect(q)
    return toOptions(data, { labelKey: 'name', valueKey: 'id' })
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
    q = q.or(`org_id.eq.${orgId},org_id.is.null`)
    const data = await safeSelect(q)
    // Preserve unit_price on options for auto-fill in forms
    return (Array.isArray(data) ? data : []).map((p) => ({
      ...p,
      ...toOptions([p], { labelKey: 'name', valueKey: 'id' })[0],
      label: p.brand ? `${p.name} - ${p.brand}` : p.name,
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
    const data = await safeSelect(q)
    return (Array.isArray(data) ? data : []).map((u) => ({
      ...u,
      ...toOptions([u], { labelKey: 'full_name', valueKey: 'id' })[0],
    }))
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
    q = q.or(`org_id.eq.${orgId},org_id.is.null`)
    const data = await safeSelect(q)
    return toOptions(data, { labelKey: 'name', valueKey: 'id' })
  } catch (err) {
    console.error('listSmsTemplatesByOrg error:', err?.message || err)
    return []
  }
}
