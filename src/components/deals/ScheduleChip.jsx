// src/components/deals/ScheduleChip.jsx
// Schedule chip component for deals list
import React from 'react'
import { formatScheduleRange } from '../../utils/dateTimeUtils'
import { useNavigate } from 'react-router-dom'

/**
 * Display scheduled time as a clickable chip
 * @param {Object} props
 * @param {string} props.scheduledStartTime - ISO datetime string
 * @param {string} props.scheduledEndTime - ISO datetime string
 * @param {string} props.jobId - Job ID for navigation
 * @param {boolean} props.enableAgendaNavigation - If true, navigate to agenda; otherwise edit deal
 */
export default function ScheduleChip({
  scheduledStartTime,
  scheduledEndTime,
  jobId,
  enableAgendaNavigation = false,
}) {
  const navigate = useNavigate()

  if (!scheduledStartTime) {
    return <span className="text-xs text-gray-500">—</span>
  }

  const formattedRange = formatScheduleRange(scheduledStartTime, scheduledEndTime)

  const handleClick = (e) => {
    e.stopPropagation() // Prevent row click

    if (enableAgendaNavigation) {
      // Navigate to agenda view with this job highlighted
      navigate(`/calendar/agenda?job=${jobId}`)
    } else {
      // Navigate to edit deal
      navigate(`/deals?edit=${jobId}`)
    }
  }

  return (
    <button
      onClick={handleClick}
      className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition-colors"
      title="Click to view/edit schedule"
      data-testid="schedule-chip"
    >
      {formattedRange}
    </button>
  )
}
