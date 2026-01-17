// src/services/jobService.js
import { supabase } from '@/lib/supabase'
import { buildUserProfileSelectFragment, resolveUserProfileName } from '@/utils/userProfileName'
import { toDateInputValue } from '@/utils/dateTimeUtils'
import { syncJobPartsForJob } from './jobPartsService'
import { z } from 'zod'
// Typed schemas from Drizzle + Zod (Section 20)
import { jobInsertSchema } from '@/db/schemas'

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
    const profileFrag = buildUserProfileSelectFragment()
    const { data, error } = await baseQuery?.select(`
        *,
        vendor:vendors(id,name,specialty,contact_person,phone,email),
        vehicle:vehicles(*),
        assigned_to_profile:user_profiles!jobs_assigned_to_fkey${profileFrag},
        created_by_profile:user_profiles!jobs_created_by_fkey${profileFrag},
        delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey${profileFrag},
        job_parts(id,product_id,vendor_id,unit_price,quantity_used,promised_date,scheduled_start_time,scheduled_end_time,requires_scheduling,no_schedule_reason,is_off_site,vendor:vendors(id,name),product:products(id,name,op_code,category,brand,vendor_id))
      `)

    if (error) {
      // Log detailed error info for debugging
      console.warn('[jobService] Expanded select failed, using fallback:', {
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
      })
      // Run a basic select to surface actionable errors instead of silently masking them
      const fallback = await run(baseQuery?.select('*'))
      return fallback ?? []
    }

    const rows = data ?? []
    // Attach display_name resolution for convenience
    return rows.map((r) => {
      if (r?.assigned_to_profile) {
        r.assigned_to_profile.display_name = resolveUserProfileName(r.assigned_to_profile)
      }
      if (r?.created_by_profile) {
        r.created_by_profile.display_name = resolveUserProfileName(r.created_by_profile)
      }
      if (r?.delivery_coordinator) {
        r.delivery_coordinator.display_name = resolveUserProfileName(r.delivery_coordinator)
      }
      return r
    })
  } catch (expandedErr) {
    // Catch any unexpected errors (not from Supabase query itself)
    console.error('[jobService] selectJobs failed:', expandedErr?.message)
    throw expandedErr
  }
}

export const jobService = {
  /**
   * List jobs (with optional filters)
   *  - filters: { status, vendorId, vehicleId, search, limit }
   */
  async getAllJobs(filters = {}) {
    try {
      // NOTE: PostgREST filter helpers (eq/in/or/...) exist on the builder returned from .select().
      // We start with a tiny select to get a filter-capable builder, then let selectJobs() apply
      // the expanded select fragment later.
      let q = supabase?.from('jobs')?.select('id')

      // If Supabase client is unavailable (e.g., missing env or stub), return empty to avoid runtime errors
      if (!q || typeof q.select !== 'function') return []

      if (filters?.status) q = q?.eq('job_status', filters?.status)
      if (filters?.vendorId) q = q?.eq('vendor_id', filters?.vendorId)
      if (filters?.vehicleId) q = q?.eq('vehicle_id', filters?.vehicleId)
      // Back-compat: filters.orgId is treated as dealer_id.
      if (filters?.orgId) q = q?.eq('dealer_id', filters?.orgId)
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
   * Fetch a set of jobs by id (org-scoped) with the same expanded select as getAllJobs.
   * Used by canonical schedule pipelines to hydrate job rows after an index query.
   */
  async getJobsByIds(ids = [], { orgId } = {}) {
    const list = Array.isArray(ids) ? ids.filter(Boolean) : []
    if (list.length === 0) return []

    try {
      let q = supabase?.from('jobs')?.select('id')
      if (!q || typeof q.select !== 'function') return []

      q = q?.in?.('id', list) ?? q
      // Back-compat: orgId is treated as dealer_id.
      if (orgId) q = q.eq('dealer_id', orgId)
      q = q.order('created_at', { ascending: false })

      const data = await selectJobs(q)
      return data ?? []
    } catch (err) {
      console.error('[jobs] getJobsByIds failed:', err?.message || err)
      return []
    }
  },

  /**
   * Get a single job by id
   */
  async getJobById(id) {
    if (!id) return null
    try {
      const rows = await selectJobs(supabase?.from('jobs')?.select('id')?.eq('id', id)?.limit(1))
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
    } catch {
      // ignore if missing
    }

    try {
      // Current user (if auth enabled)
      let createdBy = null
      try {
        const { data: userRes, error: userErr } = await supabase?.auth?.getUser()
        if (!userErr && userRes?.user) createdBy = userRes?.user?.id ?? null
      } catch {}

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
        // Extra optional fields used by newer UIs (e.g., Calendar CreateModal)
        calendar_notes: dealData?.calendar_notes ?? null,
        color_code: dealData?.color_code ?? null,
        promised_date: dealData?.promised_date ?? null,
        service_type: dealData?.service_type ?? null,
        estimated_cost: dealData?.estimated_cost ?? null,
        assigned_to: dealData?.assigned_to ?? null,
        delivery_coordinator_id: dealData?.delivery_coordinator_id ?? null,
        customer_needs_loaner: dealData?.customer_needs_loaner ?? null,
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
          await syncJobPartsForJob(created?.id, dealData?.lineItems)
        } catch (liErr) {
          // rollback to avoid orphan job
          try {
            const { data: deleted, error: delErr } = await supabase
              ?.from('jobs')
              ?.delete()
              ?.eq('id', created?.id)
              ?.select('id')
            if (delErr) throw delErr
            if (Array.isArray(deleted) && deleted.length === 0) {
              console.warn('[jobs] rollback delete was blocked by RLS for job %s', created?.id)
            }
          } catch (rollbackErr) {
            console.warn('[jobs] rollback delete failed:', rollbackErr?.message || rollbackErr)
          }
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

      // Sync line items if provided using identity-based sync
      if (dealData?.lineItems !== undefined) {
        if (Array.isArray(dealData?.lineItems)) {
          await syncJobPartsForJob(jobId, dealData.lineItems)
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
      const { data: deletedParts, error: partsErr } = await supabase
        ?.from('job_parts')
        ?.delete()
        ?.eq('job_id', jobId)
        ?.select('job_id')
      if (partsErr) throw partsErr

      if (Array.isArray(deletedParts) && deletedParts.length === 0) {
        const { data: remainingParts, error: remainingPartsErr } = await supabase
          ?.from('job_parts')
          ?.select('job_id')
          ?.eq('job_id', jobId)
          ?.limit(1)
        if (remainingPartsErr) throw remainingPartsErr
        if (Array.isArray(remainingParts) && remainingParts.length > 0) {
          throw new Error('Delete was blocked by permissions (RLS) while deleting job parts.')
        }
      }

      const { data: deletedJobs, error } = await supabase
        ?.from('jobs')
        ?.delete()
        ?.eq('id', jobId)
        ?.select('id')
      if (error) throw error

      if (Array.isArray(deletedJobs) && deletedJobs.length === 0) {
        const { data: remainingJob, error: remainingJobErr } = await supabase
          ?.from('jobs')
          ?.select('id')
          ?.eq('id', jobId)
          ?.maybeSingle()
        if (remainingJobErr) throw remainingJobErr
        if (remainingJob) {
          throw new Error('Delete was blocked by permissions (RLS) while deleting the job.')
        }
      }

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

  /**
   * Update scheduling for all line items of a job
   * This is used by the calendar reschedule functionality
   *
   * @param {string} jobId - Job ID
   * @param {Object} scheduleData - New schedule data
   * @param {string} scheduleData.startTime - ISO timestamp for start
   * @param {string} scheduleData.endTime - ISO timestamp for end
   * @returns {Promise<Object>} Updated job with line items
   */
  async updateLineItemSchedules(jobId, scheduleData) {
    if (!jobId) throw new Error('Job ID is required')
    if (!scheduleData?.startTime || !scheduleData?.endTime) {
      throw new Error('Start time and end time are required')
    }

    try {
      // First, get all line items for this job that have requires_scheduling = true
      const { data: lineItems, error: fetchErr } = await supabase
        ?.from('job_parts')
        ?.select('id, requires_scheduling')
        ?.eq('job_id', jobId)

      if (fetchErr) throw fetchErr

      // Filter to only those that require scheduling
      const scheduledItems = (lineItems || []).filter((item) => item?.requires_scheduling)

      if (scheduledItems.length === 0) {
        throw new Error('No line items require scheduling for this job')
      }

      // Update all scheduled line items with the new times
      // Strategy: Apply the same start/end to all items (simplified approach)
      // More complex: could preserve relative offsets if needed

      // Extract date from scheduled_start_time for promised_date field
      const promisedDate = scheduleData.startTime ? toDateInputValue(scheduleData.startTime) : null

      const updates = scheduledItems.map((item) => ({
        id: item.id,
        scheduled_start_time: scheduleData.startTime,
        scheduled_end_time: scheduleData.endTime,
        promised_date: promisedDate,
        updated_at: nowIso(),
      }))

      // Batch update all line items
      for (const update of updates) {
        const { error: updateErr } = await supabase
          ?.from('job_parts')
          ?.update({
            scheduled_start_time: update.scheduled_start_time,
            scheduled_end_time: update.scheduled_end_time,
            promised_date: update.promised_date,
            updated_at: update.updated_at,
          })
          ?.eq('id', update.id)

        if (updateErr) throw updateErr
      }

      // Fetch and return the updated job with line items
      return await this.getJobById(jobId)
    } catch (err) {
      console.error('[jobs] updateLineItemSchedules failed:', err?.message || err)
      throw new Error(`Failed to update line item schedules: ${err?.message || err}`)
    }
  },

  /**
   * Create a job with typed input validation (Section 20 pattern)
   * @param {import('@/db/schemas').JobInsert} jobData - Typed job data
   * @returns {Promise<any>}
   */
  async createTyped(jobData) {
    try {
      // Validate with Zod schema
      const validated = jobInsertSchema.parse(jobData)
      // Delegate to existing createJob with validated data
      return await this.createJob(validated)
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new Error('Job validation failed: ' + e.errors.map((err) => err.message).join(', '))
      }
      console.error('jobService.createTyped failed', e)
      throw e
    }
  },

  /**
   * Update a job with typed input validation (Section 20 pattern)
   * @param {string} jobId - Job ID
   * @param {Partial<import('@/db/schemas').JobInsert>} jobData - Partial job data
   * @returns {Promise<any>}
   */
  async updateTyped(jobId, jobData) {
    try {
      // Validate with Zod schema (partial mode)
      const validated = jobInsertSchema.partial().parse(jobData)
      // Delegate to existing updateJob with validated data
      return await this.updateJob(jobId, validated)
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new Error('Job validation failed: ' + e.errors.map((err) => err.message).join(', '))
      }
      console.error('jobService.updateTyped failed', e)
      throw e
    }
  },
}

// Named exports for back-compat
export const getAllDeals = jobService?.getAllJobs // if other code still imports "deals"
export const getDealById = jobService?.getJobById
export const createDeal = jobService?.createJob
export const updateDeal = jobService?.updateJob
export const deleteDeal = jobService?.deleteJob
export const updateStatus = jobService?.updateStatus
export const updateLineItemSchedules = jobService?.updateLineItemSchedules

export default jobService
