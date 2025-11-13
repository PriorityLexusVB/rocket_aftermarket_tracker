// src/pages/calendar-agenda/RescheduleModal.jsx
// Functional reschedule modal with validation and timezone support
import React, { useState, useEffect, useRef } from 'react'
import { toLocalDateTimeFields, fromLocalDateTimeFields, validateScheduleRange } from '../../utils/dateTimeUtils'
import Button from '../../components/ui/Button'
import Icon from '../../components/ui/Icon'

export default function RescheduleModal({ open, onClose, onSubmit, event }) {
  const dialogRef = useRef(null)
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [validationError, setValidationError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Initialize form fields when modal opens or event changes
  useEffect(() => {
    if (open && event) {
      setStartTime(toLocalDateTimeFields(event.scheduled_start_time || event.start))
      setEndTime(toLocalDateTimeFields(event.scheduled_end_time || event.end))
      setLocation(event.location || '')
      setNotes(event.scheduling_notes || '')
      setValidationError('')
    }
  }, [open, event])

  const handleClose = () => {
    setValidationError('')
    setIsSubmitting(false)
    onClose?.()
  }

  // Handle ESC key
  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => {
      if (e.key === 'Escape') handleClose()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose]) // Added onClose to dependencies since handleClose uses it

  const handleSubmit = async () => {
    setValidationError('')

    // Validate required fields
    if (!startTime) {
      setValidationError('Start time is required')
      return
    }

    if (!endTime) {
      setValidationError('End time is required')
      return
    }

    // Convert to UTC ISO strings for validation
    const startISO = fromLocalDateTimeFields(startTime)
    const endISO = fromLocalDateTimeFields(endTime)

    // Validate that end > start
    if (!validateScheduleRange(startISO, endISO)) {
      setValidationError('End time must be after start time')
      return
    }

    setIsSubmitting(true)

    try {
      // Submit with UTC ISO strings
      await onSubmit?.({
        jobId: event?.id || event?.jobId,
        scheduled_start_time: startISO,
        scheduled_end_time: endISO,
        location: location.trim(),
        scheduling_notes: notes.trim(),
      })
      handleClose()
    } catch (error) {
      setValidationError(error.message || 'Failed to reschedule')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reschedule appointment"
      onClick={(e) => {
        // Click outside to close
        if (e.target === e.currentTarget) handleClose()
      }}
    >
      <div ref={dialogRef} className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Reschedule Appointment</h2>
            <button
              onClick={handleClose}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Close modal"
            >
              <Icon name="X" size={20} />
            </button>
          </div>

          {/* Event info */}
          {event?.title && (
            <div className="mb-4 p-3 bg-slate-50 rounded">
              <p className="text-sm font-medium text-slate-700">{event.title}</p>
              {event?.customer_name && (
                <p className="text-xs text-slate-500 mt-1">{event.customer_name}</p>
              )}
            </div>
          )}

          {/* Error message */}
          {validationError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded">
              <div className="flex items-start">
                <Icon name="AlertCircle" size={16} className="text-red-500 mt-0.5 mr-2" />
                <p className="text-sm text-red-700">{validationError}</p>
              </div>
            </div>
          )}

          {/* Form fields */}
          <div className="space-y-4">
            <div>
              <label htmlFor="reschedule-start" className="block text-sm font-medium text-slate-700 mb-1">
                Start Time <span className="text-red-500">*</span>
              </label>
              <input
                id="reschedule-start"
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="reschedule-end" className="block text-sm font-medium text-slate-700 mb-1">
                End Time <span className="text-red-500">*</span>
              </label>
              <input
                id="reschedule-end"
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="reschedule-location" className="block text-sm font-medium text-slate-700 mb-1">
                Location
              </label>
              <input
                id="reschedule-location"
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g., Bay 3, Service Drive"
                className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="reschedule-notes" className="block text-sm font-medium text-slate-700 mb-1">
                Notes
              </label>
              <textarea
                id="reschedule-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add scheduling notes..."
                rows={3}
                className="w-full px-3 py-2 border border-slate-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={isSubmitting}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex gap-3">
            <Button
              variant="outline"
              onClick={handleClose}
              className="flex-1"
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              disabled={isSubmitting}
            >
              {isSubmitting ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
