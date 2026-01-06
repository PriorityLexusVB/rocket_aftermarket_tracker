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
  if (orgId) q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)
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
    if (orgId) q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)
    const rows = await safeSelect(q, 'products:list')
    return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
  },

  /**
   * Raw product rows (not option-shaped). Useful for UIs that need cost/vendor fields.
   * Returns { data, error }.
   */
  async listRaw({ orgId = null, activeOnly = true } = {}) {
    try {
      let q = supabase.from('products').select('*').order('name', { ascending: true })
      if (activeOnly) q = q.eq('is_active', true)
      if (orgId) q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)

      const rows = await safeSelect(q, 'products:listRaw')
      return { data: rows || [], error: null }
    } catch (error) {
      console.error('[products:listRaw] failed', error)
      return { data: [], error: { message: error?.message || 'Failed to load products' } }
    }
  },

  async getById(id, orgId = null) {
    if (!id) return null
    try {
      let q = supabase.from('products').select('*').eq('id', id).single()
      if (orgId) q = q.eq('dealer_id', orgId)
      const res = await q.throwOnError()
      return res?.data ?? null
    } catch (e) {
      console.error('[products:getById] failed', e)
      return null
    }
  },
}

export default productService
