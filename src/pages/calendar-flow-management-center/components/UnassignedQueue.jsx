import React from 'react'
import { Car, Clock, Calendar, AlertTriangle, Package } from 'lucide-react'
import { formatTime, isOverdue, getStatusBadge } from '../../../lib/time'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'

const UnassignedQueue = ({ jobs, onJobClick, onDragStart, loading }) => {
  const renderUnassignedJob = (job) => {
    const promise = job?.next_promised_iso || job?.promised_date || job?.promisedAt || null
    const overdue = isOverdue(promise)
    const statusBadge = getStatusBadge(job?.job_status)

    return (
      <div
        key={job?.id}
        className="bg-white rounded-lg border border-gray-200 p-4 mb-3 cursor-pointer hover:shadow-md transition-all duration-200 hover:border-blue-300"
        onClick={() => onJobClick?.(job)}
        draggable
        onDragStart={() => onDragStart?.(job)}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center">
            <Car className="h-4 w-4 text-gray-600 mr-2" />
            <span className="font-medium text-gray-900">{job?.job_number?.split('-')?.pop()}</span>
            {overdue && <AlertTriangle className="h-4 w-4 text-red-500 ml-2" />}
          </div>
          <div
            className={`
            px-2 py-1 rounded-full text-xs font-medium
            ${statusBadge?.bg || 'bg-gray-100'} 
            ${statusBadge?.textColor || 'text-gray-800'}
          `}
          >
            {statusBadge?.label || job?.job_status?.toUpperCase()}
          </div>
        </div>

        {/* Job Title */}
        <div className="text-sm font-medium text-gray-800 mb-2 flex items-center">
          <Package className="h-3 w-3 text-gray-500 mr-1" />
          {job?.title}
        </div>

        {/* Vehicle Info */}
        <div className="text-xs text-gray-600 mb-2">{job?.vehicle_info}</div>

        {/* Time and Promise Info */}
        <div className="space-y-1">
          {job?.scheduled_start_time && (
            <div className="flex items-center text-xs text-gray-600">
              <Clock className="h-3 w-3 mr-1" />
              {formatTime(job?.scheduled_start_time)}–{formatTime(job?.scheduled_end_time)}
            </div>
          )}

          <div
            className={`flex items-center text-xs ${overdue ? 'text-red-600' : 'text-gray-600'}`}
          >
            <Calendar className="h-3 w-3 mr-1" />
            Promise: {formatEtDateLabel(promise) || '—'}
            {overdue && (
              <span className="ml-2 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-medium">
                Overdue
              </span>
            )}
          </div>

          {/* Estimated Hours */}
          {job?.estimated_hours && (
            <div className="flex items-center text-xs text-gray-600">
              <Clock className="h-3 w-3 mr-1" />
              {job?.estimated_hours}h estimated
            </div>
          )}
        </div>

        {/* Drag Indicator */}
        <div className="mt-3 pt-2 border-t border-gray-100">
          <div className="text-xs text-gray-500 text-center">
            Drag to assign vendor or time slot
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-gray-900">Scheduled (No Time)</h2>
          <div className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full font-medium">
            {jobs?.length || 0}
          </div>
        </div>
        <p className="text-xs text-gray-600 mt-1">Drag onto calendar to assign a time/vendor</p>
      </div>

      {/* Job List */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
          </div>
        ) : jobs?.length > 0 ? (
          <div className="space-y-3">{jobs?.map(renderUnassignedJob)}</div>
        ) : (
          <div className="text-center py-8">
            <Car className="h-8 w-8 text-gray-400 mx-auto mb-3" />
            <div className="text-sm text-gray-600">No scheduled items without time</div>
            <div className="text-xs text-gray-500 mt-1">Everything has a time window</div>
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="p-4 bg-white border-t border-gray-200">
        <div className="text-xs text-gray-600 space-y-1">
          <div className="flex items-center">
            <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
            Drop on calendar for On-Site
          </div>
          <div className="flex items-center">
            <div className="w-2 h-2 bg-orange-500 rounded-full mr-2"></div>
            Drop on vendor lane for Off-Site
          </div>
        </div>
      </div>
    </div>
  )
}

export default UnassignedQueue
