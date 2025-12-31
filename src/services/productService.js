import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import { toOptions } from '@/lib/options'

// Tenant-aware list for dropdowns and consumers
export async function listProductsByOrg(orgId, { activeOnly = true } = {}) {
  let q = supabase
    .from('products')
    .select('id, name, brand, unit_price, is_active, op_code, cost, category')
    .order('name', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
  const rows = await safeSelect(q, 'products:listByOrg')
  return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
}

export const productService = {
  async list({ orgId = null, activeOnly = true } = {}) {
    let q = supabase
      .from('products')
      .select('id, name, brand, unit_price, is_active, op_code, cost, category')
      .order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
    const rows = await safeSelect(q, 'products:list')
    return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
  },

  async getById(id, orgId = null) {
    if (!id) return null
    try {
      let q = supabase.from('products').select('*').eq('id', id).single()
      if (orgId) q = q.eq('org_id', orgId)
      const res = await q.throwOnError()
      return res?.data ?? null
    } catch (e) {
      console.error('[products:getById] failed', e)
      return null
    }
  },
}

export default productService
