// src/components/deals/ScheduleChip.jsx
// Displays a formatted schedule range and provides navigation affordances.
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { formatScheduleRange } from '@/utils/dateTimeUtils'

/**
 * Helper to extract schedule times from a deal object with fallback logic.
 * Priority: job-level times > earliest line item times > legacy appt fields
 */
function extractScheduleTimes(deal) {
  if (!deal) return { startTime: null, endTime: null }
  
  // 1. Check job-level scheduling first
  if (deal.scheduled_start_time && deal.scheduled_end_time) {
    return {
      startTime: deal.scheduled_start_time,
      endTime: deal.scheduled_end_time
    }
  }
  
  // 2. Fallback: derive from earliest line item times if available
  if (Array.isArray(deal.job_parts)) {
    const scheduledParts = deal.job_parts
      .filter(p => p?.scheduled_start_time && p?.scheduled_end_time)
      .sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time))
    
    if (scheduledParts.length > 0) {
      return {
        startTime: scheduledParts[0].scheduled_start_time,
        endTime: scheduledParts[0].scheduled_end_time
      }
    }
  }
  
  // 3. Legacy fallback: check appt_start/appt_end fields
  if (deal.appt_start) {
    return {
      startTime: deal.appt_start,
      endTime: deal.appt_end || null
    }
  }
  
  return { startTime: null, endTime: null }
}

export default function ScheduleChip({ 
  scheduledStartTime, 
  scheduledEndTime, 
  deal,
  jobId, 
  enableAgendaNavigation = false,
  onClick,
  showIcon = false,
  Icon,
  className = '' 
}) {
  const navigate = useNavigate()
  
  // If deal object is provided, extract times with fallback logic
  let startTime = scheduledStartTime
  let endTime = scheduledEndTime
  let effectiveJobId = jobId
  
  if (deal) {
    if (!startTime) {
      const extracted = extractScheduleTimes(deal)
      startTime = extracted.startTime
      endTime = extracted.endTime
    }
    // Use deal.id if jobId not explicitly provided
    if (!effectiveJobId) {
      effectiveJobId = deal.id
    }
  }
  
  if (!startTime) return null
  
  const label = formatScheduleRange(startTime, endTime)
  
  // Default styling or custom className
  const defaultClassName = "inline-flex items-center gap-1 rounded-full bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-medium px-2 py-1 transition"
  const finalClassName = className || defaultClassName

  const handleClick = (e) => {
    e?.stopPropagation?.()
    
    // If custom onClick provided, use it
    if (onClick) {
      onClick(deal)
      return
    }
    
    // Otherwise, navigate based on enableAgendaNavigation flag
    if (enableAgendaNavigation && effectiveJobId) {
      navigate(`/calendar/agenda?focus=${encodeURIComponent(effectiveJobId)}`)
    } else if (effectiveJobId) {
      navigate(`/deals/${effectiveJobId}/edit`)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={finalClassName}
      aria-label={`Schedule: ${label}`}
      title="Click to view in agenda"
      data-testid="schedule-chip"
    >
      {showIcon && Icon && <Icon name="Clock" size={12} className="mr-1" />}
      <span>{label}</span>
      {enableAgendaNavigation && <span aria-hidden="true" className="text-indigo-400">↗</span>}
    </button>
  )
}
