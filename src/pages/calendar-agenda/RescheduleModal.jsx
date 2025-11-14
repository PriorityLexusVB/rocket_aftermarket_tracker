// src/pages/calendar-agenda/RescheduleModal.jsx
// Full-featured reschedule modal with datetime-local inputs and validation
// Uses America/New_York timezone for all datetime-local fields
// Updated: Reads and aggregates scheduling from line items (job_parts)
import React, { useEffect, useRef, useState } from 'react'
import { toLocalDateTimeFields, fromLocalDateTimeFields, validateScheduleRange } from '../../utils/dateTimeUtils'

export default function RescheduleModal({ 
  open, 
  onClose, 
  onSubmit, 
  initialStart, 
  initialEnd,
  job 
}) {
  const dialogRef = useRef(null)
  const startInputRef = useRef(null)
  
  // Local state for form fields
  const [startLocal, setStartLocal] = useState('')
  const [endLocal, setEndLocal] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Initialize form fields when modal opens or job changes
  useEffect(() => {
    if (open) {
      // Compute aggregated schedule from line items (new line-item scheduling model)
      let start = initialStart
      let end = initialEnd
      
      // If no explicit start AND end provided, compute from job's line items
      if (!start && !end) {
        const lineItems = job?.job_parts || []
        const scheduledItems = lineItems.filter(
          (item) => item?.scheduled_start_time && item?.scheduled_end_time
        )
        
        if (scheduledItems.length > 0) {
          // Aggregate: earliest start, latest end
          const starts = scheduledItems.map((item) => new Date(item.scheduled_start_time))
          const ends = scheduledItems.map((item) => new Date(item.scheduled_end_time))
          start = new Date(Math.min(...starts)).toISOString()
          end = new Date(Math.max(...ends)).toISOString()
        } else {
          // Fallback to job-level fields (backward compatibility)
          start = start || job?.scheduled_start_time
          end = end || job?.scheduled_end_time
        }
      }
      
      // Convert ISO to datetime-local format (YYYY-MM-DDTHH:MM)
      const startFields = start ? toLocalDateTimeFields(start) : null
      const endFields = end ? toLocalDateTimeFields(end) : null
      
      setStartLocal(startFields && startFields.date && startFields.time 
        ? `${startFields.date}T${startFields.time}` 
        : '')
      setEndLocal(endFields && endFields.date && endFields.time 
        ? `${endFields.date}T${endFields.time}` 
        : '')
      setError('')
      setSubmitting(false)
      
      // Focus start input when modal opens
      setTimeout(() => {
        startInputRef.current?.focus()
      }, 100)
    }
  }, [open, initialStart, initialEnd, job])

  // Handle ESC key
  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => {
      if (e.key === 'Escape') {
        onClose?.()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  // Validate that end > start using validateScheduleRange
  const validate = () => {
    if (!startLocal) {
      setError('Start time is required')
      return false
    }
    
    if (!endLocal) {
      setError('End time is required')
      return false
    }

    // Convert datetime-local format (YYYY-MM-DDTHH:MM) to fields object
    const [startDate, startTime] = startLocal.split('T')
    const [endDate, endTime] = endLocal.split('T')
    
    const startISO = fromLocalDateTimeFields({ date: startDate, time: startTime })
    const endISO = fromLocalDateTimeFields({ date: endDate, time: endTime })
    
    if (!startISO || !endISO) {
      setError('Invalid date/time format')
      return false
    }

    const validation = validateScheduleRange(startISO, endISO)
    if (!validation.valid) {
      setError(validation.errors[0] === 'end_not_after_start' ? 'End time must be after start time' : 'Invalid schedule')
      return false
    }

    setError('')
    return true
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    
    if (!validate()) {
      return
    }

    setSubmitting(true)
    
    try {
      // Convert datetime-local format to ISO
      const [startDate, startTime] = startLocal.split('T')
      const [endDate, endTime] = endLocal.split('T')
      
      const startISO = fromLocalDateTimeFields({ date: startDate, time: startTime })
      const endISO = fromLocalDateTimeFields({ date: endDate, time: endTime })
      
      await onSubmit?.({
        startTime: startISO,
        endTime: endISO,
      })
      
      // Don't close here - let parent handle closing after successful submit
    } catch (err) {
      console.error('[RescheduleModal] submit failed:', err)
      setError(err?.message || 'Failed to reschedule')
      setSubmitting(false)
    }
  }

  const handleCancel = () => {
    setError('')
    onClose?.()
  }

  if (!open) return null

  const jobTitle = job?.title || job?.job_number || 'Appointment'
  const isValid = !error && startLocal && endLocal && !submitting
  
  // Handle button click - validate even if fields are empty
  const handleSaveClick = (e) => {
    if (!startLocal || !endLocal) {
      e.preventDefault()
      validate()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reschedule-title"
      onClick={(e) => {
        // Click outside to close
        if (e.target === e.currentTarget && !submitting) {
          handleCancel()
        }
      }}
    >
      <div 
        ref={dialogRef} 
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md"
      >
        <h2 id="reschedule-title" className="text-xl font-semibold mb-4">
          Reschedule Appointment
        </h2>
        
        <p className="text-sm text-gray-600 mb-4">
          {jobTitle}
        </p>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4">
            {/* Start Time */}
            <div>
              <label 
                htmlFor="reschedule-start" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                ref={startInputRef}
                id="reschedule-start"
                type="datetime-local"
                value={startLocal || ''}
                onChange={(e) => {
                  setStartLocal(e.target.value)
                  setError('') // Clear error on change
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={submitting}
              />
            </div>

            {/* End Time */}
            <div>
              <label 
                htmlFor="reschedule-end" 
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                id="reschedule-end"
                type="datetime-local"
                value={endLocal || ''}
                onChange={(e) => {
                  setEndLocal(e.target.value)
                  setError('') // Clear error on change
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                required
                disabled={submitting}
              />
            </div>

            {/* Timezone Note */}
            <p className="text-xs text-gray-500">
              All times are in America/New_York timezone
            </p>

            {/* Error Display */}
            {error && (
              <div 
                className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-700"
                role="alert"
              >
                {error}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-6 flex justify-end gap-3">
            <button
              type="button"
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              onClick={handleCancel}
              disabled={submitting}
              aria-label="Cancel reschedule"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={submitting}
              onClick={handleSaveClick}
              aria-label="Save new schedule"
            >
              {submitting ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
