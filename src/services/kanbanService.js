import { supabase } from '../lib/supabase'
import { safeSelect } from '../lib/supabase/safeSelect'

/**
 * Kanban Service - Handles kanban board operations and status management
 */
export const kanbanService = {
  /**
   * Get all jobs with full details for kanban board
   */
  async getAllJobsForKanban(filters = {}, orgId = null) {
    try {
      let query = supabase?.from('jobs')?.select(`
          *,
          vendor:vendors(id, name, specialty),
          vehicle:vehicles(id, make, model, year, owner_name, stock_number),
          assigned_user:user_profiles!jobs_assigned_to_fkey(id, full_name, email),
          created_user:user_profiles!jobs_created_by_fkey(id, full_name)
        `)
      if (orgId) query = query?.eq('org_id', orgId)

      // Apply filters
      if (filters?.vendorIds?.length > 0) {
        query = query?.in('vendor_id', filters?.vendorIds)
      }

      if (filters?.statuses?.length > 0) {
        query = query?.in('job_status', filters?.statuses)
      }

      if (filters?.priorities?.length > 0) {
        query = query?.in('priority', filters?.priorities)
      }

      if (filters?.overdue) {
        query = query
          ?.lt('due_date', new Date()?.toISOString())
          ?.not('job_status', 'in', '(completed,delivered,cancelled)')
      }

      // Date range filters
      if (filters?.dateFrom) {
        query = query?.gte('created_at', filters?.dateFrom?.toISOString())
      }

      if (filters?.dateTo) {
        query = query?.lte('created_at', filters?.dateTo?.toISOString())
      }

      // Order by priority and created date
      query = query
        ?.order('priority', { ascending: false })
        ?.order('created_at', { ascending: false })

      const data = await safeSelect(query, 'kanban:getAllJobsForKanban')

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error in getAllJobsForKanban:', error)
      return { data: [], error }
    }
  },

  /**
   * Update job status with validation
   */
  async updateJobStatus(jobId, newStatus, notes = '', orgId = null) {
    try {
      // First get the current job to check current status
      const currentJob = await safeSelect(
        supabase?.from('jobs')?.select('job_status, title')?.eq('id', jobId)?.single(),
        'kanban:update:fetchCurrent'
      )

      // Validate status progression
      const { data: isValidProgression, error: validationError } = await supabase?.rpc(
        'validate_status_progression',
        {
          current_status: currentJob?.job_status,
          new_status: newStatus,
        }
      )

      if (validationError) {
        throw validationError
      }

      if (!isValidProgression) {
        throw new Error(`Invalid status progression from ${currentJob.job_status} to ${newStatus}`)
      }

      // Update job status
      const updateData = {
        job_status: newStatus,
        updated_at: new Date()?.toISOString(),
      }

      // Set completed_at if moving to completed status
      if (newStatus === 'completed' && currentJob?.job_status !== 'completed') {
        updateData.completed_at = new Date()?.toISOString()
      }

      // Set started_at if moving to in_progress for the first time
      if (
        newStatus === 'in_progress' &&
        !['in_progress', 'quality_check', 'delivered', 'completed']?.includes(
          currentJob?.job_status
        )
      ) {
        updateData.started_at = new Date()?.toISOString()
      }

      let updateQ = supabase
        ?.from('jobs')
        ?.update(updateData)
        ?.eq('id', jobId)
        ?.select(
          `
          *,
          vendor:vendors(id, name, specialty),
          vehicle:vehicles(id, make, model, year, owner_name, stock_number),
          assigned_user:user_profiles!jobs_assigned_to_fkey(id, full_name)
        `
        )
        ?.single()
      if (orgId) updateQ = updateQ?.eq('org_id', orgId)
      const data = await safeSelect(updateQ, 'kanban:update:apply')

      // Log the activity
      try {
        await supabase?.rpc('log_activity', {
          entity_type: 'job',
          entity_id: jobId,
          action: 'status_changed',
          description: `Status changed from ${currentJob?.job_status} to ${newStatus}${notes ? `. Notes: ${notes}` : ''}`,
        })
      } catch (logError) {
        console.warn('Failed to log activity:', logError)
        // Don't fail the main operation if logging fails
      }

      return { data, error: null }
    } catch (error) {
      console.error('Error updating job status:', error)
      return { data: null, error }
    }
  },

  /**
   * Get jobs grouped by status for kanban columns
   */
  async getJobsByStatus(statuses, orgId = null) {
    try {
      let q = supabase
        ?.from('jobs')
        ?.select(
          `
          *,
          vendor:vendors(id, name, specialty),
          vehicle:vehicles(id, make, model, year, owner_name, stock_number),
          assigned_user:user_profiles!jobs_assigned_to_fkey(id, full_name)
        `
        )
        ?.in('job_status', statuses)
        ?.order('priority', { ascending: false })
        ?.order('created_at', { ascending: false })
      if (orgId) q = q?.eq('org_id', orgId)
      const data = await safeSelect(q, 'kanban:getJobsByStatus')

      // Group jobs by status
      const groupedJobs = {}
      statuses?.forEach((status) => {
        groupedJobs[status] = data?.filter((job) => job?.job_status === status) || []
      })

      return { data: groupedJobs, error: null }
    } catch (error) {
      console.error('Error getting jobs by status:', error)
      return { data: {}, error }
    }
  },

  /**
   * Get kanban board statistics
   */
  async getKanbanStats(orgId = null) {
    try {
      // Get jobs count by status
      let statsQ = supabase
        ?.from('jobs')
        ?.select('job_status, priority, due_date')
        ?.neq('job_status', 'cancelled')
      if (orgId) statsQ = statsQ?.eq('org_id', orgId)
      const jobStats = await safeSelect(statsQ, 'kanban:stats:jobStatus')

      const stats = {
        byStatus: {
          pending: 0,
          scheduled: 0,
          in_progress: 0,
          quality_check: 0,
          delivered: 0,
          completed: 0,
        },
        byPriority: {
          low: 0,
          medium: 0,
          high: 0,
          urgent: 0,
        },
        overdue: 0,
        total: jobStats?.length || 0,
      }

      const now = new Date()

      // Process job statistics
      jobStats?.forEach((job) => {
        // Status counts
        if (stats?.byStatus?.hasOwnProperty(job?.job_status)) {
          stats.byStatus[job.job_status]++
        }

        // Priority counts
        if (stats?.byPriority?.hasOwnProperty(job?.priority)) {
          stats.byPriority[job.priority]++
        }

        // Overdue count
        if (
          job?.due_date &&
          new Date(job.due_date) < now &&
          !['completed', 'delivered', 'cancelled']?.includes(job?.job_status)
        ) {
          stats.overdue++
        }
      })

      return { data: stats, error: null }
    } catch (error) {
      console.error('Error getting kanban stats:', error)
      return {
        data: {
          byStatus: {},
          byPriority: {},
          overdue: 0,
          total: 0,
        },
        error,
      }
    }
  },

  /**
   * Validate status transitions
   */
  async validateStatusTransition(currentStatus, newStatus) {
    try {
      const { data, error } = await supabase?.rpc('validate_status_progression', {
        current_status: currentStatus,
        new_status: newStatus,
      })

      if (error) {
        throw error
      }

      return { isValid: data || false, error: null }
    } catch (error) {
      console.error('Error validating status transition:', error)
      return { isValid: false, error }
    }
  },

  /**
   * Get available status transitions for a job
   */
  getAvailableTransitions(currentStatus) {
    const transitions = {
      pending: ['scheduled', 'in_progress', 'cancelled'],
      scheduled: ['in_progress', 'completed', 'cancelled'],
      in_progress: ['quality_check', 'completed', 'cancelled'],
      quality_check: ['delivered', 'in_progress', 'cancelled'],
      delivered: ['completed', 'cancelled'],
      completed: [], // Terminal state
      cancelled: [], // Terminal state
    }

    return transitions?.[currentStatus] || []
  },

  /**
   * Bulk update job statuses
   */
  async bulkUpdateStatus(jobIds, newStatus, notes = '') {
    try {
      const results = []

      // Process each job individually to ensure proper validation
      for (const jobId of jobIds) {
        const result = await this.updateJobStatus(jobId, newStatus, notes)
        results?.push({
          jobId,
          success: !result?.error,
          data: result?.data,
          error: result?.error,
        })
      }

      const successCount = results?.filter((r) => r?.success)?.length
      const errorCount = results?.filter((r) => !r?.success)?.length

      return {
        data: {
          results,
          summary: {
            total: jobIds?.length,
            success: successCount,
            errors: errorCount,
          },
        },
        error: null,
      }
    } catch (error) {
      console.error('Error in bulk status update:', error)
      return { data: null, error }
    }
  },

  /**
   * Search jobs across all kanban columns
   */
  async searchJobs(searchTerm, filters = {}, orgId = null) {
    try {
      let query = supabase?.from('jobs')?.select(`
          *,
          vendor:vendors(id, name, specialty),
          vehicle:vehicles(id, make, model, year, owner_name, stock_number),
          assigned_user:user_profiles!jobs_assigned_to_fkey(id, full_name)
        `)
      if (orgId) query = query?.eq('org_id', orgId)

      // Apply search term across multiple fields
      if (searchTerm) {
        query = query?.or(`
          title.ilike.%${searchTerm}%,
          description.ilike.%${searchTerm}%,
          job_number.ilike.%${searchTerm}%
        `)
      }

      // Apply additional filters
      if (filters?.statuses?.length > 0) {
        query = query?.in('job_status', filters?.statuses)
      }

      if (filters?.vendorIds?.length > 0) {
        query = query?.in('vendor_id', filters?.vendorIds)
      }

      if (filters?.priorities?.length > 0) {
        query = query?.in('priority', filters?.priorities)
      }

      const data = await safeSelect(
        query?.order('created_at', { ascending: false }),
        'kanban:search'
      )

      return { data: data || [], error: null }
    } catch (error) {
      console.error('Error searching jobs:', error)
      return { data: [], error }
    }
  },
}

export default kanbanService
