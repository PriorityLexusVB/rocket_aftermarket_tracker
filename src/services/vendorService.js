import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import { toOptions } from '@/lib/options'
import { z } from 'zod'
// Typed schemas from Drizzle + Zod (Section 20)
import { vendorInsertSchema } from '@/db/schemas'

/**
 * Simple helper used by dropdowns to get vendor options
 */
export async function listVendorsByOrg(orgId) {
  let q = supabase
    .from('vendors')
    .select('id, name, is_active, phone, email, specialty')
    .order('name', { ascending: true })

  if (orgId) {
    q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)
  }

  const rows = await safeSelect(q, 'vendors:listByOrg')
  return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
}

/**
 * Lightweight vendor list for scheduling/filters (raw rows, not options).
 */
export async function listActiveVendorsLite() {
  try {
    const q = supabase
      ?.from('vendors')
      ?.select('id, name, is_active, specialty')
      ?.eq('is_active', true)
      ?.order('name', { ascending: true })

    const rows = await safeSelect(q, 'vendors:listActiveVendorsLite')
    return rows || []
  } catch (e) {
    console.error('listActiveVendorsLite failed', e)
    return []
  }
}

/**
 * Internal helpers to centralize Supabase writes
 * These throw on error and return the row data.
 */

async function doCreateVendor(parsedInput) {
  const tenantId = parsedInput.dealerId ?? parsedInput.orgId ?? null
  const dbInput = {
    name: parsedInput.name,
    contact_person: parsedInput.contactPerson || null,
    email: parsedInput.email || null,
    phone: parsedInput.phone || null,
    address: parsedInput.address || null,
    specialty: parsedInput.specialty || null,
    rating: parsedInput.rating ?? null,
    is_active: parsedInput.isActive !== undefined ? parsedInput.isActive : true,
    notes: parsedInput.notes || null,
    dealer_id: tenantId,
  }

  const { data, error } = await supabase.from('vendors').insert(dbInput).select().single()

  if (error) throw error
  return data
}

async function doUpdateVendor(id, parsedInput) {
  const tenantId = parsedInput.dealerId ?? parsedInput.orgId ?? null
  const dbInput = {
    name: parsedInput.name,
    contact_person: parsedInput.contactPerson || null,
    email: parsedInput.email || null,
    phone: parsedInput.phone || null,
    address: parsedInput.address || null,
    specialty: parsedInput.specialty || null,
    rating: parsedInput.rating ?? null,
    is_active: parsedInput.isActive !== undefined ? parsedInput.isActive : true,
    notes: parsedInput.notes || null,
    dealer_id: tenantId,
  }

  const { data, error } = await supabase
    .from('vendors')
    .update(dbInput)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error
  return data
}

async function doDeleteVendor(id) {
  const { data: deleted, error } = await supabase.from('vendors').delete().eq('id', id).select('id')

  if (error) throw error

  if (Array.isArray(deleted) && deleted.length === 0) {
    const { data: stillThere, error: checkErr } = await supabase
      .from('vendors')
      .select('id')
      .eq('id', id)
      .limit(1)

    if (checkErr) throw checkErr
    if (Array.isArray(stillThere) && stillThere.length > 0) {
      throw new Error('Delete was blocked by permissions (RLS).')
    }
  }
}

export const vendorService = {
  /**
   * Get all active vendors. If orgId provided, filter by org.
   */
  async getAll(orgId = null) {
    try {
      let q = supabase
        .from('vendors')
        .select('id, name, is_active, phone, email, specialty')
        .eq('is_active', true)
        .order('name', { ascending: true })

      if (orgId) {
        q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)
      }

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
        .select('id, name, is_active, phone, email, specialty')
        .or(`name.ilike.%${term}%,specialty.ilike.%${term}%,contact_person.ilike.%${term}%`)
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(50)

      if (orgId) {
        q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)
      }

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

      if (orgId) {
        q = q.eq('dealer_id', orgId)
      }

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

      if (orgId) {
        q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)
      }

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
   * Used by admin UI. Throws on validation or DB errors.
   * @param {import('@/db/schemas').VendorInsert} input - Vendor data
   * @returns {Promise<Object>} Created vendor record
   */
  async createVendor(input) {
    try {
      // Validate + normalize via Zod
      const parsed = vendorInsertSchema.parse(input)
      return await doCreateVendor(parsed)
    } catch (e) {
      console.error('vendorService.createVendor failed', e)
      throw e
    }
  },

  /**
   * Update an existing vendor (Section 20: Typed with VendorInsert)
   * Used by admin UI. Throws on validation or DB errors.
   * @param {string} id - Vendor ID
   * @param {import('@/db/schemas').VendorInsert} input - Updated vendor data
   * @returns {Promise<Object>} Updated vendor record
   */
  async updateVendor(id, input) {
    try {
      // Validate + normalize via Zod (full payload)
      const parsed = vendorInsertSchema.parse(input)
      return await doUpdateVendor(id, parsed)
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
      await doDeleteVendor(id)
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
      const ids = Array.isArray(vendorIds) ? vendorIds.filter(Boolean) : []
      if (!ids.length) return

      const { data: updated, error } = await supabase
        .from('vendors')
        .update(updates)
        .in('id', ids)
        .select('id')

      if (error) throw error

      // Under RLS, UPDATE may succeed with 0 rows affected; detect and surface a clear error.
      if (Array.isArray(updated) && updated.length === 0) {
        const { data: stillThere, error: checkErr } = await supabase
          .from('vendors')
          .select('id')
          .in('id', ids)
          .limit(1)

        if (checkErr) throw checkErr
        if (Array.isArray(stillThere) && stillThere.length > 0) {
          throw new Error('Update was blocked by permissions (RLS).')
        }

        throw new Error('No vendors found for the provided ids.')
      }
    } catch (e) {
      console.error('vendorService.bulkUpdateVendors failed', e)
      throw e
    }
  },

  /**
   * Typed create() wrapper returning { data, error }
   * (maintains compatibility with the Drizzle/Zod service pattern)
   * @param {import('@/db/schemas').VendorInsert} vendorData
   * @returns {Promise<{data: any, error: any}>}
   */
  async create(vendorData) {
    try {
      const data = await this.createVendor(vendorData)
      return { data, error: null }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return {
          data: null,
          error: {
            message: 'Validation failed: ' + e.errors.map((err) => err.message).join(', '),
            details: e.errors,
          },
        }
      }
      console.error('vendorService.create failed', e)
      return { data: null, error: e }
    }
  },

  /**
   * Typed update() wrapper returning { data, error }
   * @param {string} id
   * @param {Partial<import('@/db/schemas').VendorInsert>} vendorData
   * @returns {Promise<{data: any, error: any}>}
   */
  async update(id, vendorData) {
    try {
      // Allow partial payloads in this wrapper
      const partialSchema = vendorInsertSchema.partial()
      const parsed = partialSchema.parse(vendorData)
      const data = await doUpdateVendor(id, parsed)
      return { data, error: null }
    } catch (e) {
      if (e instanceof z.ZodError) {
        return {
          data: null,
          error: {
            message: 'Validation failed: ' + e.errors.map((err) => err.message).join(', '),
            details: e.errors,
          },
        }
      }
      console.error('vendorService.update failed', e)
      return { data: null, error: e }
    }
  },

  /**
   * delete() wrapper returning { error }
   * @param {string} id
   * @returns {Promise<{error: any}>}
   */
  async delete(id) {
    try {
      await this.deleteVendor(id)
      return { error: null }
    } catch (e) {
      console.error('vendorService.delete failed', e)
      return { error: e }
    }
  },
}

export default vendorService
