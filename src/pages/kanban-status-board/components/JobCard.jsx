import React from 'react'
import { Calendar, User, Wrench, AlertTriangle, Clock, MapPin } from 'lucide-react'

// Service Location Tag Component matching deals page implementation
const ServiceLocationTag = ({ jobParts }) => {
  if (!jobParts || jobParts?.length === 0) {
    return <span className="text-xs text-gray-500">No items</span>
  }

  const hasOffSite = jobParts?.some((part) => part?.is_off_site)
  const hasOnSite = jobParts?.some((part) => !part?.is_off_site)

  if (hasOffSite && hasOnSite) {
    return (
      <div className="flex flex-col space-y-1">
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
          🏢 Off-Site
        </span>
        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
          🏠 On-Site
        </span>
      </div>
    )
  }

  if (hasOffSite) {
    return (
      <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
        🏢 Off-Site
      </span>
    )
  }

  return (
    <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
      🏠 On-Site
    </span>
  )
}

const JobCard = ({ job, isOverdue = false, onDragStart, onDragEnd, onClick }) => {
  const getPriorityColor = (priority) => {
    const colors = {
      low: 'border-green-500 bg-green-50',
      medium: 'border-yellow-500 bg-yellow-50',
      high: 'border-orange-500 bg-orange-50',
      urgent: 'border-red-500 bg-red-50',
    }
    return colors?.[priority] || colors?.medium
  }

  const getPriorityIndicator = (priority) => {
    const colors = {
      low: 'bg-green-500',
      medium: 'bg-yellow-500',
      high: 'bg-orange-500',
      urgent: 'bg-red-500',
    }
    return colors?.[priority] || colors?.medium
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date?.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      ...(date?.getFullYear() !== new Date()?.getFullYear() && { year: 'numeric' }),
    })
  }

  const formatTime = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date?.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  return (
    <div
      className={`
        bg-white rounded-lg border-2 p-3 shadow-sm cursor-pointer
        hover:shadow-md transition-all duration-200
        ${isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'}
        hover:border-blue-300
      `}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      {/* Header with priority and overdue indicator */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center space-x-2">
          {/* Priority indicator */}
          <div className={`w-3 h-3 rounded-full ${getPriorityIndicator(job?.priority)}`} />

          {/* Job number */}
          <span className="text-xs text-gray-500 font-mono">{job?.job_number}</span>
        </div>

        {/* Overdue badge */}
        {isOverdue && (
          <div className="flex items-center space-x-1 bg-red-100 text-red-700 px-2 py-1 rounded-full">
            <AlertTriangle className="h-3 w-3" />
            <span className="text-xs font-medium">Overdue</span>
          </div>
        )}
      </div>
      {/* Job title */}
      <h4 className="font-semibold text-gray-900 mb-2 line-clamp-2">{job?.title}</h4>
      {/* Vehicle info */}
      {job?.vehicle && (
        <div className="flex items-center space-x-1 text-sm text-gray-600 mb-2">
          <Wrench className="h-4 w-4" />
          <span className="truncate">
            {job?.vehicle?.year} {job?.vehicle?.make} {job?.vehicle?.model}
            {job?.vehicle?.stock_number && ` (${job?.vehicle?.stock_number})`}
          </span>
        </div>
      )}
      {/* Customer info (fallback: job.customer_name → vehicle.owner_name → '—') */}
      {(() => {
        const customerName = job?.customer_name || job?.vehicle?.owner_name || null
        return customerName ? (
          <div className="flex items-center space-x-1 text-sm text-gray-600 mb-2">
            <User className="h-4 w-4" />
            <span className="truncate">{customerName}</span>
          </div>
        ) : null
      })()}
      {/* Service Location Pills - NEW */}
      {job?.job_parts && job?.job_parts?.length > 0 && (
        <div className="mb-2">
          <ServiceLocationTag jobParts={job?.job_parts} />
        </div>
      )}
      {/* Vendor assignment */}
      {job?.vendor && (
        <div className="flex items-center space-x-1 text-sm text-gray-600 mb-2">
          <User className="h-4 w-4" />
          <span className="truncate">{job?.vendor?.name}</span>
          {job?.vendor?.specialty && (
            <span className="text-xs text-gray-500">({job?.vendor?.specialty})</span>
          )}
        </div>
      )}
      {/* Location */}
      {job?.location && (
        <div className="flex items-center space-x-1 text-sm text-gray-600 mb-2">
          <MapPin className="h-4 w-4" />
          <span className="truncate">{job?.location}</span>
        </div>
      )}
      {/* Scheduling info */}
      {job?.scheduled_start_time && (
        <div className="bg-gray-50 rounded-lg p-2 mb-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-1 text-gray-600">
              <Calendar className="h-3 w-3" />
              <span>{formatDate(job?.scheduled_start_time)}</span>
            </div>
            <div className="flex items-center space-x-1 text-gray-600">
              <Clock className="h-3 w-3" />
              <span>
                {formatTime(job?.scheduled_start_time)}
                {job?.scheduled_end_time && ` - ${formatTime(job?.scheduled_end_time)}`}
              </span>
            </div>
          </div>
        </div>
      )}
      {/* Due date */}
      {job?.due_date && (
        <div
          className={`
          flex items-center space-x-1 text-xs mb-2
          ${isOverdue ? 'text-red-600' : 'text-gray-600'}
        `}
        >
          <Calendar className="h-3 w-3" />
          <span>Due: {formatDate(job?.due_date)}</span>
        </div>
      )}
      {/* Description preview */}
      {job?.description && (
        <p className="text-sm text-gray-600 line-clamp-2 mb-2">{job?.description}</p>
      )}
      {/* Footer with estimated time and priority */}
      <div className="flex items-center justify-between pt-2 border-t border-gray-100">
        <div className="flex items-center space-x-2">
          {job?.estimated_hours && (
            <div className="flex items-center space-x-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              <span>{job?.estimated_hours}h est.</span>
            </div>
          )}
        </div>

        <div
          className={`
          px-2 py-1 rounded-full text-xs font-medium
          ${getPriorityColor(job?.priority)}
        `}
        >
          {job?.priority?.charAt(0)?.toUpperCase() + job?.priority?.slice(1)}
        </div>
      </div>
    </div>
  )
}

export default JobCard
