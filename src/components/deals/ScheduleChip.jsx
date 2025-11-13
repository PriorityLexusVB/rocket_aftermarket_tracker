// src/components/deals/ScheduleChip.jsx
// Compact clickable chip showing formatted schedule range
import React from 'react'
import { formatScheduleRange } from '../../utils/dateTimeUtils'
import { useNavigate } from 'react-router-dom'

/**
 * ScheduleChip - Render a compact clickable chip showing formatted schedule range
 * 
 * @param {Object} props
 * @param {string} props.scheduledStartTime - Start time ISO timestamp
 * @param {string} props.scheduledEndTime - End time ISO timestamp
 * @param {string} props.jobId - Job ID for navigation
 * @param {boolean} props.enableAgendaNavigation - Enable navigation to agenda view
 * @param {Function} props.onClick - Fallback click handler if navigation disabled
 * @returns {JSX.Element|null}
 */
export default function ScheduleChip({
  scheduledStartTime,
  scheduledEndTime,
  jobId,
  enableAgendaNavigation = false,
  onClick,
}) {
  const navigate = useNavigate()

  // If no schedule times, don't render anything
  if (!scheduledStartTime) {
    return null
  }

  const formattedRange = formatScheduleRange(scheduledStartTime, scheduledEndTime)

  // If formatting failed, show placeholder
  if (formattedRange === '—' || !formattedRange) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
        Not Scheduled
      </span>
    )
  }

  const handleClick = () => {
    if (enableAgendaNavigation && jobId) {
      // Navigate to calendar agenda view with this job highlighted
      navigate(`/calendar-agenda?jobId=${jobId}`)
    } else if (onClick) {
      onClick()
    }
  }

  const isClickable = enableAgendaNavigation || onClick

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={!isClickable}
      className={`
        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
        ${isClickable 
          ? 'bg-blue-100 text-blue-800 hover:bg-blue-200 cursor-pointer' 
          : 'bg-blue-100 text-blue-800 cursor-default'}
        transition-colors duration-150
      `}
      aria-label={`Scheduled: ${formattedRange}`}
      data-testid="schedule-chip"
    >
      <svg
        className="mr-1 h-3 w-3"
        fill="currentColor"
        viewBox="0 0 20 20"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
          clipRule="evenodd"
        />
      </svg>
      {formattedRange}
    </button>
  )
}
