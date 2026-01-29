import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

/**
 * Calendar Service - Handles calendar scheduling operations
 */
export const calendarService = {
  /**
   * Scheduling Center: load jobs with RPC first, then fallback to a direct query.
   * Returns { data, error, debugInfo }.
   */
  async getJobsByDateRangeWithFallback(startDate, endDate, filters = {}) {
    try {
      const startIso = startDate?.toISOString?.() ? startDate.toISOString() : null
      const endIso = endDate?.toISOString?.() ? endDate.toISOString() : null

      if (!startIso || !endIso) {
        return { data: [], error: new Error('Invalid date range'), debugInfo: 'Invalid date range' }
      }

      // 1) Prefer RPC
      try {
        const { data, error } = await supabase?.rpc('get_jobs_by_date_range', {
          start_date: startIso,
          end_date: endIso,
          vendor_filter: filters?.vendorId || null,
          status_filter: filters?.status || null,
        })
        if (error) throw error
        return {
          data: data || [],
          error: null,
          debugInfo: `RPC function returned ${(data || [])?.length} jobs`,
        }
      } catch (rpcError) {
        console.warn(
          '[calendar] getJobsByDateRangeWithFallback: RPC failed, using direct query:',
          rpcError
        )

        // 2) Fallback query
        let q = supabase
          ?.from('jobs')
          ?.select(
            `
            id,
            title,
            description,
            scheduled_start_time,
            scheduled_end_time,
            job_status,
            vendor_id,
            vehicle_id,
            color_code,
            priority,
            estimated_hours,
            job_number,
            location,
            calendar_notes,
            vendors:vendor_id(id, name, specialty),
            vehicles:vehicle_id(id, make, model, year, owner_name, stock_number)
          `
          )
          ?.not('scheduled_start_time', 'is', null)
          ?.gte('scheduled_start_time', startIso)
          ?.lte('scheduled_start_time', endIso)
          ?.order('scheduled_start_time', { ascending: true })

        if (filters?.vendorId) {
          q = q?.eq('vendor_id', filters.vendorId)
        }

        const rows = await safeSelect(q, 'calendar:getJobsByDateRangeWithFallback:fallback', {
          allowRLS: true,
        })

        const transformed = (rows || []).map((job) => ({
          ...job,
          vendor_name:
            job?.vendors?.name ||
            (job?.vendor_id
              ? 'Vendor'
              : job?.location === 'off_site'
                ? 'Vendor/Offsite'
                : 'On-site'),
          vehicle_info: job?.vehicles
            ? `${job?.vehicles?.year} ${job?.vehicles?.make} ${job?.vehicles?.model}`.trim()
            : 'No Vehicle',
        }))

        return {
          data: transformed,
          error: null,
          debugInfo: `Direct query returned ${transformed?.length} jobs`,
        }
      }
    } catch (error) {
      console.error('[calendar] getJobsByDateRangeWithFallback failed:', error)
      return { data: [], error, debugInfo: `Error: ${error?.message || error}` }
    }
  },

  /**
   * Scheduling Center: get detailed conflict info (for UI warning banner).
   */
  async getVendorConflictDetails(vendorId, startTime, endTime, excludeJobId = null) {
    try {
      if (!vendorId || !startTime || !endTime) {
        return { hasConflict: false, conflict: null, error: null }
      }

      const startUtc = startTime?.toISOString?.()
        ? startTime.toISOString()
        : new Date(startTime).toISOString()
      const endUtc = endTime?.toISOString?.()
        ? endTime.toISOString()
        : new Date(endTime).toISOString()

      let q = supabase
        ?.from('jobs')
        ?.select(
          `
          id,
          title,
          scheduled_start_time,
          scheduled_end_time,
          transactions!inner(customer_name)
        `
        )
        ?.eq('vendor_id', vendorId)
        ?.lt('scheduled_start_time', endUtc)
        ?.gt('scheduled_end_time', startUtc)
        ?.limit(1)

      if (excludeJobId) {
        q = q?.neq('id', excludeJobId)
      }

      const conflicts = await safeSelect(q, 'calendar:getVendorConflictDetails', { allowRLS: true })

      if (Array.isArray(conflicts) && conflicts.length > 0) {
        const conflict = conflicts[0]

        const startLocal = new Date(conflict.scheduled_start_time)?.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })

        const endLocal = new Date(conflict.scheduled_end_time)?.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        })

        return {
          hasConflict: true,
          conflict: {
            id: conflict?.id,
            customer_name: conflict?.transactions?.[0]?.customer_name || 'Other job',
            start_local: startLocal,
            end_local: endLocal,
            timeRange: `${startLocal}–${endLocal}`,
          },
          error: null,
        }
      }

      return { hasConflict: false, conflict: null, error: null }
    } catch (error) {
      console.error('[calendar] getVendorConflictDetails failed:', error)
      return { hasConflict: false, conflict: null, error }
    }
  },

  /**
   * Best-effort activity log (non-blocking for UX).
   */
  async logActivity(payload) {
    try {
      if (!payload) return { ok: true }
      const { error } = await supabase?.rpc('log_activity', payload)
      if (error) throw error
      return { ok: true }
    } catch (error) {
      console.warn('[calendar] logActivity failed:', error)
      return { ok: false, error }
    }
  },

  /**
   * Get jobs within a date range for calendar display
   */
  async getJobsByDateRange(startDate, endDate, filters = {}) {
    try {
      const baseArgs = {
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
        vendor_filter: filters?.vendorId || null,
        status_filter: filters?.status || null,
      }

      // Tenant scoping is enforced via RLS. Avoid passing legacy org_id args to RPCs.
      const res = await supabase?.rpc('get_jobs_by_date_range', baseArgs)

      const { data, error } = res || {}

      if (error) {
        throw error
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('[calendar] getJobsByDateRange failed:', error)
      return { data: [], error: null }
    }
  },

  /**
   * Find the next scheduled job strictly after the provided date.
   * Returns { data: { id, scheduled_start_time } | null, error }.
   */
  async getNextScheduledJob(afterDate, filters = {}) {
    try {
      const afterIso = afterDate?.toISOString?.() ? afterDate.toISOString() : null
      if (!afterIso) return { data: null, error: new Error('Invalid date') }

      let q = supabase
        ?.from('jobs')
        ?.select('id, scheduled_start_time')
        ?.not('scheduled_start_time', 'is', null)
        ?.gt('scheduled_start_time', afterIso)
        ?.order('scheduled_start_time', { ascending: true })
        ?.limit(1)

      if (filters?.vendorId) {
        q = q?.eq('vendor_id', filters.vendorId)
      }

      const rows = await safeSelect(q, 'calendar:getNextScheduledJob', { allowRLS: true })
      const first = Array.isArray(rows) && rows.length > 0 ? rows[0] : null
      return { data: first, error: null }
    } catch (error) {
      console.error('[calendar] getNextScheduledJob failed:', error)
      return { data: null, error }
    }
  },

  /**
   * Check for vendor scheduling conflicts
   */
  async checkSchedulingConflict(vendorId, startTime, endTime, excludeJobId = null) {
    try {
      const { data, error } = await supabase?.rpc('check_vendor_schedule_conflict', {
        vendor_uuid: vendorId,
        start_time: startTime?.toISOString(),
        end_time: endTime?.toISOString(),
        exclude_job_id: excludeJobId,
      })

      if (error) {
        throw error
      }

      return { hasConflict: data || false, error: null }
    } catch (error) {
      console.error('[calendar] checkSchedulingConflict failed:', error)
      return { hasConflict: false, error }
    }
  },

  /**
   * Update job scheduling information
   */
  async updateJobSchedule(jobId, scheduleData, orgId = null) {
    try {
      const updateData = {
        scheduled_start_time: scheduleData?.startTime?.toISOString(),
        scheduled_end_time: scheduleData?.endTime?.toISOString(),
        vendor_id: scheduleData?.vendorId,
        location: scheduleData?.location,
        color_code: scheduleData?.colorCode,
        calendar_notes: scheduleData?.notes,
        // Ensure scheduled jobs surface in Active Appointments views
        // Default to 'scheduled' when we have a start time unless an explicit status was provided
        job_status: scheduleData?.status ?? (scheduleData?.startTime ? 'scheduled' : undefined),
        updated_at: new Date()?.toISOString(),
      }

      // Remove undefined values
      Object.keys(updateData)?.forEach((key) => {
        if (updateData?.[key] === undefined) {
          delete updateData?.[key]
        }
      })

      let q = supabase
        ?.from('jobs')
        ?.update(updateData)
        ?.eq('id', jobId)
        ?.select(
          `
          *,
          vendor:vendors(id, name, specialty),
          vehicle:vehicles(id, make, model, year, owner_name, stock_number)
        `
        )
        ?.single()
      // Back-compat: orgId param is treated as dealer_id.
      if (orgId) q = q?.eq('dealer_id', orgId)
      const data = await safeSelect(q, 'calendar:updateJobSchedule')

      return { data, error: null }
    } catch (error) {
      console.error('[calendar] updateJobSchedule failed:', error)
      return { data: null, error }
    }
  },

  /**
   * Create a new scheduled job
   */
  async createScheduledJob(jobData, orgId = null) {
    try {
      // Generate job number
      const { data: jobNumber, error: jobNumberError } = await supabase?.rpc('generate_job_number')

      if (jobNumberError) {
        throw jobNumberError
      }

      const newJobData = {
        job_number: jobNumber,
        title: jobData?.title,
        description: jobData?.description || '',
        vehicle_id: jobData?.vehicleId,
        vendor_id: jobData?.vendorId,
        scheduled_start_time: jobData?.startTime?.toISOString(),
        scheduled_end_time: jobData?.endTime?.toISOString(),
        estimated_hours: jobData?.estimatedHours || 2,
        location: jobData?.location || '',
        priority: jobData?.priority || 'medium',
        job_status: 'scheduled',
        color_code: jobData?.colorCode || '#3b82f6',
        calendar_notes: jobData?.notes || '',
        created_by: jobData?.createdBy,
        // Back-compat: orgId param is treated as dealer_id.
        dealer_id: orgId ?? jobData?.dealer_id ?? null,
      }

      const { data } = await supabase
        ?.from('jobs')
        ?.insert([newJobData])
        ?.select(
          `
          *,
          vendor:vendors(id, name, specialty),
          vehicle:vehicles(id, make, model, year, owner_name, stock_number)
        `
        )
        ?.single()
        ?.throwOnError()

      return { data, error: null }
    } catch (error) {
      console.error('[calendar] createScheduledJob failed:', error)
      return { data: null, error }
    }
  },

  /**
   * Get overdue jobs
   */
  async getOverdueJobs() {
    try {
      const { data, error } = await supabase?.rpc('get_overdue_jobs')

      if (error) {
        throw error
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('[calendar] getOverdueJobs failed:', error)
      return { data: [], error }
    }
  },

  /**
   * Get calendar overview statistics
   */
  async getCalendarStats(dateRange = 'today', orgId = null) {
    try {
      const now = new Date()
      let startDate, endDate

      switch (dateRange) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          endDate = new Date(startDate)
          endDate?.setDate(endDate?.getDate() + 1)
          break
        case 'week':
          startDate = new Date(now)
          startDate?.setDate(now?.getDate() - now?.getDay()) // Start of week (Sunday)
          startDate?.setHours(0, 0, 0, 0)
          endDate = new Date(startDate)
          endDate?.setDate(endDate?.getDate() + 7)
          break
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1)
          endDate = new Date(now.getFullYear(), now.getMonth() + 1, 1)
          break
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate())
          endDate = new Date(startDate)
          endDate?.setDate(endDate?.getDate() + 1)
      }

      // Get jobs count for the period
      let totalQ = supabase
        ?.from('jobs')
        ?.select('id', { count: 'exact', head: true })
        ?.neq('job_status', 'cancelled')
      if (orgId) totalQ = totalQ?.eq('dealer_id', orgId)
      const { count: totalJobs, error: totalErr } = await totalQ
      if (totalErr) throw totalErr

      // Get scheduled jobs for the period
      let schedQ = supabase
        ?.from('jobs')
        ?.select('id', { count: 'exact', head: true })
        ?.gte('scheduled_start_time', startDate?.toISOString())
        ?.lt('scheduled_start_time', endDate?.toISOString())
      if (orgId) schedQ = schedQ?.eq('dealer_id', orgId)
      const { count: scheduledJobs, error: schedErr } = await schedQ
      if (schedErr) throw schedErr

      // Get overdue jobs
      const { data: overdueJobs } = await this.getOverdueJobs()

      // Get active vendors
      let vendorsQ = supabase
        ?.from('vendors')
        ?.select('id', { count: 'exact', head: true })
        ?.eq('is_active', true)
      if (orgId) vendorsQ = vendorsQ?.eq('dealer_id', orgId)
      const { count: activeVendors, error: vErr } = await vendorsQ
      if (vErr) throw vErr

      return {
        data: {
          totalJobs: totalJobs || 0,
          scheduledJobs: scheduledJobs || 0,
          overdueJobs: overdueJobs?.length || 0,
          activeVendors: activeVendors || 0,
        },
        error: null,
      }
    } catch (error) {
      console.error('[calendar] getCalendarStats failed:', error)
      return {
        data: {
          totalJobs: 0,
          scheduledJobs: 0,
          overdueJobs: 0,
          activeVendors: 0,
        },
        error,
      }
    }
  },

  /**
   * Get vendor availability for a time slot
   */
  async getVendorAvailability(vendorId, startTime, endTime) {
    try {
      const { data } = await this.getJobsByDateRange(startTime, endTime, { vendorId })
      const jobs = data

      const hasOverlap = Array.isArray(jobs)
        ? jobs.some((job) => {
            if (!job?.scheduled_start_time || !job?.scheduled_end_time) return false

            const jobStart = new Date(job.scheduled_start_time).getTime()
            const jobEnd = new Date(job.scheduled_end_time).getTime()
            return jobStart < endTime.getTime() && jobEnd > startTime.getTime()
          })
        : false

      return { available: !hasOverlap, conflictingJobs: hasOverlap ? jobs : [], error: null }
    } catch (error) {
      console.error('[calendar] getVendorAvailability failed:', error)
      return { available: false, conflictingJobs: [], error }
    }
  },

  /**
   * Calendar CreateModal omnibox: search existing deals by stock, phone, or name.
   * Mirrors the UI's current priority and join shape: vehicles + inner transactions + inner jobs.
   */
  async searchDealsForCreateModal(query) {
    const q = query?.trim?.() || ''
    if (q.length < 2) return { data: [], error: null }

    try {
      const phoneQuery = q.replace(/\D/g, '')
      const select = `
          *,
          transactions!inner(
            id,
            transaction_number,
            customer_name,
            customer_phone,
            customer_email,
            created_at
          ),
          jobs!inner(
            id,
            job_number,
            title,
            assigned_to,
            delivery_coordinator_id,
            vendor_id,
            customer_needs_loaner
          )
        `

      let dealResults = []

      // 1) Stock number exact then partial
      try {
        const q1 = supabase
          ?.from('vehicles')
          ?.select(select)
          ?.or(`stock_number.eq.${q},stock_number.ilike.%${q}%`)
          ?.limit(10)
        const rows1 = await safeSelect(q1, 'calendar:searchDealsForCreateModal:stock', {
          allowRLS: true,
        })
        if (rows1?.length) dealResults = [...dealResults, ...rows1]
      } catch (e) {
        console.warn('[calendar] searchDealsForCreateModal stock search failed', e?.message)
      }

      // 2) Phone (digits) across vehicle owner_phone and transaction customer_phone
      if (phoneQuery?.length >= 4) {
        try {
          const q2 = supabase
            ?.from('vehicles')
            ?.select(select)
            ?.or(
              `owner_phone.like.%${phoneQuery}%,transactions.customer_phone.like.%${phoneQuery}%`
            )
            ?.limit(10)
          const rows2 = await safeSelect(q2, 'calendar:searchDealsForCreateModal:phone', {
            allowRLS: true,
          })
          if (rows2?.length) dealResults = [...dealResults, ...rows2]
        } catch (e) {
          console.warn('[calendar] searchDealsForCreateModal phone search failed', e?.message)
        }
      }

      // 3) Name across vehicle owner_name and transaction customer_name
      try {
        const q3 = supabase
          ?.from('vehicles')
          ?.select(select)
          ?.or(`owner_name.ilike.%${q}%,transactions.customer_name.ilike.%${q}%`)
          ?.limit(10)
        const rows3 = await safeSelect(q3, 'calendar:searchDealsForCreateModal:name', {
          allowRLS: true,
        })
        if (rows3?.length) dealResults = [...dealResults, ...rows3]
      } catch (e) {
        console.warn('[calendar] searchDealsForCreateModal name search failed', e?.message)
      }

      // De-dupe by vehicle id
      const unique = (dealResults || []).filter(
        (deal, index, self) => index === self.findIndex((d) => d?.id === deal?.id)
      )

      return { data: unique || [], error: null }
    } catch (error) {
      console.error('[calendar] searchDealsForCreateModal failed:', error)
      return { data: [], error: { message: error?.message || 'Failed to search deals' } }
    }
  },
}

export default calendarService
