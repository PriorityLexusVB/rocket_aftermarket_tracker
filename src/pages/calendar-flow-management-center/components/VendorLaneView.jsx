import React from 'react'
import { Building2, Clock, Car, Calendar, AlertTriangle } from 'lucide-react'
import { formatTime, isOverdue, getStatusBadge } from '../../../lib/time'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'

const VendorLaneView = ({ vendors, jobs, onJobClick, onDrop, draggedJob }) => {
  const renderEventChip = (job) => {
    const isOnSite = !job?.vendor_id || job?.location === 'on_site'
    const chipColor = isOnSite ? 'bg-green-500' : 'bg-orange-500'
    const statusColor = getStatusBadge(job?.job_status)?.color || 'bg-blue-500'
    const promise = job?.next_promised_iso || job?.promised_date || job?.promisedAt || null
    const overdue = isOverdue(promise)

    return (
      <div
        key={job?.id}
        className={`
          relative rounded-lg p-3 mb-2 cursor-pointer transition-all duration-200 hover:shadow-lg
          ${chipColor} text-white text-sm min-w-[280px]
        `}
        onClick={() => onJobClick?.(job)}
      >
        {/* Status stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor} rounded-l-lg`} />

        {/* Main content */}
        <div className="ml-2">
          {/* Top line */}
          <div className="flex items-center justify-between mb-1">
            <div className="font-bold truncate flex items-center flex-1">
              <Car className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">
                {job?.job_number?.split('-')?.pop()} • {job?.title}
              </span>
            </div>
            {overdue && (
              <div className="flex items-center text-red-200 ml-2">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-xs ml-1">Overdue</span>
              </div>
            )}
          </div>

          {/* Second line */}
          <div className="text-xs opacity-90 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {formatTime(job?.scheduled_start_time)}–{formatTime(job?.scheduled_end_time)}
              </div>
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                Promise: {formatEtDateLabel(promise) || '—'}
              </div>
            </div>
          </div>

          {/* Vendor line for off-site */}
          {!isOnSite && (
            <div className="text-xs opacity-90 mt-1 flex items-center">
              <Building2 className="h-3 w-3 mr-1" />
              {job?.vendor_name}
            </div>
          )}

          {/* Status badge */}
          <div className="flex justify-end mt-2">
            <div
              className={`
              px-2 py-1 rounded-full text-xs font-medium
              ${getStatusBadge(job?.job_status)?.bg || 'bg-gray-500'} 
              bg-opacity-20 border border-current
            `}
            >
              {getStatusBadge(job?.job_status)?.label || job?.job_status?.toUpperCase()}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const getVendorCapacity = (vendorId) => {
    const vendorJobs = jobs?.filter((job) => job?.vendor_id === vendorId)
    return {
      scheduled: vendorJobs?.length || 0,
      remaining: Math.max(0, 7 - (vendorJobs?.length || 0)), // Default capacity of 7
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* On-Site Lane */}
      <div className="bg-green-50 rounded-lg border border-green-200">
        <div className="p-4 border-b border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
              <div>
                <h3 className="font-medium text-green-900">On-Site (PLV)</h3>
                <div className="text-sm text-green-700 flex items-center mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Green = On-Site
                </div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-green-900">
                {jobs?.filter((job) => !job?.vendor_id || job?.location === 'on_site')?.length} jobs
              </div>
              <div className="text-xs text-green-600">currently scheduled</div>
            </div>
          </div>
        </div>

        <div
          className="p-4 min-h-[120px] grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3"
          onDragOver={(e) => e?.preventDefault()}
          onDrop={() => onDrop?.(null, 'on_site')}
        >
          {jobs
            ?.filter((job) => !job?.vendor_id || job?.location === 'on_site')
            ?.map(renderEventChip)}

          {/* Drop zone indicator */}
          {draggedJob && (
            <div className="border-2 border-dashed border-green-300 rounded-lg p-4 flex items-center justify-center text-green-600">
              <div className="text-center">
                <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">Drop here for On-Site</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Vendor Lanes */}
      {vendors?.map((vendor) => {
        const vendorJobs = jobs?.filter((job) => job?.vendor_id === vendor?.id)
        const capacity = getVendorCapacity(vendor?.id)

        return (
          <div key={vendor?.id} className="bg-orange-50 rounded-lg border border-orange-200">
            <div className="p-4 border-b border-orange-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-500 rounded mr-3"></div>
                  <div>
                    <h3 className="font-medium text-orange-900">{vendor?.name}</h3>
                    <div className="text-sm text-orange-700 flex items-center mt-1">
                      <Building2 className="h-3 w-3 mr-1" />
                      {vendor?.specialty} • Off-Site
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    <div className="text-sm font-medium text-orange-900">
                      {capacity?.scheduled} / {capacity?.scheduled + capacity?.remaining}
                    </div>
                    <div
                      className={`
                      px-2 py-1 rounded-full text-xs font-medium
                      ${
                        capacity?.remaining > 2
                          ? 'bg-green-100 text-green-700'
                          : capacity?.remaining > 0
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-red-100 text-red-700'
                      }
                    `}
                    >
                      {capacity?.remaining > 0 ? `${capacity?.remaining} slots` : 'Full'}
                    </div>
                  </div>
                  <div className="text-xs text-orange-600">scheduled / capacity</div>
                </div>
              </div>
            </div>
            <div
              className="p-4 min-h-[120px] grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3"
              onDragOver={(e) => e?.preventDefault()}
              onDrop={() => onDrop?.(vendor?.id, 'off_site')}
            >
              {vendorJobs?.map(renderEventChip)}

              {/* Drop zone indicator */}
              {draggedJob && (
                <div className="border-2 border-dashed border-orange-300 rounded-lg p-4 flex items-center justify-center text-orange-600">
                  <div className="text-center">
                    <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <div className="text-sm">Drop here for {vendor?.name}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default VendorLaneView
