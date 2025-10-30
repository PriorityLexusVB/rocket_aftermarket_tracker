// src/services/jobService.js
import { supabase } from '@/lib/supabase'

const nowIso = () => new Date()?.toISOString()

async function run(query) {
  const { data, error } = await query
  if (error) throw error
  return data ?? null
}

// Try an expanded jobs select; on failure, fall back to basic "*"
async function selectJobs(baseQuery) {
  // Attempt expanded with safe wildcards for relations
  try {
    const data = await run(
      baseQuery?.select(`
        *,
        vendor:vendors(id,name,specialty,contact_person,phone,email),
        vehicle:vehicles(*),
        assigned_to_profile:user_profiles!jobs_assigned_to_fkey(id,full_name,email,role),
        created_by_profile:user_profiles!jobs_created_by_fkey(id,full_name,email),
        delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey(id,full_name,email),
        job_parts(*)
      `)
    )
    return data ?? []
  } catch (expandedErr) {
    console.warn('Expanded jobs select failed, falling back to "*":', expandedErr?.message)
    const basic = await run(baseQuery?.select('*'))
    return basic ?? []
  }
}

// Insert job_parts with multiple safe “shapes” to avoid missing-column errors
async function insertLineItems(jobId, items = []) {
  if (!jobId || !Array.isArray(items) || items?.length === 0) return

  // Normalize incoming line items to a minimal format
  const normalized = items?.map((it) => ({
    job_id: jobId,
    product_id: it?.product_id ?? it?.productId ?? null,
    quantity_used: it?.quantity_used ?? it?.quantity ?? 1,
    unit_price: it?.unit_price ?? it?.price ?? it?.unit_cost ?? null,
    // description intentionally omitted by default to avoid "does not exist"
  }))

  // Candidate shapes from richer -> minimal (we try until one works)
  const shapes = [
    (it) => ({
      job_id: it?.job_id,
      product_id: it?.product_id,
      quantity_used: it?.quantity_used,
      unit_price: it?.unit_price,
    }),
    (it) => ({
      job_id: it?.job_id,
      product_id: it?.product_id,
      quantity_used: it?.quantity_used,
    }),
    (it) => ({
      job_id: it?.job_id,
      quantity_used: it?.quantity_used,
    }),
  ]

  let lastErr = null
  for (const shape of shapes) {
    try {
      const payload = normalized?.map(shape)
      const { error } = await supabase?.from('job_parts')?.insert(payload)
      if (error) throw error
      // success
      return
    } catch (err) {
      lastErr = err
      // Try next shape
    }
  }
  // If none of the shapes worked, bubble a concise error
  throw new Error(`Failed to insert line items: ${lastErr?.message || lastErr || 'unknown error'}`)
}

export const jobService = {
  /**
   * List jobs (with optional filters)
   *  - filters: { status, vendorId, vehicleId, search, limit }
   */
  async getAllJobs(filters = {}) {
    try {
      let q = supabase?.from('jobs')

      if (filters?.status) q = q?.eq('job_status', filters?.status)
      if (filters?.vendorId) q = q?.eq('vendor_id', filters?.vendorId)
      if (filters?.vehicleId) q = q?.eq('vehicle_id', filters?.vehicleId)
      // Optional multi-tenant scoping when jobs.org_id exists
      if (filters?.orgId) q = q?.eq('org_id', filters?.orgId)
      if (filters?.search) {
        const s = filters?.search?.trim()
        if (s) q = q?.or(`title.ilike.%${s}%,description.ilike.%${s}%,job_number.ilike.%${s}%`)
      }
      q = q?.order('created_at', { ascending: false })
      if (filters?.limit) q = q?.limit(filters?.limit)

      const data = await selectJobs(q)
      return data ?? []
    } catch (err) {
      console.error('[jobs] getAllJobs failed:', err?.message || err)
      return []
    }
  },

  /**
   * Get a single job by id
   */
  async getJobById(id) {
    if (!id) return null
    try {
      const rows = await selectJobs(supabase?.from('jobs')?.eq('id', id)?.limit(1))
      return rows?.[0] ?? null
    } catch (err) {
      console.error('[jobs] getJobById failed:', err?.message || err)
      return null
    }
  },

  /**
   * Create a job with optional line items
   *  - dealData example:
   *    { title, description, vendor_id, vehicle_id, priority, job_status, scheduled_start_time, scheduled_end_time, lineItems: [...] }
   */
  async createJob(dealData = {}) {
    // Optional: try to get a job number via RPC if your DB has it
    let jobNumber = null
    try {
      const { data: num, error: numErr } = await supabase?.rpc('generate_job_number')
      if (!numErr) jobNumber = num
    } catch (_) {
      // ignore if missing
    }

    try {
      // Current user (if auth enabled)
      let createdBy = null
      try {
        const { data: userRes, error: userErr } = await supabase?.auth?.getUser()
        if (!userErr && userRes?.user) createdBy = userRes?.user?.id ?? null
      } catch (_) {}

      const payload = {
        title: dealData?.title ?? '',
        description: dealData?.description ?? '',
        vendor_id: dealData?.vendor_id ?? null,
        vehicle_id: dealData?.vehicle_id ?? null,
        priority: dealData?.priority ?? null,
        job_status: dealData?.job_status ?? 'new',
        job_number: jobNumber ?? dealData?.job_number ?? null,
        scheduled_start_time: dealData?.scheduled_start_time ?? null,
        scheduled_end_time: dealData?.scheduled_end_time ?? null,
        location: dealData?.location ?? null,
        created_by: createdBy,
        created_at: nowIso(),
        updated_at: nowIso(),
      }

      const { data: created, error: jobErr } = await supabase
        ?.from('jobs')
        ?.insert([payload])
        ?.select()
        ?.single()
      if (jobErr) throw jobErr

      // Line items (best-effort)
      if (Array.isArray(dealData?.lineItems) && dealData?.lineItems?.length > 0) {
        try {
          await insertLineItems(created?.id, dealData?.lineItems)
        } catch (liErr) {
          // rollback to avoid orphan job
          await supabase?.from('jobs')?.delete()?.eq('id', created?.id)
          throw liErr
        }
      }

      return created
    } catch (err) {
      console.error('[jobs] createJob failed:', err?.message || err)
      throw new Error(`Failed to create job: ${err?.message || err}`)
    }
  },

  /**
   * Update a job; optionally replace line items
   */
  async updateJob(jobId, dealData = {}) {
    if (!jobId) throw new Error('Job ID is required')

    try {
      const update = {
        title: dealData?.title,
        description: dealData?.description,
        vendor_id: dealData?.vendor_id,
        vehicle_id: dealData?.vehicle_id,
        priority: dealData?.priority,
        job_status: dealData?.job_status,
        scheduled_start_time: dealData?.scheduled_start_time,
        scheduled_end_time: dealData?.scheduled_end_time,
        location: dealData?.location,
        updated_at: nowIso(),
      }

      // Strip undefined to avoid writing nulls accidentally
      Object.keys(update)?.forEach((k) => update?.[k] === undefined && delete update?.[k])

      const { data: updated, error: jobErr } = await supabase
        ?.from('jobs')
        ?.update(update)
        ?.eq('id', jobId)
        ?.select()
        ?.single()
      if (jobErr) throw jobErr

      // Replace line items if provided
      if (dealData?.lineItems !== undefined) {
        // Delete existing first
        const { error: delErr } = await supabase?.from('job_parts')?.delete()?.eq('job_id', jobId)
        if (delErr) throw delErr

        if (Array.isArray(dealData?.lineItems) && dealData?.lineItems?.length > 0) {
          await insertLineItems(jobId, dealData?.lineItems)
        }
      }

      return updated
    } catch (err) {
      console.error('[jobs] updateJob failed:', err?.message || err)
      throw new Error(`Failed to update job: ${err?.message || err}`)
    }
  },

  /**
   * Update only the job status (and optional timestamps like completed_at)
   */
  async updateStatus(jobId, status, extra = {}) {
    if (!jobId) throw new Error('Job ID is required')

    const update = {
      job_status: status,
      updated_at: nowIso(),
      ...extra,
    }

    try {
      const { data, error } = await supabase
        ?.from('jobs')
        ?.update(update)
        ?.eq('id', jobId)
        ?.select()
        ?.single()
      if (error) throw error
      return data
    } catch (err) {
      console.error('[jobs] updateStatus failed:', err?.message || err)
      throw new Error(`Failed to update status: ${err?.message || err}`)
    }
  },

  /**
   * Delete a job (and its line items first)
   */
  async deleteJob(jobId) {
    if (!jobId) throw new Error('Job ID is required')

    try {
      const { error: partsErr } = await supabase?.from('job_parts')?.delete()?.eq('job_id', jobId)
      if (partsErr) throw partsErr

      const { error } = await supabase?.from('jobs')?.delete()?.eq('id', jobId)
      if (error) throw error

      return true
    } catch (err) {
      console.error('[jobs] deleteJob failed:', err?.message || err)
      throw new Error(`Failed to delete job: ${err?.message || err}`)
    }
  },

  /**
   * Quick helpers
   */
  async assignVendor(jobId, vendorId) {
    return this.updateJob(jobId, { vendor_id: vendorId })
  },

  async assignUser(jobId, userId) {
    return this.updateJob(jobId, { assigned_to: userId })
  },

  async getRecentJobs(limit = 20) {
    return this.getAllJobs({ limit })
  },
}

// Named exports for back-compat
export const getAllDeals = jobService?.getAllJobs // if other code still imports "deals"
export const getDealById = jobService?.getJobById
export const createDeal = jobService?.createJob
export const updateDeal = jobService?.updateJob
export const deleteDeal = jobService?.deleteJob
export const updateStatus = jobService?.updateStatus

export default jobService
