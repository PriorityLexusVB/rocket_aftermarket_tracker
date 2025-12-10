import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import { toOptions } from '@/lib/options'
// Typed schemas from Drizzle + Zod (Section 20)
// @ts-ignore - using JSDoc for types
import { vendorInsertSchema } from '@/db/schemas'

export async function listVendorsByOrg(orgId) {
  let q = supabase.from('vendors').select('*').order('name', { ascending: true })
  if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
  const rows = await safeSelect(q, 'vendors:listByOrg')
  return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
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
      if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
      const rows = await safeSelect(q, 'vendors:getAll')
      return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
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
      if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
      const rows = await safeSelect(q, 'vendors:search')
      return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
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

  /**
   * Create a new vendor (typed via VendorInsert from drizzle-zod)
   * @param {import('@/db/schemas').VendorInsert} vendorData - Typed vendor data
   * @returns {Promise<{data: any, error: any}>}
   */
  async create(vendorData) {
    try {
      // Validate with Zod schema
      const validated = vendorInsertSchema.parse(vendorData)
      const { data, error } = await supabase
        .from('vendors')
        .insert([validated])
        .select()
        .single()
      return { data, error }
    } catch (e) {
      console.error('vendorService.create failed', e)
      return { data: null, error: e }
    }
  },

  /**
   * Update an existing vendor (typed via VendorInsert from drizzle-zod)
   * @param {string} id - Vendor ID
   * @param {Partial<import('@/db/schemas').VendorInsert>} vendorData - Partial vendor data
   * @returns {Promise<{data: any, error: any}>}
   */
  async update(id, vendorData) {
    try {
      // Validate with Zod schema (partial mode)
      const validated = vendorInsertSchema.partial().parse(vendorData)
      const { data, error } = await supabase
        .from('vendors')
        .update(validated)
        .eq('id', id)
        .select()
        .single()
      return { data, error }
    } catch (e) {
      console.error('vendorService.update failed', e)
      return { data: null, error: e }
    }
  },

  /**
   * Delete a vendor
   * @param {string} id - Vendor ID
   * @returns {Promise<{error: any}>}
   */
  async delete(id) {
    try {
      const { error } = await supabase
        .from('vendors')
        .delete()
        .eq('id', id)
      return { error }
    } catch (e) {
      console.error('vendorService.delete failed', e)
      return { error: e }
    }
  },
}

export default vendorService
