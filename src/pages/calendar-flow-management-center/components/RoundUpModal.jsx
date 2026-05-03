import React, { useState, useMemo, useEffect } from 'react'
import {
  X,
  Download,
  Copy,
  FileText,
  Calendar,
  Clock,
  Car,
  Building2,
  MapPin,
  GitBranch,
  CheckCircle,
  RefreshCw,
  XCircle,
  RotateCcw,
} from 'lucide-react'
import { formatTime, getStatusBadge } from '../../../lib/time'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'
import { isJobOnSite, getJobLocationType } from '@/utils/locationType'

const groupByVendor = (jobList) => {
  return jobList?.reduce((acc, job) => {
    const vendorName = job?.vendor_name || (job?.vendor_id ? 'Vendor' : 'In-House')
    if (!acc?.[vendorName]) {
      acc[vendorName] = []
    }
    acc?.[vendorName]?.push(job)
    return acc
  }, {})
}

const groupJobsByDay = (jobList, baseDate = new Date()) => {
  const target = baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? new Date(baseDate) : new Date()
  target.setHours(0, 0, 0, 0)

  const targetJobs = jobList?.filter((job) => {
    const jobDate = new Date(job?.scheduled_start_time)
    return jobDate?.toDateString() === target?.toDateString()
  })

  return {
    [target.toDateString() === new Date().toDateString() ? 'Today' : target.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })]: {
      onSite: targetJobs?.filter((job) => isJobOnSite(job)),
      vendors: groupByVendor(targetJobs?.filter((job) => !isJobOnSite(job))),
    },
  }
}

const groupJobsByWeek = (jobList) => {
  // Monday-first week: index 0=Mon, 1=Tue ... 6=Sun. JS Date.getDay(): 0=Sun, 1=Mon ... 6=Sat.
  const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const result = {}

  weekDays?.forEach((day, idx) => {
    const targetDayOfWeek = idx === 6 ? 0 : idx + 1 // Sunday wraps to JS getDay()=0
    const dayJobs = jobList?.filter((job) => {
      const jobDate = new Date(job?.scheduled_start_time)
      return jobDate?.getDay() === targetDayOfWeek
    })

    if (dayJobs?.length > 0) {
      result[day] = {
        onSite: dayJobs?.filter((job) => isJobOnSite(job)),
        vendors: groupByVendor(dayJobs?.filter((job) => !isJobOnSite(job))),
      }
    }
  })

  return result
}

const groupJobsByMonth = (jobList) => {
  const weeks = {}
  jobList?.forEach((job) => {
    const jobDate = new Date(job?.scheduled_start_time)
    const weekNumber = Math.ceil(jobDate?.getDate() / 7)
    const weekKey = `Week ${weekNumber}`

    if (!weeks?.[weekKey]) {
      weeks[weekKey] = {
        onSite: [],
        vendors: {},
      }
    }

    if (isJobOnSite(job)) {
      weeks?.[weekKey]?.onSite?.push(job)
    } else {
      if (!weeks?.[weekKey]?.vendors?.[job?.vendor_name]) {
        weeks[weekKey].vendors[job?.vendor_name] = []
      }
      weeks?.[weekKey]?.vendors?.[job?.vendor_name]?.push(job)
    }
  })

  return weeks
}

const RoundUpModal = ({
  isOpen,
  onClose,
  jobs,
  type,
  onTypeChange,
  onComplete,
  onReopen,
  isStatusInFlight,
  isLoading = false,
  baseDate,
}) => {
  const [selectedJobs, setSelectedJobs] = useState(new Set())

  // Reset selection state each time the modal opens so stale checkmarks don't carry over
  useEffect(() => {
    if (isOpen) setSelectedJobs(new Set())
  }, [isOpen])

  const groupedJobs = useMemo(() => {
    if (!jobs?.length) return {}

    switch (type) {
      case 'daily':
        return groupJobsByDay(jobs, baseDate)
      case 'weekly':
        return groupJobsByWeek(jobs)
      case 'monthly':
        return groupJobsByMonth(jobs)
      default:
        return groupJobsByDay(jobs, baseDate)
    }
  }, [jobs, type, baseDate])

  const handleSelectJob = (jobId) => {
    const newSelected = new Set(selectedJobs)
    if (newSelected?.has(jobId)) {
      newSelected?.delete(jobId)
    } else {
      newSelected?.add(jobId)
    }
    setSelectedJobs(newSelected)
  }

  const handleExport = (format) => {
    // Implement export functionality
  }

  const renderJobRow = (job) => {
    const statusBadge = getStatusBadge(job?.job_status)
    const promise = job?.next_promised_iso || job?.promised_date || job?.promisedAt || null
    const isCompleted = String(job?.job_status || '').toLowerCase() === 'completed'

    return (
      <div
        key={job?.id}
        className="flex items-center py-3 border-b border-gray-100 last:border-b-0"
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selectedJobs?.has(job?.id)}
          onChange={() => handleSelectJob(job?.id)}
          className="mr-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        {/* Job Info */}
        <div className="flex-1 grid grid-cols-6 gap-4 items-center text-sm">
          {/* Time */}
          <div className="flex items-center text-gray-900">
            <Clock className="h-3 w-3 mr-1 text-gray-400" />
            {job?.scheduled_start_time
              ? `${formatTime(job?.scheduled_start_time)}–${formatTime(job?.scheduled_end_time)}`
              : 'Unscheduled'}
          </div>

          {/* Stock & Product */}
          <div className="flex items-center text-gray-900">
            <Car className="h-3 w-3 mr-1 text-gray-400" />
            {job?.job_number?.split('-')?.pop()} — {job?.title}
          </div>

          {/* Promise Date */}
          <div className="flex items-center text-gray-600">
            <Calendar className="h-3 w-3 mr-1 text-gray-400" />
            {formatEtDateLabel(promise, { weekday: undefined }) || '—'}
          </div>

          {/* Location */}
          {(() => {
            const locType = getJobLocationType(job)
            if (locType === 'Mixed') {
              return (
                <div
                  className="flex items-center gap-1 text-gray-600"
                  aria-label="Location: Mixed"
                >
                  <GitBranch className="h-3 w-3 text-blue-500 shrink-0" />
                  <span
                    className="bg-blue-100 text-blue-700 font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                    title="Job has both in-house and off-site parts"
                  >
                    Split Work
                  </span>
                </div>
              )
            }
            if (locType === 'Off-Site') {
              return (
                <div
                  className="flex items-center text-gray-600"
                  aria-label={`Location: Off-Site${job?.vendor_name ? ` — ${job.vendor_name}` : ''}`}
                >
                  <Building2 className="h-3 w-3 mr-1 text-orange-500" />
                  {job?.vendor_name || 'Off-Site'}
                </div>
              )
            }
            // In-House or null fallback
            return (
              <div
                className="flex items-center text-gray-600"
                aria-label={`Location: ${locType ?? 'In-House'}`}
              >
                <MapPin className="h-3 w-3 mr-1 text-green-500" />
                {locType === 'In-House' ? 'In-House' : '—'}
              </div>
            )
          })()}

          {/* Status */}
          <div
            className={`
            inline-flex px-2 py-1 rounded-full text-xs font-medium
            ${statusBadge?.bg || 'bg-gray-100'} 
            ${statusBadge?.textColor || 'text-gray-800'}
          `}
          >
            {statusBadge?.label || job?.job_status?.toUpperCase()}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => (isCompleted ? onReopen?.(job) : onComplete?.(job))}
              className={
                isCompleted
                  ? 'p-1 hover:bg-gray-100 rounded text-gray-700'
                  : 'p-1 hover:bg-blue-100 rounded text-blue-600'
              }
              disabled={isStatusInFlight?.(job?.id) || false}
              aria-disabled={isStatusInFlight?.(job?.id) || false}
              aria-label={isCompleted ? 'Reopen deal' : 'Mark as complete'}
              title={isCompleted ? 'Reopen deal' : 'Mark as complete'}
            >
              {isCompleted ? (
                <RefreshCw className="h-3 w-3" />
              ) : (
                <CheckCircle className="h-3 w-3" />
              )}
            </button>
            <button
              disabled
              className="p-1 rounded text-gray-300 cursor-not-allowed"
              title="No-Show — coming soon"
            >
              <XCircle className="h-3 w-3" />
            </button>
            <button
              disabled
              className="p-1 rounded text-orange-200 cursor-not-allowed"
              title="Reschedule — coming soon"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderJobGroup = (groupName, groupData) => {
    return (
      <div key={groupName} className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-gray-600" />
          {groupName}
        </h3>

        {/* In-House Jobs */}
        {groupData?.onSite?.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <h4 className="font-medium text-green-900">In-House Jobs</h4>
              <span className="ml-2 text-sm text-gray-600">({groupData?.onSite?.length} jobs)</span>
            </div>
            <div className="bg-green-50 rounded-lg p-4">{groupData?.onSite?.map(renderJobRow)}</div>
          </div>
        )}

        {/* Vendor Jobs */}
        {Object.entries(groupData?.vendors || {})?.map(([vendorName, vendorJobs]) => (
          <div key={vendorName} className="mb-6">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
              <h4 className="font-medium text-orange-900">{vendorName}</h4>
              <span className="ml-2 text-sm text-gray-600">({vendorJobs?.length} jobs)</span>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">{vendorJobs?.map(renderJobRow)}</div>
          </div>
        ))}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="absolute right-0 top-0 h-full w-full max-w-6xl bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Download className="h-5 w-5 text-gray-600 mr-3" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {type === 'weekly' ? 'Weekly' : type === 'monthly' ? 'Monthly' : 'Daily'} Round-Up
                  </h2>
                  <p className="text-sm text-gray-600">
                    {type === 'weekly'
                      ? "Review and export this week's scheduled work"
                      : type === 'monthly'
                        ? "Review and export this month's scheduled work"
                        : "Review and export today's scheduled work"}
                  </p>
                </div>
              </div>

              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full">
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-4">
              {/* Type Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => onTypeChange?.('daily')}
                  className={`px-3 py-1 rounded text-sm ${type === 'daily' ? 'bg-white shadow-sm' : ''}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => onTypeChange?.('weekly')}
                  className={`px-3 py-1 rounded text-sm ${type === 'weekly' ? 'bg-white shadow-sm' : ''}`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => onTypeChange?.('monthly')}
                  className={`px-3 py-1 rounded text-sm ${type === 'monthly' ? 'bg-white shadow-sm' : ''}`}
                >
                  Monthly
                </button>
              </div>

              {/* Export Actions — disabled until export is implemented (Wave XVIII) */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">{selectedJobs?.size} selected</span>
                <button
                  type="button"
                  disabled
                  title="Export — coming soon"
                  className="flex items-center px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </button>
                <button
                  type="button"
                  disabled
                  title="Export — coming soon"
                  className="flex items-center px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  CSV
                </button>
                <button
                  type="button"
                  disabled
                  title="Export — coming soon"
                  className="flex items-center px-3 py-2 text-sm border border-gray-200 rounded-lg text-gray-400 cursor-not-allowed"
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 text-gray-400 animate-spin" />
                <div className="text-lg">Loading jobs…</div>
              </div>
            ) : Object.keys(groupedJobs)?.length > 0 ? (
              Object.entries(groupedJobs)?.map(([groupName, groupData]) =>
                renderJobGroup(groupName, groupData)
              )
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <div className="text-lg">
                  {`No jobs scheduled for this ${type === 'daily' ? 'day' : type === 'weekly' ? 'week' : 'month'}.`}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default RoundUpModal
