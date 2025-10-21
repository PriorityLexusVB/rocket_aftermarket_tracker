import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

export function listVendorsByOrg(orgId) {
  return safeSelect(
    supabase.from('vendors').select('*').eq('org_id', orgId).order('name', { ascending: true }),
    'vendors:listByOrg'
  )
}

export const vendorService = {
  /**
   * Get all active vendors. If orgId provided, filter by org.
   */
  async getAll(orgId = null) {
    try {
      let q = supabase
        .from('vendors')
        .select('*')
        .eq('is_active', true)
        .order('name', { ascending: true })
      if (orgId) q = q.eq('org_id', orgId)
      return await safeSelect(q, 'vendors:getAll')
    } catch (e) {
      console.error('vendorService.getAll failed', e)
      return []
    }
  },

  /** Search vendors; optional org scoping */
  async search(term, orgId = null) {
    try {
      if (!term?.trim()) return this.getAll(orgId)
      let q = supabase
        .from('vendors')
        .select('*')
        .or(`name.ilike.%${term}%,specialty.ilike.%${term}%,contact_person.ilike.%${term}%`)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(50)
      if (orgId) q = q.eq('org_id', orgId)
      return await safeSelect(q, 'vendors:search')
    } catch (e) {
      console.error('vendorService.search failed', e)
      return []
    }
  },

  /** Get a vendor by id (optionally scoped to org) */
  async getById(id, orgId = null) {
    if (!id) return null
    try {
      let q = supabase
        .from('vendors')
        .select(`*, vendor_hours:vendor_hours(*), products:products(count)`)
        .eq('id', id)
        .single()
      if (orgId) q = q.eq('org_id', orgId)
      const res = await q.throwOnError()
      return res.data
    } catch (e) {
      console.error('vendorService.getById failed', e)
      return null
    }
  },
}

export default vendorService
