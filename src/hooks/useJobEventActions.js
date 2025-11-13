// src/hooks/useJobEventActions.js
// Logic hook for shared calendar event actions (no JSX)
// Provides consistent event handlers for open deal, reschedule, and complete actions

import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import dealService from '../services/dealService'

/**
 * Hook providing shared event action handlers for calendar views
 * @param {Object} options - Configuration options
 * @param {Function} options.onRescheduleOpen - Callback when reschedule modal should open
 * @param {Function} options.onActionComplete - Callback after action completes
 * @returns {Object} Event action handlers and state
 */
export default function useJobEventActions(options = {}) {
  const { onRescheduleOpen, onActionComplete } = options
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  /**
   * Open deal in edit mode
   * @param {string} jobId - Deal/job ID to open
   */
  const handleOpenDeal = useCallback(
    (jobId) => {
      if (!jobId) {
        setError('Invalid job ID')
        return
      }
      navigate(`/deals?edit=${jobId}`)
    },
    [navigate]
  )

  /**
   * Open reschedule modal for a job
   * @param {Object} event - Event object with job details
   */
  const handleReschedule = useCallback(
    (event) => {
      if (!event || !event.id) {
        setError('Invalid event data')
        return
      }
      
      if (onRescheduleOpen) {
        onRescheduleOpen(event)
      } else {
        console.warn('No reschedule handler provided to useJobEventActions')
      }
    },
    [onRescheduleOpen]
  )

  /**
   * Mark job as complete
   * @param {string} jobId - Deal/job ID to complete
   */
  const handleComplete = useCallback(
    async (jobId) => {
      if (!jobId) {
        setError('Invalid job ID')
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Update job status to completed
        await dealService.updateDeal(jobId, { job_status: 'completed' })
        
        if (onActionComplete) {
          onActionComplete('complete', jobId)
        }
      } catch (err) {
        console.error('Error completing job:', err)
        setError(err.message || 'Failed to complete job')
      } finally {
        setLoading(false)
      }
    },
    [onActionComplete]
  )

  /**
   * Undo completion (revert to in_progress)
   * @param {string} jobId - Deal/job ID to undo completion
   */
  const handleUndoComplete = useCallback(
    async (jobId) => {
      if (!jobId) {
        setError('Invalid job ID')
        return
      }

      setLoading(true)
      setError(null)

      try {
        // Revert job status to in_progress
        await dealService.updateDeal(jobId, { job_status: 'in_progress' })
        
        if (onActionComplete) {
          onActionComplete('undo-complete', jobId)
        }
      } catch (err) {
        console.error('Error undoing completion:', err)
        setError(err.message || 'Failed to undo completion')
      } finally {
        setLoading(false)
      }
    },
    [onActionComplete]
  )

  /**
   * Clear error state
   */
  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    loading,
    error,
    clearError,
    handleOpenDeal,
    handleReschedule,
    handleComplete,
    handleUndoComplete,
  }
}
