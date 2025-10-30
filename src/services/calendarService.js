import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

/**
 * Calendar Service - Handles calendar scheduling operations
 */
export const calendarService = {
  /**
   * Get jobs within a date range for calendar display
   */
  async getJobsByDateRange(startDate, endDate, filters = {}) {
    try {
      const { data, error } = await supabase?.rpc('get_jobs_by_date_range', {
        start_date: startDate?.toISOString(),
        end_date: endDate?.toISOString(),
        vendor_filter: filters?.vendorId || null,
        status_filter: filters?.status || null,
      })

      if (error) {
        throw error
      }

      return { data: data || [], error: null }
    } catch (error) {
      console.error('[calendar] getJobsByDateRange failed:', error)
      return { data: [], error }
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
      if (orgId) q = q?.eq('org_id', orgId)
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
        org_id: orgId ?? jobData?.org_id ?? null,
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
        ?.select('*', { count: 'exact', head: true })
        ?.neq('job_status', 'cancelled')
      if (orgId) totalQ = totalQ?.eq('org_id', orgId)
      const { count: totalJobs, error: totalErr } = await totalQ
      if (totalErr) throw totalErr

      // Get scheduled jobs for the period
      let schedQ = supabase
        ?.from('jobs')
        ?.select('*', { count: 'exact', head: true })
        ?.gte('scheduled_start_time', startDate?.toISOString())
        ?.lt('scheduled_start_time', endDate?.toISOString())
      if (orgId) schedQ = schedQ?.eq('org_id', orgId)
      const { count: scheduledJobs, error: schedErr } = await schedQ
      if (schedErr) throw schedErr

      // Get overdue jobs
      const { data: overdueJobs } = await this.getOverdueJobs()

      // Get active vendors
      let vendorsQ = supabase
        ?.from('vendors')
        ?.select('*', { count: 'exact', head: true })
        ?.eq('is_active', true)
      if (orgId) vendorsQ = vendorsQ?.eq('org_id', orgId)
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
}

export default calendarService
