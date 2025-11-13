// src/components/deals/ScheduleChip.jsx
// Displays a formatted schedule range and provides navigation affordances.
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { formatScheduleRange } from '@/utils/dateTimeUtils'

export default function ScheduleChip({ scheduledStartTime, scheduledEndTime, jobId, enableAgendaNavigation = false, className = '' }) {
  const navigate = useNavigate()
  
  if (!scheduledStartTime) return null
  
  const label = formatScheduleRange(scheduledStartTime, scheduledEndTime)

  return (
    <button
      type="button"
      onClick={() => {
        if (enableAgendaNavigation) {
          navigate(`/calendar/agenda?focus=${encodeURIComponent(jobId)}`)
        } else {
          navigate(`/deals/${jobId}/edit`)
        }
      }}
      className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-1 transition ${className}`}
      aria-label={`Open scheduling context for deal ${jobId}`}
      data-testid="schedule-chip"
    >
      <span>{label}</span>
      {enableAgendaNavigation && <span aria-hidden="true" className="text-indigo-400">↗</span>}
    </button>
  )
}
