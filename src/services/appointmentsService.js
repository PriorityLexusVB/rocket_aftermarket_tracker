import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

function isQueryable(q) {
  return q && typeof q.select === 'function' && typeof q.eq === 'function'
}

async function safeRun(query, label) {
  try {
    if (!query || typeof query.then !== 'function') return { data: [], error: null }
    const data = await safeSelect(query, label)
    return { data: data || [], error: null }
  } catch (error) {
    return { data: [], error }
  }
}

export const appointmentsService = {
  /**
   * Active appointments list for /currently-active-appointments.
   * Returns rows shaped like the legacy page expects (vehicles/vendors/user_profiles aliases).
   */
  async listActiveAppointments({ orgId } = {}) {
    try {
      let q = supabase?.from('jobs')
      if (!isQueryable(q) || typeof q.in !== 'function' || typeof q.order !== 'function') {
        console.warn('[appointments] listActiveAppointments: supabase query helpers unavailable')
        return { data: [], error: null }
      }

      q = q
        .select(
          `
          *,
          vehicles (
            id, stock_number, year, make, model, color, owner_name,
            owner_phone, owner_email, license_plate
          ),
          vendors (
            id, name, phone, email, specialty, contact_person
          ),
          assigned_to_profile:user_profiles!assigned_to (
            id, full_name, email, phone
          ),
          created_by_profile:user_profiles!created_by (
            id, full_name, email
          )
        `
        )
        .in('job_status', ['pending', 'in_progress', 'scheduled', 'quality_check'])
        .order('scheduled_start_time', { ascending: true })

      if (orgId && typeof q.eq === 'function') q = q.eq('org_id', orgId)

      const { data, error } = await safeRun(q, 'appointments:listActiveAppointments')
      if (error) throw error

      const jobIds = (data || []).map((j) => j?.id).filter(Boolean)
      let loaners = []

      // Best-effort: if the query helpers exist, attach active loaner info.
      if (jobIds.length) {
        const lq = supabase?.from('loaner_assignments')
        if (isQueryable(lq) && typeof lq.in === 'function' && typeof lq.is === 'function') {
          let loanerQ = lq.select('job_id, id').in('job_id', jobIds).is('returned_at', null)
          if (orgId) {
            // RLS is typically enforced via jobs join; but if org_id exists on loaners, filter.
            loanerQ = loanerQ.eq?.('org_id', orgId) ?? loanerQ
          }
          const res = await safeRun(loanerQ, 'appointments:listActiveAppointments:loaners')
          loaners = res.data || []
        }
      }

      const enriched = (data || []).map((job) => ({
        ...job,
        has_active_loaner: !!loaners.find((l) => l?.job_id === job?.id)?.id,
      }))

      return { data: enriched, error: null }
    } catch (error) {
      console.error('[appointments] listActiveAppointments failed:', error)
      return { data: [], error }
    }
  },

  async listUnassignedJobs({ orgId, limit = 10 } = {}) {
    try {
      let q = supabase?.from('jobs')
      if (!isQueryable(q) || typeof q.is !== 'function' || typeof q.order !== 'function') {
        console.warn('[appointments] listUnassignedJobs: supabase query helpers unavailable')
        return { data: [], error: null }
      }

      q = q
        .select(
          `
          *,
          vehicles (
            id, stock_number, year, make, model, owner_name
          ),
          vendors (
            id, name
          )
        `
        )
        .is('assigned_to', null)
        .eq('job_status', 'pending')
        .order('created_at', { ascending: false })

      if (typeof q.limit === 'function') q = q.limit(limit)
      if (orgId) q = q.eq('org_id', orgId)

      return await safeRun(q, 'appointments:listUnassignedJobs')
    } catch (error) {
      console.error('[appointments] listUnassignedJobs failed:', error)
      return { data: [], error }
    }
  },

  async listVendors({ orgId } = {}) {
    try {
      let q = supabase?.from('vendors')
      if (!isQueryable(q) || typeof q.order !== 'function') {
        console.warn('[appointments] listVendors: supabase query helpers unavailable')
        return { data: [], error: null }
      }

      q = q.select('id, name').eq('is_active', true).order('name')
      if (orgId) q = q.or?.(`org_id.eq.${orgId},org_id.is.null`) ?? q.eq('org_id', orgId)

      return await safeRun(q, 'appointments:listVendors')
    } catch (error) {
      console.error('[appointments] listVendors failed:', error)
      return { data: [], error }
    }
  },

  async listStaff({ orgId } = {}) {
    try {
      let q = supabase?.from('user_profiles')
      if (!isQueryable(q) || typeof q.order !== 'function') {
        console.warn('[appointments] listStaff: supabase query helpers unavailable')
        return { data: [], error: null }
      }

      q = q
        .select('id, full_name, email, role, department')
        .eq('is_active', true)
        .order('full_name')

      if (orgId) q = q.or?.(`org_id.eq.${orgId},org_id.is.null`) ?? q.eq('org_id', orgId)

      return await safeRun(q, 'appointments:listStaff')
    } catch (error) {
      console.error('[appointments] listStaff failed:', error)
      return { data: [], error }
    }
  },

  async getPerformanceMetrics({ orgId } = {}) {
    try {
      const q = supabase?.from('jobs')
      if (!isQueryable(q) || typeof q.gte !== 'function' || typeof q.lte !== 'function') {
        console.warn('[appointments] getPerformanceMetrics: supabase query helpers unavailable')
        return { data: null, error: null }
      }

      const today = new Date().toISOString().split('T')[0]

      let todayQ = supabase
        .from('jobs')
        .select('job_status, created_at, completed_at')
        .gte('created_at', `${today}T00:00:00Z`)
        .lte('created_at', `${today}T23:59:59Z`)

      const weekStart = new Date()
      weekStart.setDate(weekStart.getDate() - weekStart.getDay())
      const weekStartStr = weekStart.toISOString().split('T')[0]

      let weekQ = supabase
        .from('jobs')
        .select('job_status, created_at, completed_at')
        .gte('created_at', `${weekStartStr}T00:00:00Z`)

      if (orgId) {
        todayQ = todayQ.eq('org_id', orgId)
        weekQ = weekQ.eq('org_id', orgId)
      }

      const todayRes = await safeRun(todayQ, 'appointments:metrics:today')
      const weekRes = await safeRun(weekQ, 'appointments:metrics:week')
      const todayJobs = todayRes.data || []
      const weekJobs = weekRes.data || []

      const todayCompleted = todayJobs.filter((job) => job?.job_status === 'completed').length
      const todayTotal = todayJobs.length
      const weekCompleted = weekJobs.filter((job) => job?.job_status === 'completed').length
      const weekTotal = weekJobs.length

      const completedJobs = weekJobs.filter(
        (job) => job?.job_status === 'completed' && job?.completed_at && job?.created_at
      )
      const avgCompletionTime =
        completedJobs.length > 0
          ? completedJobs.reduce((sum, job) => {
              const start = new Date(job.created_at)
              const end = new Date(job.completed_at)
              return sum + (end - start) / (1000 * 60 * 60)
            }, 0) / completedJobs.length
          : 0

      return {
        data: {
          todayCompleted,
          todayTotal,
          todayCompletionRate: todayTotal > 0 ? (todayCompleted / todayTotal) * 100 : 0,
          weekCompleted,
          weekTotal,
          weekCompletionRate: weekTotal > 0 ? (weekCompleted / weekTotal) * 100 : 0,
          avgCompletionTime: Math.round(avgCompletionTime * 100) / 100,
        },
        error: null,
      }
    } catch (error) {
      console.error('[appointments] getPerformanceMetrics failed:', error)
      return { data: null, error }
    }
  },

  subscribeJobUpdates(onChange) {
    try {
      const subscription = supabase
        ?.channel('job_updates')
        ?.on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => {
          try {
            onChange?.()
          } catch (e) {
            console.debug('[appointments] onChange handler failed', e)
          }
        })
        ?.subscribe()

      return subscription
    } catch (error) {
      console.warn('[appointments] subscribeJobUpdates failed:', error)
      return null
    }
  },

  async updateJobStatus({ jobId, status, orgId } = {}) {
    try {
      if (!jobId) return { data: null, error: new Error('jobId is required') }
      if (!status) return { data: null, error: new Error('status is required') }

      let q = supabase?.from('jobs')
      if (!q || typeof q.update !== 'function' || typeof q.eq !== 'function') {
        console.warn('[appointments] updateJobStatus: supabase query helpers unavailable')
        return { data: null, error: null }
      }

      q = q.update({ job_status: status, updated_at: new Date().toISOString() }).eq('id', jobId)

      if (orgId) q = q.eq('org_id', orgId)

      const { data, error } = await q.select().single()
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('[appointments] updateJobStatus failed:', error)
      return { data: null, error }
    }
  },

  async bulkUpdateJobStatus({ jobIds, status, orgId } = {}) {
    try {
      const ids = Array.isArray(jobIds) ? jobIds.filter(Boolean) : []
      if (!ids.length) return { data: [], error: new Error('jobIds is required') }
      if (!status) return { data: [], error: new Error('status is required') }

      let q = supabase?.from('jobs')
      if (!q || typeof q.update !== 'function' || typeof q.in !== 'function') {
        console.warn('[appointments] bulkUpdateJobStatus: supabase query helpers unavailable')
        return { data: [], error: null }
      }

      q = q.update({ job_status: status, updated_at: new Date().toISOString() }).in('id', ids)

      if (orgId && typeof q.eq === 'function') q = q.eq('org_id', orgId)

      const { data, error } = await q.select()
      if (error) throw error
      return { data: data || [], error: null }
    } catch (error) {
      console.error('[appointments] bulkUpdateJobStatus failed:', error)
      return { data: [], error }
    }
  },

  async bulkAssignJobs({ jobIds, staffId, orgId } = {}) {
    try {
      const ids = Array.isArray(jobIds) ? jobIds.filter(Boolean) : []
      if (!ids.length) return { data: [], error: new Error('jobIds is required') }
      if (!staffId) return { data: [], error: new Error('staffId is required') }

      let q = supabase?.from('jobs')
      if (!q || typeof q.update !== 'function' || typeof q.in !== 'function') {
        console.warn('[appointments] bulkAssignJobs: supabase query helpers unavailable')
        return { data: [], error: null }
      }

      q = q.update({ assigned_to: staffId, updated_at: new Date().toISOString() }).in('id', ids)

      if (orgId && typeof q.eq === 'function') q = q.eq('org_id', orgId)

      const { data, error } = await q.select()
      if (error) throw error
      return { data: data || [], error: null }
    } catch (error) {
      console.error('[appointments] bulkAssignJobs failed:', error)
      return { data: [], error }
    }
  },

  async quickAssignJob({ jobId, staffId, orgId } = {}) {
    try {
      if (!jobId) return { data: null, error: new Error('jobId is required') }
      if (!staffId) return { data: null, error: new Error('staffId is required') }

      let q = supabase?.from('jobs')
      if (!q || typeof q.update !== 'function' || typeof q.eq !== 'function') {
        console.warn('[appointments] quickAssignJob: supabase query helpers unavailable')
        return { data: null, error: null }
      }

      q = q
        .update({
          assigned_to: staffId,
          job_status: 'pending',
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId)

      if (orgId) q = q.eq('org_id', orgId)

      const { data, error } = await q.select().single()
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('[appointments] quickAssignJob failed:', error)
      return { data: null, error }
    }
  },
}
