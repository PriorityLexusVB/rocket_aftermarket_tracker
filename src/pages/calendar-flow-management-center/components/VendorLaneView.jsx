import React, { useState } from 'react'
import Building2 from 'lucide-react/dist/esm/icons/building-2.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import Car from 'lucide-react/dist/esm/icons/car.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js'
import { formatTime, getStatusBadge } from '../../../lib/time'
import { getPromiseIso, isOverdueJob } from '@/services/scheduleItemsService'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'
import { isJobOnSite, getJobLocationType } from '@/utils/locationType'
import { getWorkTagLabel, MAX_WORK_TAGS_VISIBLE } from '@/utils/workTags'

// Count distinct vendors a job has line items at OTHER than `vendorId`.
// Used by the lane chip to surface "+N at other vendors" so a multi-vendor
// deal isn't silently hidden inside one lane.
const countOtherVendorSlices = (job, vendorId) => {
  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  if (parts.length === 0) return 0
  const others = new Set()
  for (const part of parts) {
    if (part?.is_off_site === false) continue
    const pv = part?.vendor_id ?? null
    if (pv && pv !== vendorId) others.add(pv)
    else if (pv == null && job?.vendor_id && job.vendor_id !== vendorId) {
      others.add(job.vendor_id)
    }
  }
  return others.size
}


// Default daily slot count per vendor lane. Pulled from BDC's standard
// scheduling load (7 booked deals/day per off-site bay). Tune per-vendor
// once we surface a vendor.daily_capacity column.
const DEFAULT_VENDOR_CAPACITY = 7

const VendorLaneView = ({ vendors, jobs, onJobClick, onDrop, draggedJob }) => {
  // `currentVendorId` is passed by vendor-lane renders so the chip can show
  // a "+N elsewhere" badge for multi-vendor jobs. Omit for the on-site lane.
  const renderEventChip = (job, currentVendorId = null) => {
    // Tri-state: In-House (green) / Off-Site (amber) / Mixed (blue, "Split Work").
    // Matches the legend in CalendarShell, the location badge in RoundUpModal, and
    // the dot in UnscheduledQueue.jsx.
    const locType = getJobLocationType(job) // 'In-House' | 'Off-Site' | 'Mixed' | null
    const isMixed = locType === 'Mixed'
    // isJobOnSite is the canonical location-display check (mirrors JobDrawer F5 fix, Wave XXV)
    const isOnSite = locType === 'Mixed' ? false : isJobOnSite(job)
    const chipBg = isMixed ? 'bg-blue-50' : isOnSite ? 'bg-green-50' : 'bg-amber-50'
    const chipBorder = isMixed ? 'border-blue-200' : isOnSite ? 'border-green-200' : 'border-amber-200'
    const chipHoverBorder = isMixed ? 'hover:border-blue-300' : isOnSite ? 'hover:border-green-300' : 'hover:border-amber-300'

    const promise = getPromiseIso(job)
    const overdue = isOverdueJob(job)

    const rawStatus = String(job?.job_status || '').toLowerCase()
    const hasTimeWindow = !!job?.scheduled_start_time
    const isPromiseOnly =
      job?.time_tbd === true ||
      job?.schedule_state === 'scheduled_no_time' ||
      (!hasTimeWindow && promise)
    const statusForBadge =
      !hasTimeWindow &&
      promise &&
      (rawStatus === 'pending' || rawStatus === 'new' || rawStatus === '')
        ? 'scheduled'
        : rawStatus
    const statusBadge = getStatusBadge(statusForBadge)
    const statusColor = statusBadge?.color || 'bg-blue-500'

    const jobNumber = job?.job_number?.split?.('-')?.pop?.() || ''
    const vehicleLabel = job?.vehicle_info || ''
    const customerLabel = job?.customer_name || job?.customerName || ''

    const hasLoaner = !!(job?.has_active_loaner || job?.loaner_id || job?.customer_needs_loaner)

    return (
      <div
        key={job?.id}
        className={`
          relative rounded-lg border p-3 cursor-pointer transition-all duration-200 hover:shadow-md
          ${chipBg} ${chipBorder} ${chipHoverBorder} text-sm text-gray-900 w-full
        `}
        onClick={() => onJobClick?.(job)}
      >
        {/* Status stripe — pulses on overdue active jobs to surface urgency */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor} rounded-l-lg${
            overdue && ['pending', 'new', 'scheduled'].includes(rawStatus)
              ? ' animate-pulse'
              : ''
          }`}
        />

        {/* Main content */}
        <div className="ml-2 min-w-0">
          {/* Top line */}
          <div className="flex items-center justify-between mb-1">
            <div className="font-semibold truncate flex items-center flex-1 min-w-0">
              <Car className="h-3 w-3 mr-1 flex-shrink-0" />
              <span className="truncate">
                {jobNumber ? `${jobNumber} • ` : ''}
                {job?.title}
              </span>
              {hasLoaner && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 whitespace-nowrap">
                  Loaner
                </span>
              )}
            </div>
            {overdue && (
              <div className="flex items-center text-red-600 ml-2">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-xs ml-1">Overdue</span>
              </div>
            )}
          </div>

          {/* Second line (time + promise + status) */}
          <div className="text-xs text-gray-600 flex items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {hasTimeWindow
                  ? `${formatTime(job?.scheduled_start_time)}–${formatTime(job?.scheduled_end_time)}`
                  : 'All day'}
              </div>
              <div className="flex items-center">
                <Calendar className="h-3 w-3 mr-1" />
                Promise: {formatEtDateLabel(promise) || '—'}
              </div>
            </div>

            <div
              className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge?.bg || 'bg-gray-100'} ${statusBadge?.textColor || 'text-gray-800'}`}
            >
              {isPromiseOnly
                ? 'PROMISE'
                : statusBadge?.label ||
                  statusForBadge?.toUpperCase?.() ||
                  job?.job_status?.toUpperCase?.()}
            </div>
          </div>

          {/* Third line (customer + vehicle) */}
          {customerLabel || vehicleLabel ? (
            <div className="mt-1 text-xs text-gray-600 truncate">
              {customerLabel ? `${customerLabel}${vehicleLabel ? ' • ' : ''}` : ''}
              {vehicleLabel}
            </div>
          ) : null}

          {/* Work tags (EXTERIOR/INTERIOR/WINDSHIELD/RG/EVERNEW/FILM) — at-a-glance product flags */}
          {Array.isArray(job?.work_tags) && job.work_tags.length ? (
            <div className="mt-1 flex flex-wrap gap-1">
              {job.work_tags.slice(0, MAX_WORK_TAGS_VISIBLE).map((tag) => (
                <span
                  key={tag}
                  title={getWorkTagLabel(tag)}
                  className="rounded bg-white/70 px-1.5 py-0.5 text-[10px] font-medium text-gray-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          ) : null}

          {/* Vendor line for off-site / mixed */}
          {!isOnSite && (
            <div className="text-xs opacity-90 mt-1 flex items-center gap-1.5">
              <Building2 className="h-3 w-3 mr-1" />
              {job?.vendor_name || (isMixed ? 'Split Work' : '')}
              {currentVendorId ? (() => {
                const otherCount = countOtherVendorSlices(job, currentVendorId)
                return otherCount > 0 ? (
                  <span
                    className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-800 whitespace-nowrap"
                    title={`This deal also has line items at ${otherCount} other vendor${otherCount === 1 ? '' : 's'}`}
                  >
                    +{otherCount} elsewhere
                  </span>
                ) : null
              })() : null}
            </div>
          )}
        </div>
      </div>
    )
  }

  const getVendorCapacity = (vendorId) => {
    const vendorJobs = jobs?.filter((job) => job?.vendor_id === vendorId)
    return {
      scheduled: vendorJobs?.length || 0,
      remaining: Math.max(0, DEFAULT_VENDOR_CAPACITY - (vendorJobs?.length || 0)),
    }
  }

  // Per-lane drag-active counters. Counter pattern avoids dragLeave misfires
  // when the pointer crosses child elements inside the drop zone.
  const [onSiteDragCount, setOnSiteDragCount] = useState(0)
  // Vendor drag counts keyed by vendor id
  const [vendorDragCounts, setVendorDragCounts] = useState({})

  const onSiteDragging = onSiteDragCount > 0
  const isVendorDragging = (vendorId) => (vendorDragCounts[vendorId] || 0) > 0

  const handleVendorDragEnter = (vendorId) =>
    setVendorDragCounts((prev) => ({ ...prev, [vendorId]: (prev[vendorId] || 0) + 1 }))
  const handleVendorDragLeave = (vendorId) =>
    setVendorDragCounts((prev) => ({ ...prev, [vendorId]: Math.max(0, (prev[vendorId] || 0) - 1) }))
  const handleVendorDrop = (vendorId, location) => {
    setVendorDragCounts((prev) => ({ ...prev, [vendorId]: 0 }))
    onDrop?.(vendorId, location)
  }

  return (
    <div className="space-y-6 p-6">
      {/* On-Site Lane */}
      <div
        className={`bg-green-50 rounded-lg border transition-all duration-150 ${
          onSiteDragging
            ? 'border-indigo-300 ring-2 ring-indigo-300 ring-offset-2 bg-indigo-50/30'
            : 'border-green-200'
        }`}
        onDragEnter={() => setOnSiteDragCount((c) => c + 1)}
        onDragLeave={() => setOnSiteDragCount((c) => Math.max(0, c - 1))}
      >
        <div className="p-4 border-b border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
              <div>
                <h3 className="font-medium text-green-900">In-House Jobs</h3>
                <div className="text-sm text-green-700 flex items-center mt-1">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2"></div>
                  Green = In-House
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
          className="p-4 min-h-[120px] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
          onDragOver={(e) => e?.preventDefault()}
          onDrop={() => { setOnSiteDragCount(0); onDrop?.(null, 'on_site') }}
        >
          {(() => {
            const onSiteJobs = jobs?.filter((job) => !job?.vendor_id || job?.location === 'on_site') || []
            return (
              <>
                {onSiteJobs.map(renderEventChip)}
                {!draggedJob && onSiteJobs.length === 0 && (
                  <div className="col-span-full border-2 border-dashed border-green-200 rounded-lg p-4 text-center text-green-700">
                    <Car className="h-6 w-6 mx-auto mb-2 opacity-60" />
                    <div className="text-sm">No In-House jobs scheduled</div>
                    <div className="text-[11px] text-green-600/80 mt-0.5">Drag a job here or use + New Deal</div>
                  </div>
                )}
              </>
            )
          })()}

          {/* Drop zone indicator */}
          {draggedJob && (
            <div className="border-2 border-dashed border-green-300 rounded-lg p-4 flex items-center justify-center text-green-600">
              <div className="text-center">
                <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <div className="text-sm">Drop here for In-House</div>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* Vendor Lanes */}
      {vendors?.map((vendor) => {
        // Fallback approach (Wave XXX-H Item 5): keep job-level lane grouping
        // so each job appears in exactly one lane. Multi-vendor visibility is
        // signaled via the "+N elsewhere" badge inside each chip — see
        // renderEventChip → countOtherVendorSlices. Full per-vendor lane
        // expansion is deferred.
        const vendorJobs = jobs?.filter((job) => job?.vendor_id === vendor?.id)
        const capacity = getVendorCapacity(vendor?.id)

        return (
          <div
            key={vendor?.id}
            className={`bg-orange-50 rounded-lg border transition-all duration-150 ${
              isVendorDragging(vendor?.id)
                ? 'border-indigo-300 ring-2 ring-indigo-300 ring-offset-2 bg-indigo-50/30'
                : 'border-orange-200'
            }`}
            onDragEnter={() => handleVendorDragEnter(vendor?.id)}
            onDragLeave={() => handleVendorDragLeave(vendor?.id)}
          >
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
                    {/* Capacity bar — visual load indicator per vendor lane */}
                    {(() => {
                      const pct = Math.min(100, Math.round((capacity?.scheduled / DEFAULT_VENDOR_CAPACITY) * 100))
                      const barColor =
                        pct < 70 ? 'bg-green-500' : pct < 100 ? 'bg-amber-500' : 'bg-red-500'
                      return (
                        <div
                          className="h-1 mt-2 rounded-full overflow-hidden bg-gray-200 w-32"
                          title="Estimated capacity (default: 7 — update in Admin when per-vendor capacity ships)"
                        >
                          <div
                            className={`h-full transition-all duration-200 ${barColor}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      )
                    })()}
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
              className="p-4 min-h-[120px] grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3"
              onDragOver={(e) => e?.preventDefault()}
              onDrop={() => handleVendorDrop(vendor?.id, 'off_site')}
            >
              {vendorJobs?.map((job) => renderEventChip(job, vendor?.id))}

              {!draggedJob && (vendorJobs?.length || 0) === 0 && (
                <div className="col-span-full border-2 border-dashed border-orange-200 rounded-lg p-4 text-center text-orange-700">
                  <Building2 className="h-6 w-6 mx-auto mb-2 opacity-60" />
                  <div className="text-sm">No jobs assigned to {vendor?.name}</div>
                  <div className="text-[11px] text-orange-600/80 mt-0.5">Drag a job here to send off-site</div>
                </div>
              )}

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
