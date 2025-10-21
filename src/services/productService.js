import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

// Tenant-aware list for dropdowns and consumers
export function listProductsByOrg(orgId, { activeOnly = true } = {}) {
  let q = supabase.from('products').select('*').order('name', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.eq('org_id', orgId)
  return safeSelect(q, 'products:listByOrg')
}

export const productService = {
  async list({ orgId = null, activeOnly = true } = {}) {
    let q = supabase.from('products').select('*').order('name', { ascending: true })
    if (activeOnly) q = q.eq('is_active', true)
    if (orgId) q = q.eq('org_id', orgId)
    return await safeSelect(q, 'products:list')
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
