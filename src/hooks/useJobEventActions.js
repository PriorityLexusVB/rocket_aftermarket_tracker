// src/utils/useJobEventActions.js
// Shared logic utility for common job event actions across calendar views
// Pure logic hook - accepts dependencies, returns action handlers
// No JSX - only business logic

/**
 * Shared job event actions hook
 * Provides consistent handlers for: open deal, reschedule, complete job
 * 
 * @param {Object} deps - Dependencies object
 * @param {Function} deps.navigate - React Router navigate function
 * @param {Object} deps.toast - Toast notification object with success/error methods
 * @param {Object} deps.jobService - Job service for API calls
 * @param {Object} deps.calendarService - Calendar service for scheduling operations
 * @param {Function} deps.onReschedule - Callback to open reschedule modal with job data
 * @param {Function} deps.onRefresh - Optional callback to refresh data after operations
 * @returns {Object} Action handlers
 */
export function useJobEventActions(deps) {
  const {
    navigate,
    toast,
    jobService,
    calendarService,
    onReschedule,
    onRefresh,
  } = deps || {}

  /**
   * Navigate to deal detail page
   * @param {string} jobId - Job ID to open
   */
  const openDeal = (jobId) => {
    if (!jobId) {
      console.warn('[useJobEventActions] openDeal called without jobId')
      return
    }
    
    if (navigate) {
      navigate(`/deals/edit/${jobId}`)
    } else {
      console.warn('[useJobEventActions] navigate function not provided')
    }
  }

  /**
   * Open reschedule modal for a job
   * @param {Object} job - Job object to reschedule
   */
  const openRescheduleModal = (job) => {
    if (!job) {
      console.warn('[useJobEventActions] openRescheduleModal called without job')
      return
    }
    
    if (onReschedule) {
      onReschedule(job)
    } else {
      console.warn('[useJobEventActions] onReschedule callback not provided')
    }
  }

  /**
   * Mark job as complete with undo support
   * @param {Object} job - Job object to complete
   * @param {Object} options - Additional options
   * @param {Function} options.onUndoAvailable - Callback when undo is available (receives jobId, prevStatus, timeoutId)
   * @returns {Promise<void>}
   */
  const completeJob = async (job, options = {}) => {
    if (!job || !job.id) {
      console.warn('[useJobEventActions] completeJob called without valid job')
      return
    }

    const { onUndoAvailable } = options
    const prevStatus = job?.job_status || 'scheduled'
    const jobTitle = job?.title || job?.job_number || 'Job'

    try {
      if (!jobService) {
        throw new Error('jobService not provided')
      }

      // Update job status to completed
      await jobService.updateStatus(job.id, 'completed', {
        completed_at: new Date().toISOString(),
      })

      // Show success message
      const message = `Marked "${jobTitle}" as completed`
      toast?.success?.(message)

      // Refresh data if callback provided
      if (onRefresh) {
        await onRefresh()
      }

      // Set up undo window if callback provided
      if (onUndoAvailable) {
        const timeoutId = setTimeout(() => {
          // Timeout expired, undo no longer available
          onUndoAvailable(job.id, null, null)
        }, 10000) // 10 second undo window

        onUndoAvailable(job.id, prevStatus, timeoutId)
      }
    } catch (e) {
      console.error('[useJobEventActions] completeJob failed:', e)
      const errorMsg = 'Failed to mark job as completed'
      toast?.error?.(errorMsg)
    }
  }

  /**
   * Undo a completed job
   * @param {string} jobId - Job ID to undo
   * @param {string} prevStatus - Previous status to restore
   * @param {number} timeoutId - Timeout ID to clear
   * @returns {Promise<void>}
   */
  const undoComplete = async (jobId, prevStatus, timeoutId) => {
    if (!jobId || !prevStatus) {
      console.warn('[useJobEventActions] undoComplete called with invalid parameters')
      return
    }

    try {
      if (!jobService) {
        throw new Error('jobService not provided')
      }

      // Clear timeout if provided
      if (timeoutId) {
        clearTimeout(timeoutId)
      }

      // Restore previous status
      await jobService.updateStatus(jobId, prevStatus, {
        completed_at: null,
      })

      const message = 'Job completion undone'
      toast?.success?.(message)

      // Refresh data if callback provided
      if (onRefresh) {
        await onRefresh()
      }
    } catch (e) {
      console.error('[useJobEventActions] undoComplete failed:', e)
      const errorMsg = 'Failed to undo completion'
      toast?.error?.(errorMsg)
    }
  }

  /**
   * Update job schedule (used by reschedule modal)
   * @param {string} jobId - Job ID to update
   * @param {Object} scheduleData - Schedule data
   * @param {Date|string} scheduleData.startTime - Start time
   * @param {Date|string} scheduleData.endTime - End time
   * @param {string} scheduleData.location - Location (optional)
   * @param {string} scheduleData.notes - Calendar notes (optional)
   * @param {string} scheduleData.colorCode - Color code (optional)
   * @param {string} orgId - Organization ID (optional)
   * @returns {Promise<void>}
   */
  const updateSchedule = async (jobId, scheduleData, orgId = null) => {
    if (!jobId || !scheduleData) {
      console.warn('[useJobEventActions] updateSchedule called with invalid parameters')
      return
    }

    try {
      // Prefer calendarService for scheduling updates, fallback to jobService
      if (calendarService?.updateJobSchedule) {
        await calendarService.updateJobSchedule(jobId, scheduleData, orgId)
      } else if (jobService?.updateJob) {
        // Fallback to direct job update
        const updateData = {
          scheduled_start_time: scheduleData?.startTime,
          scheduled_end_time: scheduleData?.endTime,
          location: scheduleData?.location,
          calendar_notes: scheduleData?.notes,
          color_code: scheduleData?.colorCode,
        }
        
        // Remove undefined values
        Object.keys(updateData).forEach((key) => {
          if (updateData[key] === undefined) {
            delete updateData[key]
          }
        })
        
        await jobService.updateJob(jobId, updateData)
      } else {
        throw new Error('No service available for schedule update')
      }

      const message = 'Schedule updated successfully'
      toast?.success?.(message)

      // Refresh data if callback provided
      if (onRefresh) {
        await onRefresh()
      }
    } catch (e) {
      console.error('[useJobEventActions] updateSchedule failed:', e)
      const errorMsg = 'Failed to update schedule'
      toast?.error?.(errorMsg)
      throw e // Re-throw to allow caller to handle
    }
  }

  return {
    // Primary API (matching problem statement)
    handleOpenDeal: openDeal,
    handleReschedule: openRescheduleModal,
    handleComplete: completeJob,
    handleUndoComplete: undoComplete,
    // Backward compatibility
    openDeal,
    openRescheduleModal,
    completeJob,
    undoComplete,
    updateSchedule,
  }
}
