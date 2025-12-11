import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import { toOptions } from '@/lib/options'
import { z } from 'zod'
// Typed schemas from Drizzle + Zod (Section 20)
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
   * Get all vendors (active and inactive) for management UI
   * Section 20: Typed service layer
   * @param {string|null} orgId - Optional org filter
   * @returns {Promise<Array>} Array of vendor records
   */
  async getAllVendors(orgId = null) {
    try {
      let q = supabase.from('vendors').select('*').order('name', { ascending: true })
      if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
      const { data, error } = await q
      if (error) throw error
      return data || []
    } catch (e) {
      console.error('vendorService.getAllVendors failed', e)
      throw e
    }
  },

  /**
   * Create a new vendor (Section 20: Typed with VendorInsert)
   * @param {import('@/db/schemas').VendorInsert} input - Vendor data
   * @returns {Promise<Object>} Created vendor record
   */
  async createVendor(input) {
    try {
      // Convert camelCase to snake_case for database
      const dbInput = {
        name: input.name,
        contact_person: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        specialty: input.specialty || null,
        rating: input.rating || null,
        is_active: input.isActive !== undefined ? input.isActive : true,
        notes: input.notes || null,
        org_id: input.orgId || null,
      }

      const { data, error } = await supabase
        .from('vendors')
        .insert(dbInput)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (e) {
      console.error('vendorService.createVendor failed', e)
      throw e
    }
  },

  /**
   * Update an existing vendor (Section 20: Typed with VendorInsert)
   * @param {string} id - Vendor ID
   * @param {import('@/db/schemas').VendorInsert} input - Updated vendor data
   * @returns {Promise<Object>} Updated vendor record
   */
  async updateVendor(id, input) {
    try {
      // Convert camelCase to snake_case for database
      const dbInput = {
        name: input.name,
        contact_person: input.contactPerson || null,
        email: input.email || null,
        phone: input.phone || null,
        address: input.address || null,
        specialty: input.specialty || null,
        rating: input.rating || null,
        is_active: input.isActive !== undefined ? input.isActive : true,
        notes: input.notes || null,
        org_id: input.orgId || null,
      }

      const { data, error } = await supabase
        .from('vendors')
        .update(dbInput)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (e) {
      console.error('vendorService.updateVendor failed', e)
      throw e
    }
  },

  /**
   * Delete a vendor
   * @param {string} id - Vendor ID
   * @returns {Promise<void>}
   */
  async deleteVendor(id) {
    try {
      const { error } = await supabase.from('vendors').delete().eq('id', id)
      if (error) throw error
    } catch (e) {
      console.error('vendorService.deleteVendor failed', e)
      throw e
    }
  },

  /**
   * Bulk update vendors (activate/deactivate)
   * @param {Array<string>} vendorIds - Array of vendor IDs
   * @param {Object} updates - Fields to update (e.g., { is_active: true })
   * @returns {Promise<void>}
   */
  async bulkUpdateVendors(vendorIds, updates) {
    try {
      const { error } = await supabase
        .from('vendors')
        .update(updates)
        .in('id', vendorIds)

      if (error) throw error
    } catch (e) {
      console.error('vendorService.bulkUpdateVendors failed', e)
      throw e
    }
  },
}

export default vendorService
