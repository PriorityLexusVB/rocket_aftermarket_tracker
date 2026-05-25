import React, { useState, useMemo, useEffect, useCallback } from 'react'
import X from 'lucide-react/dist/esm/icons/x.js'
import Download from 'lucide-react/dist/esm/icons/download.js'
import Copy from 'lucide-react/dist/esm/icons/copy.js'
import ChevronDown from 'lucide-react/dist/esm/icons/chevron-down.js'
import ChevronUp from 'lucide-react/dist/esm/icons/chevron-up.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import Car from 'lucide-react/dist/esm/icons/car.js'
import Building2 from 'lucide-react/dist/esm/icons/building-2.js'
import MapPin from 'lucide-react/dist/esm/icons/map-pin.js'
// Wave XXX-M: GitBranch (a code-versioning icon) was wrong semantic for
// "this job goes to multiple locations." Route conveys "path with stops."
import Route from 'lucide-react/dist/esm/icons/route.js'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js'
import RefreshCw from 'lucide-react/dist/esm/icons/refresh-cw.js'
import { formatTime, getStatusBadge } from '../../../lib/time'
import { getPromiseIso } from '@/services/scheduleItemsService'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'
import { isJobOnSite, getJobLocationType } from '@/utils/locationType'
import { useToast } from '@/components/ui/ToastProvider'
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns'

// Expand a job into the set of vendor slices (id + display name) it has line
// items at. A multi-vendor job appears under EVERY vendor lane it has tagged
// parts at, so per-vendor copy/export only includes that vendor's slice.
//
// Returns: Array<{ vendorId: string | null, vendorName: string }>
//   - vendorId: the UUID to pass to jobToBdcRowForVendor (`null` is reserved
//     for the In-House slice and is NOT used here — In-House jobs come down
//     a separate branch in the caller).
const getVendorSlicesForJobWithName = (job) => {
  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  if (parts.length === 0) {
    // No tagged parts — fall back to the job-level vendor (legacy single-vendor job).
    if (!job?.vendor_id) return []
    return [{ vendorId: job.vendor_id, vendorName: job?.vendor_name || 'Vendor' }]
  }
  const seen = new Map() // vendor_id -> display name
  for (const part of parts) {
    if (part?.is_off_site === false) continue // in-house line, skip vendor lanes
    const partVendorId = part?.vendor_id ?? null
    if (partVendorId) {
      const name =
        part?.vendor?.name ||
        part?.vendors?.name ||
        (partVendorId === job?.vendor_id ? job?.vendor_name : null) ||
        'Vendor'
      if (!seen.has(partVendorId)) seen.set(partVendorId, name)
    } else if (job?.vendor_id) {
      // Legacy line with no per-line vendor tag — inherits job vendor.
      if (!seen.has(job.vendor_id)) {
        seen.set(job.vendor_id, job?.vendor_name || 'Vendor')
      }
    }
  }
  return Array.from(seen, ([vendorId, vendorName]) => ({ vendorId, vendorName }))
}

// groupByVendor produces { [vendorName]: { vendorId, jobs[] } } so the
// caller can slice each multi-vendor job to that vendor's line items at copy
// time. A job appears under EVERY vendor lane it has tagged line items at.
const groupByVendor = (jobList) => {
  return jobList?.reduce((acc, job) => {
    const slices = getVendorSlicesForJobWithName(job)
    if (slices.length === 0) {
      // Defensive — shouldn't happen because caller filters !isJobOnSite first.
      const fallback = job?.vendor_name || (job?.vendor_id ? 'Vendor' : 'In-House')
      if (!acc[fallback]) acc[fallback] = { vendorId: job?.vendor_id ?? null, jobs: [] }
      acc[fallback].jobs.push(job)
      return acc
    }
    for (const { vendorId, vendorName } of slices) {
      if (!acc[vendorName]) acc[vendorName] = { vendorId, jobs: [] }
      acc[vendorName].jobs.push(job)
    }
    return acc
  }, {})
}

// Wave XXX-K: include promised-only jobs (no scheduled_start_time) when grouping.
// Falls back to promised_date so Rob's "Thursday rust-proofing" case lands in
// the right day. Uses the canonical getPromiseIso helper (handles multi-line-item
// earliest-promised + date-only normalization).
const getJobDayDate = (job) => {
  const iso = job?.scheduled_start_time || getPromiseIso(job)
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

const groupJobsByDay = (jobList, baseDate = new Date()) => {
  const target = baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? new Date(baseDate) : new Date()
  target.setHours(0, 0, 0, 0)

  const targetJobs = jobList?.filter((job) => {
    const jobDate = getJobDayDate(job)
    return jobDate && jobDate?.toDateString() === target?.toDateString()
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
      const jobDate = getJobDayDate(job)
      return jobDate && jobDate?.getDay() === targetDayOfWeek
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

const ROUND_UP_LABEL = {
  daily: { title: 'Daily', subtitle: "Review and export today's scheduled work", noun: 'day' },
  weekly: { title: 'Weekly', subtitle: "Review and export this week's scheduled work", noun: 'week' },
  monthly: { title: 'Monthly', subtitle: "Review and export this month's scheduled work", noun: 'month' },
}

const groupJobsByMonth = (jobList) => {
  const weeks = {}
  jobList?.forEach((job) => {
    const jobDate = getJobDayDate(job)
    if (!jobDate) return
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
      // Expand multi-vendor jobs across every vendor lane they have line items at.
      const slices = getVendorSlicesForJobWithName(job)
      const targets =
        slices.length > 0
          ? slices
          : [{ vendorId: job?.vendor_id ?? null, vendorName: job?.vendor_name || 'Vendor' }]
      for (const { vendorId, vendorName } of targets) {
        if (!weeks[weekKey].vendors[vendorName]) {
          weeks[weekKey].vendors[vendorName] = { vendorId, jobs: [] }
        }
        weeks[weekKey].vendors[vendorName].jobs.push(job)
      }
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
  const [exportBusy, setExportBusy] = useState(null) // 'copy' | 'csv' | null
  const [mounted, setMounted] = useState(false)
  // Vendor section collapse state — key is `${groupName}::${vendorName}`, default expanded
  const [collapsedVendors, setCollapsedVendors] = useState(new Set())
  const toast = useToast()

  const toggleVendorCollapse = useCallback((key) => {
    setCollapsedVendors((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }, [])

  // Copy a vendor's slice as BDC TSV rows (paste directly into the BDC workbook).
  // For multi-vendor deals, ONLY this vendor's line items are aggregated into
  // the row — totals/booleans reflect that vendor's slice, not the whole job.
  const copyVendorJobs = useCallback(
    async (vendorName, vendorId, vendorJobs) => {
      if (!navigator?.clipboard?.writeText) {
        toast?.error?.("Couldn't access clipboard.")
        return
      }
      try {
        // Lazy-import keeps roundUpExport off the calendar route's eager bundle
        // until the user actually copies a vendor slice.
        const mod = await import('@/utils/roundUpExport')
        const sliceRows = vendorJobs.map((job) => mod.jobToBdcRowForVendor(job, vendorId))
        await navigator.clipboard.writeText(mod.rowsToTsv(sliceRows))
        toast?.info?.(
          `Copied ${vendorName} — ${vendorJobs.length} deal${vendorJobs.length === 1 ? '' : 's'} (paste into Excel).`,
        )
      } catch (err) {
        console.error('[RoundUpModal] copyVendorJobs failed', err)
        toast?.error?.("Couldn't copy vendor slice. Try the top-level Copy/CSV instead.")
      }
    },
    [toast],
  )

  useEffect(() => {
    if (!isOpen) { setMounted(false); return }
    const id = requestAnimationFrame(() => setMounted(true))
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  // Reset selection state when the modal transitions to open so stale checkmarks
  // don't carry over from a prior open. Guard prevents a no-op re-render on first mount.
  useEffect(() => {
    if (isOpen) {
      setSelectedJobs((prev) => (prev.size === 0 ? prev : new Set()))
    }
  }, [isOpen])

  // ESC key closes the modal — the overlay covers the calendar header, hiding the
  // Round-Up toggle that opened it, so users need a non-X exit path.
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isOpen, onClose])

  // baseDate is a Date object — its reference can churn across parent re-renders
  // even when the value hasn't changed. Memoize on the timestamp value.
  const baseDateMs = baseDate?.getTime?.() ?? null

  const groupedJobs = useMemo(() => {
    if (!jobs?.length) return {}
    if (type === 'weekly') return groupJobsByWeek(jobs)
    if (type === 'monthly') return groupJobsByMonth(jobs)
    return groupJobsByDay(jobs, baseDate)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, type, baseDateMs])

  // Mirrors CalendarShell's date-fns range so export and modal display agree on
  // boundaries. Memoized on baseDate's timestamp (Date refs churn across parent
  // re-renders even when the value is identical).
  const exportRange = useMemo(() => {
    const target = baseDate instanceof Date && !Number.isNaN(baseDate.getTime()) ? baseDate : new Date()
    if (type === 'weekly') return { start: startOfWeek(target, { weekStartsOn: 1 }), end: endOfWeek(target, { weekStartsOn: 1 }) }
    if (type === 'monthly') return { start: startOfMonth(target), end: endOfMonth(target) }
    return { start: startOfDay(target), end: endOfDay(target) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, baseDate?.getTime?.()])

  const handleExport = async (format) => {
    if (exportBusy) return
    setExportBusy(format)
    try {
      // Lazy-import keeps ~213 LOC + supabase reference off the calendar route's
      // eager bundle when the user never opens Round-Up export.
      const mod = await import('@/utils/roundUpExport')
      // Wave XXX-R: use the modal's displayed `jobs` prop (which already
      // includes promise-only-today merged + any parent-filter scoping)
      // rather than re-fetching from the DB. Prior code silently exported
      // more rows than the user could see (calendar-flow-specialist NEW 4).
      const rows = mod.buildBdcRowsFromJobs(jobs)
      if (!rows.length) {
        toast?.info?.('No deals to export for this period.')
        return
      }
      if (format === 'copy') {
        if (!navigator?.clipboard?.writeText) {
          toast?.error?.("Couldn't access clipboard. Use CSV instead.")
          return
        }
        await navigator.clipboard.writeText(mod.rowsToTsv(rows))
        toast?.success?.(`Copied ${rows.length} deal${rows.length === 1 ? '' : 's'} (paste into Excel).`)
        return
      }
      if (format === 'csv') {
        mod.downloadAsFile(mod.rowsToCsv(rows), mod.suggestedFilename(type, baseDate))
        toast?.success?.(`Exported ${rows.length} deal${rows.length === 1 ? '' : 's'} to CSV.`)
        return
      }
    } catch (err) {
      console.error('[RoundUpModal] export failed', err)
      // Wave XXX-T: specifically detect the stale-chunk case (post-deploy
      // the lazy-imported roundUpExport chunk hash no longer exists on the
      // CDN). Tell the user what's actually wrong + offer an explicit
      // reload. browser-tester saw the previous generic "Try refreshing"
      // toast not register clearly enough.
      const msg = String(err?.message || '')
      const isChunkLoadError =
        /Failed to fetch dynamically imported module/i.test(msg) ||
        /Loading chunk \d+ failed/i.test(msg) ||
        err?.name === 'ChunkLoadError'

      if (isChunkLoadError) {
        toast?.error?.(
          'The app has updated since you opened this page. Refresh to enable export.'
        )
        // Auto-recover on the next user click — they came back to the page
        // intending to export, so reload is the right move. Small delay so
        // they see the toast first.
        setTimeout(() => {
          if (typeof window !== 'undefined') window.location.reload()
        }, 1500)
      } else {
        toast?.error?.("Couldn't export Round-Up. Try refreshing the page.")
      }
    } finally {
      setExportBusy(null)
    }
  }

  const handleSelectJob = (jobId) => {
    const newSelected = new Set(selectedJobs)
    if (newSelected?.has(jobId)) {
      newSelected?.delete(jobId)
    } else {
      newSelected?.add(jobId)
    }
    setSelectedJobs(newSelected)
  }

  const renderJobRow = (job) => {
    const statusBadge = getStatusBadge(job?.job_status)
    const promise = getPromiseIso(job)
    const isCompleted = String(job?.job_status || '').toLowerCase() === 'completed'

    return (
      <div
        key={job?.id}
        className="flex items-center py-3 border-b border-border last:border-b-0"
      >
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selectedJobs?.has(job?.id)}
          onChange={() => handleSelectJob(job?.id)}
          className="mr-3 rounded border-input text-indigo-600 focus:ring-indigo-500"
        />
        {/* Job Info */}
        <div className="flex-1 grid grid-cols-6 gap-4 items-center text-sm">
          {/* Time */}
          <div className="flex items-center text-foreground">
            <Clock className="h-3 w-3 mr-1 text-muted-foreground" />
            {job?.scheduled_start_time
              ? `${formatTime(job?.scheduled_start_time)}–${formatTime(job?.scheduled_end_time)}`
              : 'Unscheduled'}
          </div>

          {/* Stock & Product (line 1) + customer · stock# (line 2) */}
          <div className="min-w-0">
            <div className="flex items-center text-foreground truncate">
              <Car className="h-3 w-3 mr-1 text-muted-foreground shrink-0" />
              {job?.job_number?.split('-')?.pop()} — {job?.title}
            </div>
            <div className="text-[10px] text-muted-foreground truncate">
              {job?.customer_name || job?.vehicle?.owner_name || '—'}
              {job?.vehicle?.stock_number ? ` · #${job.vehicle.stock_number}` : ''}
            </div>
          </div>

          {/* Promise Date */}
          <div className="flex items-center text-muted-foreground">
            <Calendar className="h-3 w-3 mr-1 text-muted-foreground" />
            {formatEtDateLabel(promise, { weekday: undefined }) || '—'}
          </div>

          {/* Location */}
          {(() => {
            const locType = getJobLocationType(job)
            if (locType === 'Mixed') {
              return (
                <div
                  className="flex items-center gap-1 text-muted-foreground"
                  aria-label="Location: Mixed"
                >
                  <Route className="h-3 w-3 text-blue-500 shrink-0" />
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
                  className="flex items-center text-muted-foreground"
                  aria-label={`Location: Off-Site${job?.vendor_name ? ` — ${job.vendor_name}` : ''}`}
                >
                  <Building2 className="h-3 w-3 mr-1 text-amber-600" />
                  {job?.vendor_name || 'Off-Site'}
                </div>
              )
            }
            // In-House or null fallback
            return (
              <div
                className="flex items-center text-muted-foreground"
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
            ${statusBadge?.bg || 'bg-muted'}
            ${statusBadge?.textColor || 'text-foreground'}
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
                  ? 'p-1 hover:bg-muted rounded text-foreground'
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
            {/* No-Show + Reschedule actions hidden until implemented; visible-but-disabled
                buttons trained users that the action area was broken. */}
          </div>
        </div>
      </div>
    )
  }

  const renderJobGroup = (groupName, groupData) => {
    return (
      <div key={groupName} className="mb-8">
        <h3 className="text-lg font-medium text-foreground mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-muted-foreground" />
          {groupName}
        </h3>

        {/* In-House Jobs */}
        {groupData?.onSite?.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <h4 className="font-medium text-green-900 dark:text-green-300">In-House Jobs</h4>
              <span className="ml-2 text-sm text-muted-foreground">({groupData?.onSite?.length} jobs)</span>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-4">{groupData?.onSite?.map(renderJobRow)}</div>
          </div>
        )}

        {/* Vendor Jobs — collapse + per-vendor copy */}
        {Object.entries(groupData?.vendors || {})?.map(([vendorName, entry]) => {
          // entry shape: { vendorId, jobs[] }
          const vendorJobs = entry?.jobs || []
          const vendorId = entry?.vendorId ?? null
          const collapseKey = `${groupName}::${vendorName}`
          const isCollapsed = collapsedVendors.has(collapseKey)
          return (
            <div key={vendorName} className="mb-6">
              <div className="flex items-center mb-3 group">
                <div className="w-3 h-3 bg-amber-500 rounded-full mr-2 flex-shrink-0"></div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-left flex-1 min-w-0"
                  onClick={() => toggleVendorCollapse(collapseKey)}
                  aria-expanded={!isCollapsed}
                  aria-label={`${isCollapsed ? 'Expand' : 'Collapse'} ${vendorName}`}
                >
                  <h4 className="font-medium text-amber-900 dark:text-amber-300">{vendorName}</h4>
                  <span className="text-sm text-muted-foreground">({vendorJobs?.length} jobs)</span>
                  {isCollapsed ? (
                    <ChevronDown className="h-3.5 w-3.5 text-muted-foreground ml-1 flex-shrink-0" />
                  ) : (
                    <ChevronUp className="h-3.5 w-3.5 text-muted-foreground ml-1 flex-shrink-0" />
                  )}
                </button>
                {/* Per-vendor clipboard copy — emits BDC TSV rows for this vendor's slice only. */}
                <button
                  type="button"
                  title={`Copy ${vendorName} slice as BDC rows`}
                  className="ml-2 p-1 rounded hover:bg-amber-100 text-amber-700 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex-shrink-0"
                  onClick={() => copyVendorJobs(vendorName, vendorId, vendorJobs)}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
              </div>
              {!isCollapsed && (
                <div className="bg-amber-50 dark:bg-amber-950/30 rounded-lg p-4">
                  {vendorJobs?.map(renderJobRow)}
                </div>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true" aria-labelledby="roundup-modal-title">
      <div
        className={`absolute inset-0 bg-black/50 transition-opacity duration-150 ${mounted ? 'opacity-100' : 'opacity-0'}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose?.()
        }}
      ></div>
      <div className={`absolute right-0 top-0 h-full w-full max-w-6xl bg-card text-card-foreground shadow-xl transition-transform duration-150 ease-out ${mounted ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-border bg-card">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Download className="h-5 w-5 text-muted-foreground mr-3" />
                <div>
                  <h2 id="roundup-modal-title" className="text-xl font-semibold text-foreground">
                    {ROUND_UP_LABEL[type].title} Round-Up
                  </h2>
                  <p className="text-sm text-muted-foreground">{ROUND_UP_LABEL[type].subtitle}</p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-muted rounded-full"
                aria-label="Close round-up"
              >
                <X className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-4">
              {/* Type Toggle */}
              <div className="flex items-center bg-muted rounded-lg p-1">
                <button
                  onClick={() => onTypeChange?.('daily')}
                  className={`px-3 py-1 rounded text-sm ${type === 'daily' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => onTypeChange?.('weekly')}
                  className={`px-3 py-1 rounded text-sm ${type === 'weekly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => onTypeChange?.('monthly')}
                  className={`px-3 py-1 rounded text-sm ${type === 'monthly' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground'}`}
                >
                  Monthly
                </button>
              </div>

              {/* Export Actions — Copy/CSV live (BDC tracking format), PDF deferred */}
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => handleExport('copy')}
                  disabled={exportBusy !== null || isLoading}
                  title="Copy as TSV (paste directly into Excel)"
                  className="flex items-center px-3 py-2 text-sm border border-input bg-background text-foreground rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportBusy === 'copy' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <Copy className="h-4 w-4 mr-2" />
                  )}
                  {exportBusy === 'copy' ? 'Copying…' : 'Copy'}
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('csv')}
                  disabled={exportBusy !== null || isLoading}
                  title="Download as CSV (BDC tracking format)"
                  className="flex items-center px-3 py-2 text-sm border border-input bg-background text-foreground rounded-lg hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {exportBusy === 'csv' ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
                  ) : (
                    <FileText className="h-4 w-4 mr-2" />
                  )}
                  {exportBusy === 'csv' ? 'Exporting…' : 'CSV'}
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {isLoading ? (
              <div className="text-center py-12 text-muted-foreground">
                <RefreshCw className="h-8 w-8 mx-auto mb-3 text-muted-foreground animate-spin" />
                <div className="text-lg">Loading jobs…</div>
              </div>
            ) : Object.keys(groupedJobs)?.length > 0 ? (
              Object.entries(groupedJobs)?.map(([groupName, groupData]) =>
                renderJobGroup(groupName, groupData)
              )
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <Calendar className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
                <div className="text-lg">
                  {`No jobs scheduled for this ${ROUND_UP_LABEL[type].noun}.`}
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
