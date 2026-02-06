import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight, AlertTriangle, RefreshCw, CheckCircle } from 'lucide-react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { calendarService } from '@/services/calendarService'
import { getNeedsSchedulingPromiseItems } from '@/services/scheduleItemsService'
import { jobService } from '@/services/jobService'
import CalendarLegend from '@/components/calendar/CalendarLegend'
import CalendarViewTabs from '@/components/calendar/CalendarViewTabs'
import EventDetailPopover from '@/components/calendar/EventDetailPopover'
import AppLayout from '@/components/layouts/AppLayout'
import { getEventColors } from '@/utils/calendarColors'
import { getReopenTargetStatus } from '@/utils/jobStatusTimeRules'
import { withTimeout } from '@/utils/promiseTimeout'
import { useToast } from '@/components/ui/ToastProvider'
import { isOverdue } from '@/lib/time'
import {
  getCalendarDestination,
  trackCalendarNavigation,
} from '@/lib/navigation/calendarNavigation'
import { isCalendarDealDrawerEnabled, isCalendarUnifiedShellEnabled } from '@/config/featureFlags'

const SIMPLE_AGENDA_ENABLED =
  String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

const LOAD_TIMEOUT_MS = 15000

// Safe date creation utility
const safeCreateDate = (input) => {
  if (!input) return null
  try {
    const date = new Date(input)
    if (isNaN(date?.getTime())) {
      console.warn('Invalid date created from input:', input)
      return null
    }
    return date
  } catch (error) {
    console.warn('Date creation error:', input, error)
    return null
  }
}

// Safe date string validation
const safeDateString = (dateInput) => {
  if (!dateInput) return ''
  try {
    const date = safeCreateDate(dateInput)
    if (!date) return ''
    return date?.toISOString()
  } catch (error) {
    console.warn('Date string conversion error:', dateInput, error)
    return ''
  }
}

// Safe date formatting
const safeFormatDate = (dateInput, options = {}) => {
  if (!dateInput) return ''
  try {
    const date = safeCreateDate(dateInput)
    if (!date) return ''
    return date?.toLocaleDateString('en-US', options)
  } catch (error) {
    console.warn('Date formatting error:', dateInput, error)
    return ''
  }
}

// Safe time formatting
const safeFormatTime = (dateInput, options = {}) => {
  if (!dateInput) return ''
  try {
    const date = safeCreateDate(dateInput)
    if (!date) return ''
    return date?.toLocaleTimeString('en-US', options)
  } catch (error) {
    console.warn('Time formatting error:', dateInput, error)
    return ''
  }
}

const VALID_VIEW_TYPES = new Set(['day', 'week', 'month'])
const SHELL_RANGE_TO_VIEW = {
  day: 'day',
  week: 'week',
  month: 'month',
  next7: 'week',
  next30: 'month',
}

const resolveShellViewType = (range) => {
  const key = String(range || '').toLowerCase()
  return SHELL_RANGE_TO_VIEW?.[key] || 'week'
}

export function getCalendarGridClickHandler({
  dealDrawerEnabled,
  onOpenDealDrawer,
  navigate,
  deal,
}) {
  return () => {
    if (dealDrawerEnabled && typeof onOpenDealDrawer === 'function') {
      onOpenDealDrawer(deal)
      return
    }

    const dealId = deal?.id
    if (dealId && typeof navigate === 'function') {
      navigate(`/deals/${dealId}/edit`)
    }
  }
}

const parseDateParam = (value) => {
  if (!value) return null
  const str = String(value).trim()
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d) return null
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

const formatDateParam = (date) => {
  if (!date || typeof date.getTime !== 'function') return ''
  const t = date.getTime()
  if (Number.isNaN(t)) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const safeDayKey = (value) => {
  const d = safeCreateDate(value)
  return d ? d.toDateString() : ''
}

const CalendarSchedulingCenter = ({ embedded = false, shellState, onOpenDealDrawer } = {}) => {
  // State management
  const { user, orgId } = useAuth()
  const toast = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [, setSearchParams] = useSearchParams()
  const urlParams = useMemo(() => new URLSearchParams(location.search), [location.search])
  const didInitUrlStateRef = useRef(false)
  const unifiedShellEnabled = isCalendarUnifiedShellEnabled()
  const dealDrawerEnabled = isCalendarDealDrawerEnabled()
  const canOpenDrawer = dealDrawerEnabled && typeof onOpenDealDrawer === 'function'
  const isEmbedded = embedded === true
  const suppressChrome = isEmbedded && unifiedShellEnabled
  const showTitleTooltips = isEmbedded && unifiedShellEnabled
  const showDetailPopovers = showTitleTooltips
  const shellDate = shellState?.date
  const shellRange = shellState?.range
  const [currentDate, setCurrentDate] = useState(() => {
    if (isEmbedded && shellDate instanceof Date) return shellDate
    return parseDateParam(urlParams.get('date')) || new Date()
  })
  const [viewType, setViewType] = useState(() => {
    if (isEmbedded) return resolveShellViewType(shellRange)
    const v = String(urlParams.get('view') || '').toLowerCase()
    return VALID_VIEW_TYPES.has(v) ? v : 'week'
  }) // 'day', 'week', 'month'
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [debugInfo, setDebugInfo] = useState('')

  // Keep state in sync with URL (supports refresh + browser back/forward)
  useEffect(() => {
    if (isEmbedded) return
    const nextViewRaw = String(urlParams.get('view') || '').toLowerCase()
    const nextView = VALID_VIEW_TYPES.has(nextViewRaw) ? nextViewRaw : null
    if (nextView && nextView !== viewType) setViewType(nextView)

    const nextDate = parseDateParam(urlParams.get('date'))
    if (nextDate) {
      const currKey = formatDateParam(currentDate)
      const nextKey = formatDateParam(nextDate)
      if (currKey && nextKey && currKey !== nextKey) setCurrentDate(nextDate)
    }
  }, [urlParams, viewType, currentDate])

  // One-time URL normalization so the page is shareable/bookmarkable without
  // creating a state <-> URL feedback loop.
  useEffect(() => {
    if (isEmbedded) return
    if (didInitUrlStateRef.current) return

    const desiredView = VALID_VIEW_TYPES.has(viewType) ? viewType : 'week'
    const desiredDate = formatDateParam(currentDate) || ''

    const currView = String(urlParams.get('view') || '').toLowerCase()
    const currDate = String(urlParams.get('date') || '')

    const next = new URLSearchParams(urlParams)
    let changed = false

    if (currView !== desiredView) {
      next.set('view', desiredView)
      changed = true
    }

    if (currDate !== desiredDate) {
      if (desiredDate) next.set('date', desiredDate)
      else next.delete('date')
      changed = true
    }

    didInitUrlStateRef.current = true
    if (changed) setSearchParams(next, { replace: true })
  }, [viewType, currentDate, urlParams, setSearchParams])

  const setUrlState = useCallback(
    ({ nextViewType, nextDate }) => {
      if (isEmbedded) return
      const view = VALID_VIEW_TYPES.has(nextViewType) ? nextViewType : 'week'
      const date = formatDateParam(nextDate) || ''

      const next = new URLSearchParams(location.search)
      next.set('view', view)
      if (date) next.set('date', date)
      else next.delete('date')
      setSearchParams(next, { replace: true })
    },
    [isEmbedded, location.search, setSearchParams]
  )

  useEffect(() => {
    if (!isEmbedded || !(shellDate instanceof Date)) return
    const currKey = formatDateParam(currentDate)
    const nextKey = formatDateParam(shellDate)
    if (currKey && nextKey && currKey !== nextKey) setCurrentDate(shellDate)
  }, [isEmbedded, shellDate, currentDate])

  useEffect(() => {
    if (!isEmbedded) return
    const nextView = resolveShellViewType(shellRange)
    if (nextView !== viewType) setViewType(nextView)
  }, [isEmbedded, shellRange, viewType])

  // Date range calculation based on view type with safe date operations
  const dateRange = useMemo(() => {
    const start = new Date(currentDate)
    const end = new Date(currentDate)

    try {
      switch (viewType) {
        case 'day':
          start?.setHours(0, 0, 0, 0)
          end?.setHours(23, 59, 59, 999)
          break
        case 'week':
          const dayOfWeek = start?.getDay()
          start?.setDate(start?.getDate() - dayOfWeek)
          start?.setHours(0, 0, 0, 0)
          end?.setDate(start?.getDate() + 6)
          end?.setHours(23, 59, 59, 999)
          break
        case 'month':
          start?.setDate(1)
          start?.setHours(0, 0, 0, 0)
          end?.setMonth(end?.getMonth() + 1)
          end?.setDate(0)
          end?.setHours(23, 59, 59, 999)
          break
      }
    } catch (error) {
      console.error('Date range calculation error:', error)
      // Return safe default range
      const safeStart = new Date()
      const safeEnd = new Date()
      safeStart?.setHours(0, 0, 0, 0)
      safeEnd?.setHours(23, 59, 59, 999)
      return { start: safeStart, end: safeEnd }
    }

    return { start, end }
  }, [currentDate, viewType])

  // Load calendar data with safe date operations
  const loadCalendarData = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error } = await withTimeout(
        calendarService?.getJobsByDateRange(dateRange?.start, dateRange?.end, {
          orgId: orgId || null,
        }),
        LOAD_TIMEOUT_MS,
        { label: 'Calendar load' }
      )

      if (error) {
        console.error('Error loading jobs:', error)
        setError('Failed to load jobs')
        return
      }

      const jobsData = data?.map((job) => ({
        ...job,
        scheduled_start_time: safeDateString(job?.scheduled_start_time),
        scheduled_end_time: safeDateString(job?.scheduled_end_time),
        // Derive a service_type for lane clarity if backend doesn't provide one.
        // Vendor/offsite work is inferred from vendor_id presence.
        service_type: job?.service_type || (job?.vendor_id ? 'vendor' : 'onsite'),
        color_code:
          getEventColors(
            job?.service_type || (job?.vendor_id ? 'vendor' : 'onsite'),
            job?.job_status
          )?.hex ||
          job?.color_code ||
          '#3b82f6',
      }))

      const scheduledIds = new Set((jobsData || []).map((j) => j?.id).filter(Boolean))

      // Also include promise-only items (All-day) so "Not scheduled" deals
      // with a Promise date show up on the grid.
      const endExclusive = (() => {
        const dt = new Date(dateRange?.end)
        if (Number.isNaN(dt.getTime())) return null
        dt.setDate(dt.getDate() + 1)
        dt.setHours(0, 0, 0, 0)
        return dt
      })()

      let promiseItems = []
      if (dateRange?.start && endExclusive) {
        const res = await withTimeout(
          getNeedsSchedulingPromiseItems({
            orgId: orgId || null,
            rangeStart: dateRange.start,
            rangeEnd: endExclusive,
          }),
          LOAD_TIMEOUT_MS,
          { label: 'Calendar promise-only load' }
        )
        promiseItems = Array.isArray(res?.items) ? res.items : []
      }

      const promiseJobs = (promiseItems || [])
        .map((item) => {
          const raw = item?.raw || {}
          const id = item?.id || raw?.id
          if (!id || scheduledIds.has(id)) return null

          const calendarKey =
            item?.calendarKey ||
            item?.calendar_key ||
            (item?.promisedAt ? `${id}::promise::${String(item.promisedAt).slice(0, 10)}` : null)

          const vendorId = raw?.vendor_id || item?.vendorId || null
          const serviceType = raw?.service_type || (vendorId ? 'vendor' : 'onsite')

          return {
            ...raw,
            id,
            calendar_key: calendarKey || id,
            title: raw?.title || item?.vehicleLabel || item?.customerName || 'All-day',
            vendor_id: vendorId,
            vendor_name: item?.vendorName || raw?.vendor_name || 'On-site',
            job_status: raw?.job_status || 'scheduled',
            scheduled_start_time: safeDateString(item?.promisedAt),
            scheduled_end_time: null,
            service_type: serviceType,
            time_tbd: true,
            schedule_state: item?.scheduleState || 'scheduled_no_time',
            color_code:
              getEventColors(serviceType, raw?.job_status)?.hex || raw?.color_code || '#3b82f6',
          }
        })
        .filter(Boolean)

      const mergedJobs = [...(jobsData || []), ...(promiseJobs || [])]
      setJobs(mergedJobs)

      // Update debug info
      setDebugInfo(
        `Loaded ${(jobsData?.length || 0) + (promiseJobs?.length || 0)} jobs (${safeFormatDate(dateRange?.start)} - ${safeFormatDate(dateRange?.end)})`
      )
    } catch (error) {
      console.error('Error loading calendar data:', error)
      setError(
        error?.message
          ? `Failed to load calendar data: ${error.message}`
          : 'Failed to load calendar data'
      )
    } finally {
      setLoading(false)
    }
  }, [dateRange, orgId])

  // Load data on component mount and date range changes
  useEffect(() => {
    loadCalendarData()
  }, [dateRange, loadCalendarData])

  const jobsByDayKey = useMemo(() => {
    const map = new Map()
    for (const job of jobs || []) {
      const key = safeDayKey(job?.scheduled_start_time)
      if (!key) continue
      const existing = map.get(key)
      if (existing) existing.push(job)
      else map.set(key, [job])
    }
    return map
  }, [jobs])

  // Navigation handlers with safe date operations
  const navigateDate = (direction) => {
    try {
      const newDate = new Date(currentDate)

      switch (viewType) {
        case 'day':
          newDate?.setDate(newDate?.getDate() + direction)
          break
        case 'week':
          newDate?.setDate(newDate?.getDate() + direction * 7)
          break
        case 'month':
          newDate?.setMonth(newDate?.getMonth() + direction)
          break
      }

      // Validate the new date before setting
      if (!isNaN(newDate?.getTime())) {
        setCurrentDate(newDate)
        setUrlState({ nextViewType: viewType, nextDate: newDate })
      } else {
        console.warn('Invalid date generated during navigation')
      }
    } catch (error) {
      console.error('Date navigation error:', error)
    }
  }

  const goToToday = () => {
    const today = new Date()
    setCurrentDate(today)
    setUrlState({ nextViewType: viewType, nextDate: today })
  }

  // Refresh data with safe date operations
  const refreshData = async () => {
    try {
      setLoading(true)
      setError(null)

      await loadCalendarData()

      // Update debug info
      setDebugInfo('Data refreshed successfully')
    } catch (error) {
      console.error('Error refreshing data:', error)
      setError('Failed to refresh data')
    } finally {
      setLoading(false)
    }
  }

  const handleDayDrilldown = useCallback(
    (dayDate) => {
      if (!unifiedShellEnabled) return
      const destination = trackCalendarNavigation({
        source: 'CalendarSchedulingCenter.MonthCell.Drilldown',
        target: 'board',
        range: 'day',
        date: dayDate,
        context: { from: `${location?.pathname || ''}${location?.search || ''}` },
      })
      navigate(destination)
    },
    [location?.pathname, location?.search, navigate, unifiedShellEnabled]
  )

  // Prevent double-clicks from sending duplicate status updates.
  const statusInFlightRef = useRef(new Set())
  const [, bumpStatusInFlightVersion] = useState(0)

  const isStatusInFlight = useCallback((jobId) => {
    if (!jobId) return false
    return statusInFlightRef.current.has(jobId)
  }, [])

  const withStatusLock = useCallback(async (jobId, fn) => {
    if (!jobId) return
    if (statusInFlightRef.current.has(jobId)) return
    statusInFlightRef.current.add(jobId)
    bumpStatusInFlightVersion((x) => x + 1)
    try {
      await fn()
    } finally {
      statusInFlightRef.current.delete(jobId)
      bumpStatusInFlightVersion((x) => x + 1)
    }
  }, [])

  const handleComplete = useCallback(
    async (job, e) => {
      e?.stopPropagation?.()
      const jobId = job?.id
      if (!jobId) return

      const previousStatus = job?.job_status
      const previousCompletedAt = job?.completed_at

      await withStatusLock(jobId, async () => {
        try {
          await jobService.updateStatus(jobId, 'completed', {
            completed_at: new Date().toISOString(),
          })

          const undo = async () => {
            try {
              const normalizedPrev = String(previousStatus || '')
                .trim()
                .toLowerCase()
              const fallbackStatus = getReopenTargetStatus(job, { now: new Date() })
              const undoStatus =
                normalizedPrev === 'quality_check' || normalizedPrev === 'delivered'
                  ? normalizedPrev
                  : fallbackStatus
              await jobService.updateStatus(jobId, undoStatus, {
                completed_at: previousCompletedAt || null,
              })
              toast?.success?.('Undo successful')
              await loadCalendarData()
            } catch (err) {
              console.error('[calendar-grid] undo failed', err)
              toast?.error?.('Undo failed')
            }
          }

          toast?.success?.({
            message: 'Completed',
            action: { label: 'Undo', onClick: undo },
            duration: 10000,
          })

          await loadCalendarData()
        } catch (err) {
          console.error('[calendar-grid] complete failed', err)
          toast?.error?.(err?.message || 'Failed to complete')
        }
      })
    },
    [loadCalendarData, toast, withStatusLock]
  )

  const handleReopen = useCallback(
    async (job, e) => {
      e?.stopPropagation?.()
      const jobId = job?.id
      if (!jobId) return

      await withStatusLock(jobId, async () => {
        try {
          const targetStatus = getReopenTargetStatus(job, { now: new Date() })
          await jobService.updateStatus(jobId, targetStatus, { completed_at: null })
          toast?.success?.('Reopened')
          await loadCalendarData()
        } catch (err) {
          console.error('[calendar-grid] reopen failed', err)
          toast?.error?.(err?.message || 'Failed to reopen')
        }
      })
    },
    [loadCalendarData, toast, withStatusLock]
  )

  // Format date for display with safe operations
  const formatDisplayDate = () => {
    try {
      if (viewType === 'week') {
        const weekStart = safeCreateDate(dateRange?.start)
        const weekEnd = safeCreateDate(dateRange?.end)

        if (!weekStart || !weekEnd) return 'Invalid Date Range'

        return `${safeFormatDate(weekStart, { month: 'short', day: 'numeric' })} - ${safeFormatDate(weekEnd, { month: 'short', day: 'numeric' })}`
      }

      const options = {
        year: 'numeric',
        month: 'long',
        ...(viewType === 'day' && { day: 'numeric' }),
      }

      return safeFormatDate(currentDate, options) || 'Invalid Date'
    } catch (error) {
      console.error('Date formatting error:', error)
      return 'Date Error'
    }
  }

  // Enhanced calendar grid component with safe date handling
  const CalendarGrid = ({ jobs, viewType }) => {
    if (viewType === 'week') {
      const todayKey = new Date().toDateString()
      // Create week view with safe date operations
      const weekDays = []
      const startDate = safeCreateDate(dateRange?.start)

      if (!startDate) {
        return (
          <div className="p-4 text-center text-red-500">
            Error: Unable to create calendar view - Invalid date range
          </div>
        )
      }

      for (let i = 0; i < 7; i++) {
        const dayDate = new Date(startDate)
        dayDate?.setDate(startDate?.getDate() + i)

        // Validate each day date
        if (isNaN(dayDate?.getTime())) {
          console.warn(`Invalid day date generated for day ${i}`)
          continue
        }

        const dayJobs = jobsByDayKey.get(dayDate?.toDateString?.()) || []

        weekDays?.push({
          date: dayDate,
          jobs: dayJobs,
        })
      }

      return (
        <div className="grid grid-cols-7 gap-1 h-full">
          {/* Day headers */}
          {weekDays?.map((day, index) => (
            <div
              key={`header-${index}`}
              className={`p-1 border-b font-semibold text-center ${day?.date?.toDateString?.() === todayKey ? 'bg-blue-50' : 'bg-gray-50'}`}
            >
              <div className="text-sm text-gray-600">
                {safeFormatDate(day?.date, { weekday: 'short' }) || 'N/A'}
              </div>
              <div className="text-base">{day?.date?.getDate() || '?'}</div>
            </div>
          ))}
          {/* Day content */}
          {weekDays?.map((day, index) => (
            <div
              key={`content-${index}`}
              className={`p-1 border-r border-gray-200 min-h-80 overflow-y-auto ${day?.date?.toDateString?.() === todayKey ? 'bg-blue-50/30' : 'bg-white'}`}
            >
              {day?.jobs?.map((job) => {
                const jobStartTime = job?.time_tbd
                  ? null
                  : safeCreateDate(job?.scheduled_start_time)
                const normalizedStatus =
                  job?.job_status === 'pending' ? 'scheduled' : job?.job_status
                const isPromiseOnly =
                  job?.time_tbd === true || job?.schedule_state === 'scheduled_no_time'
                const colors = getEventColors(job?.service_type, normalizedStatus)
                const statusLabel = isPromiseOnly
                  ? 'PROMISE'
                  : normalizedStatus
                    ? normalizedStatus === 'scheduled'
                      ? 'BOOKED'
                      : String(normalizedStatus).replace(/_/g, ' ').toUpperCase()
                    : 'SCHEDULED'

                const jobNumber = job?.job_number?.split?.('-')?.pop?.() || ''
                const vendorLabel = job?.vendor_name || (job?.vendor_id ? 'Vendor' : 'On-site')
                const vehicleLabel = job?.vehicle_info || ''
                const titleText = job?.title || ''
                const titleWithNumber = jobNumber
                  ? `${jobNumber} • ${titleText || 'Open deal'}`
                  : titleText || 'Open deal'
                const tooltipTitle = showTitleTooltips ? titleWithNumber : titleText || 'Open deal'
                const promiseLabel = job?.time_tbd
                  ? safeFormatDate(job?.scheduled_start_time, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })
                  : ''
                const timeLabel = job?.time_tbd
                  ? `Promise: ${promiseLabel || '—'}`
                  : jobStartTime
                    ? safeFormatTime(jobStartTime, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })
                    : 'Invalid Time'
                const popoverId = showDetailPopovers
                  ? `calendar-popover-${job?.id || job?.calendar_key}`
                  : undefined
                const popoverLines = showDetailPopovers
                  ? [
                      timeLabel ? `Time: ${timeLabel}` : null,
                      vendorLabel ? `Vendor: ${vendorLabel}` : null,
                      vehicleLabel ? `Vehicle: ${vehicleLabel}` : null,
                      statusLabel ? `Status: ${statusLabel}` : null,
                    ]
                  : []
                const handleGridClick = getCalendarGridClickHandler({
                  dealDrawerEnabled: canOpenDrawer,
                  onOpenDealDrawer,
                  navigate,
                  deal: job,
                })

                return (
                  <div
                    key={job?.calendar_key || job?.id}
                    className={`group relative mb-2 p-2 rounded text-xs cursor-pointer hover:shadow-md transition-shadow border ${colors?.className || 'bg-blue-100 border-blue-300 text-blue-900'}`}
                    onClick={handleGridClick}
                    title={tooltipTitle}
                    aria-describedby={popoverId}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="font-semibold truncate min-w-0">
                        {jobNumber ? `${jobNumber} • ` : ''}
                        {job?.title}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) =>
                            String(job?.job_status || '').toLowerCase() === 'completed'
                              ? handleReopen(job, e)
                              : handleComplete(job, e)
                          }
                          disabled={isStatusInFlight(job?.id)}
                          className={
                            String(job?.job_status || '').toLowerCase() === 'completed'
                              ? `inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 ${
                                  isStatusInFlight(job?.id)
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-indigo-100'
                                }`
                              : `inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 ${
                                  isStatusInFlight(job?.id)
                                    ? 'opacity-50 cursor-not-allowed'
                                    : 'hover:bg-emerald-100'
                                }`
                          }
                          aria-label={
                            String(job?.job_status || '').toLowerCase() === 'completed'
                              ? 'Reopen'
                              : 'Complete'
                          }
                          title={
                            String(job?.job_status || '').toLowerCase() === 'completed'
                              ? 'Reopen deal'
                              : 'Mark completed'
                          }
                        >
                          {String(job?.job_status || '').toLowerCase() === 'completed' ? (
                            <RefreshCw className="h-4 w-4" />
                          ) : (
                            <CheckCircle className="h-4 w-4" />
                          )}
                        </button>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-semibold ${colors?.badge || 'bg-blue-500 text-white'} ${colors?.pulse ? 'animate-pulse' : ''}`}
                        >
                          {statusLabel}
                        </span>
                      </div>
                    </div>
                    <div className="text-[11px] opacity-90 truncate">{vendorLabel}</div>
                    {vehicleLabel ? (
                      <div className="text-[11px] opacity-90 truncate">{vehicleLabel}</div>
                    ) : null}
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-xs opacity-80">
                        {job?.time_tbd
                          ? `Promise: ${promiseLabel || '—'}`
                          : jobStartTime
                            ? safeFormatTime(jobStartTime, {
                                hour: 'numeric',
                                minute: '2-digit',
                              })
                            : 'Invalid Time'}
                      </span>
                    </div>
                    <div className="mt-1 text-[10px] text-gray-700 truncate">
                      {job?.service_type === 'vendor' || job?.service_type === 'offsite'
                        ? 'Vendor/Offsite'
                        : 'Onsite'}
                    </div>

                    {showDetailPopovers ? (
                      <EventDetailPopover id={popoverId} title={titleWithNumber} lines={popoverLines} />
                    ) : null}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )
    }

    if (viewType === 'month') {
      const monthStart = safeCreateDate(dateRange?.start)
      const monthEnd = safeCreateDate(dateRange?.end)

      if (!monthStart || !monthEnd) {
        return (
          <div className="p-4 text-center text-red-500">
            Error: Unable to create month view - Invalid date range
          </div>
        )
      }

      const todayKey = new Date().toDateString()

      // Month grid starts on Sunday of the first week that contains monthStart
      const gridStart = new Date(monthStart)
      gridStart?.setDate(gridStart?.getDate() - gridStart?.getDay())
      gridStart?.setHours(0, 0, 0, 0)

      // Month grid ends on Saturday of the last week that contains monthEnd
      const gridEnd = new Date(monthEnd)
      gridEnd?.setDate(gridEnd?.getDate() + (6 - gridEnd?.getDay()))
      gridEnd?.setHours(23, 59, 59, 999)

      if (isNaN(gridStart?.getTime()) || isNaN(gridEnd?.getTime())) {
        return (
          <div className="p-4 text-center text-red-500">
            Error: Unable to create month view - Invalid grid range
          </div>
        )
      }

      const days = []
      const cursor = new Date(gridStart)
      cursor?.setHours(0, 0, 0, 0)

      // Build a flat list of days for the grid
      while (cursor <= gridEnd) {
        days.push(new Date(cursor))
        cursor?.setDate(cursor?.getDate() + 1)
      }

      const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

      return (
        <div className="h-full">
          <div className="grid grid-cols-7 gap-1">
            {weekdayLabels.map((label) => (
              <div
                key={label}
                className="bg-gray-50 p-2 border-b font-semibold text-center text-sm text-gray-700"
              >
                {label}
              </div>
            ))}

            {days.map((dayDate) => {
              const dayKey = dayDate?.toDateString?.()
              const isToday = dayKey === todayKey
              const isInMonth =
                dayDate?.getFullYear?.() === monthStart.getFullYear() &&
                dayDate?.getMonth?.() === monthStart.getMonth()

              const jumpToDay = () => {
                if (unifiedShellEnabled) {
                  handleDayDrilldown(dayDate)
                  return
                }
                try {
                  const nextDate = new Date(dayDate)
                  // Avoid edge-case day drift in some TZ/DST boundaries by anchoring away from midnight.
                  nextDate?.setHours?.(12, 0, 0, 0)
                  if (!isNaN(nextDate?.getTime?.())) {
                    setCurrentDate(nextDate)
                    setViewType('day')
                    setUrlState({ nextViewType: 'day', nextDate })
                  }
                } catch (e) {
                  console.error('Failed to jump to day view:', e)
                }
              }

              const dayJobs = jobsByDayKey.get(dayKey) || []

              const promiseCount = dayJobs.filter(
                (job) => job?.time_tbd === true || job?.schedule_state === 'scheduled_no_time'
              ).length
              const scheduledCount = Math.max((dayJobs?.length || 0) - promiseCount, 0)
              const overdueCount = dayJobs.filter((job) =>
                isOverdue(job?.next_promised_iso || job?.promised_date || job?.promisedAt)
              ).length

              const visibleJobs = dayJobs?.slice?.(0, 4) || []
              const remainingCount = Math.max((dayJobs?.length || 0) - visibleJobs.length, 0)

              const dayAriaLabel = unifiedShellEnabled
                ? `Open ${formatDateParam(dayDate)} in board view`
                : `Open ${formatDateParam(dayDate)} in day view`
              const dayTitle = unifiedShellEnabled ? 'Open Board day view' : 'Open day view'

              return (
                <div
                  key={dayKey}
                  role="button"
                  tabIndex={0}
                  onClick={jumpToDay}
                  onKeyDown={(e) => {
                    if (e?.key === 'Enter' || e?.key === ' ') {
                      e.preventDefault()
                      jumpToDay()
                    }
                  }}
                  className={`min-h-32 border border-gray-200 rounded-sm overflow-hidden cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-300 ${
                    isToday
                      ? 'bg-blue-50/30 border-blue-200'
                      : isInMonth
                        ? 'bg-white hover:bg-gray-50'
                        : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                  aria-label={dayAriaLabel}
                  title={dayTitle}
                >
                  <div className="flex items-center justify-between px-2 py-1 border-b border-gray-100">
                    <div
                      className={`text-sm font-semibold ${
                        isInMonth ? 'text-gray-900' : 'text-gray-400'
                      }`}
                    >
                      {dayDate?.getDate?.()}
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-gray-500">
                      {promiseCount > 0 ? (
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900">
                          P {promiseCount}
                        </span>
                      ) : null}
                      {scheduledCount > 0 ? (
                        <span className="rounded bg-blue-100 px-1.5 py-0.5 text-blue-900">
                          S {scheduledCount}
                        </span>
                      ) : null}
                      {overdueCount > 0 ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-900">
                          O {overdueCount}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="p-1 space-y-1 max-h-28 overflow-y-auto">
                    {visibleJobs.map((job) => {
                      const normalizedStatus =
                        job?.job_status === 'pending' ? 'scheduled' : job?.job_status
                      const isPromiseOnly =
                        job?.time_tbd === true || job?.schedule_state === 'scheduled_no_time'
                      const colors = getEventColors(job?.service_type, normalizedStatus)
                      const statusLabel = isPromiseOnly
                        ? 'PROMISE'
                        : normalizedStatus
                          ? normalizedStatus === 'scheduled'
                            ? 'BOOKED'
                            : String(normalizedStatus).replace(/_/g, ' ').toUpperCase()
                          : 'SCHEDULED'
                      const jobStartTime = job?.time_tbd
                        ? null
                        : safeCreateDate(job?.scheduled_start_time)

                      const jobNumber = job?.job_number?.split?.('-')?.pop?.() || ''
                      const vendorLabel =
                        job?.vendor_name || (job?.vendor_id ? 'Vendor' : 'On-site')
                      const titleText = job?.title || ''
                      const titleWithNumber = jobNumber
                        ? `${jobNumber} • ${titleText || 'Open deal'}`
                        : titleText || 'Open deal'
                      const tooltipTitle = showTitleTooltips
                        ? titleWithNumber
                        : titleText || 'Open deal'
                      const timeLabel = job?.time_tbd
                        ? `Promise: ${promiseLabel || '—'}`
                        : jobStartTime
                          ? safeFormatTime(jobStartTime, {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : ''
                      const popoverId = showDetailPopovers
                        ? `calendar-month-popover-${job?.id || job?.calendar_key}`
                        : undefined
                      const popoverLines = showDetailPopovers
                        ? [
                            timeLabel ? `Time: ${timeLabel}` : null,
                            vendorLabel ? `Vendor: ${vendorLabel}` : null,
                            statusLabel ? `Status: ${statusLabel}` : null,
                          ]
                        : []
                      const promiseLabel = job?.time_tbd
                        ? safeFormatDate(job?.scheduled_start_time, {
                            weekday: 'short',
                            month: 'short',
                            day: 'numeric',
                          })
                        : ''
                      const handleMonthGridClick = getCalendarGridClickHandler({
                        dealDrawerEnabled: canOpenDrawer,
                        onOpenDealDrawer,
                        navigate,
                        deal: job,
                      })

                      return (
                        <button
                          type="button"
                          key={job?.calendar_key || job?.id}
                          className={`group relative w-full text-left px-2 py-1 rounded text-xs border hover:shadow-sm transition-shadow ${
                            colors?.className || 'bg-blue-100 border-blue-300 text-blue-900'
                          }`}
                          onClick={(e) => {
                            e?.stopPropagation?.()
                            handleMonthGridClick()
                          }}
                          title={tooltipTitle}
                          aria-describedby={popoverId}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-medium truncate">
                              {jobNumber ? `${jobNumber} • ` : ''}
                              {job?.title}
                            </div>
                            <span
                              className={`shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold ${
                                colors?.badge || 'bg-blue-500 text-white'
                              } ${colors?.pulse ? 'animate-pulse' : ''}`}
                            >
                              {statusLabel}
                            </span>
                          </div>
                          <div className="text-[10px] opacity-90 truncate">{vendorLabel}</div>
                          <div className="text-[10px] opacity-80">
                            {job?.time_tbd
                              ? `Promise: ${promiseLabel || '—'}`
                              : jobStartTime
                                ? safeFormatTime(jobStartTime, {
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  })
                                : ''}
                          </div>

                          {showDetailPopovers ? (
                            <EventDetailPopover
                              id={popoverId}
                              title={titleWithNumber}
                              lines={popoverLines}
                            />
                          ) : null}
                        </button>
                      )
                    })}

                    {remainingCount > 0 ? (
                      <div className="text-xs text-gray-500 px-2">+{remainingCount} more</div>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )
    }

    // Simple list view for day/month with safe date handling
    return (
      <div className="p-4">
        {jobs?.length === 0 ? (
          <div className="text-center text-gray-500 py-8">No jobs scheduled for this period</div>
        ) : (
          <div className="space-y-4">
            {jobs?.map((job) => {
              const jobStartTime = job?.time_tbd ? null : safeCreateDate(job?.scheduled_start_time)
              const normalizedStatus = job?.job_status === 'pending' ? 'scheduled' : job?.job_status
              const isPromiseOnly =
                job?.time_tbd === true || job?.schedule_state === 'scheduled_no_time'
              const colors = getEventColors(job?.service_type, normalizedStatus)
              const statusLabel = isPromiseOnly
                ? 'PROMISE'
                : normalizedStatus
                  ? normalizedStatus === 'scheduled'
                    ? 'BOOKED'
                    : String(normalizedStatus).replace(/_/g, ' ').toUpperCase()
                  : 'SCHEDULED'
              const timeLabel = job?.time_tbd
                ? `Promise: ${
                    safeFormatDate(job?.scheduled_start_time, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    }) || '—'
                  }`
                : jobStartTime
                  ? jobStartTime?.toLocaleString()
                  : 'Invalid Time'
              const popoverId = showDetailPopovers
                ? `calendar-list-popover-${job?.id || job?.calendar_key}`
                : undefined
              const popoverLines = showDetailPopovers
                ? [
                    timeLabel ? `Time: ${timeLabel}` : null,
                    job?.vendor_name ? `Vendor: ${job.vendor_name}` : null,
                    job?.vehicle_info ? `Vehicle: ${job.vehicle_info}` : null,
                    statusLabel ? `Status: ${statusLabel}` : null,
                  ]
                : []
              const handleListClick = getCalendarGridClickHandler({
                dealDrawerEnabled: canOpenDrawer,
                onOpenDealDrawer,
                navigate,
                deal: job,
              })

              const listTitle = job?.title || 'Open deal'

              return (
                <div
                  key={job?.calendar_key || job?.id}
                  className="group relative bg-white p-4 rounded-lg shadow border cursor-pointer hover:shadow-md transition-shadow"
                  onClick={handleListClick}
                  aria-describedby={popoverId}
                >
                  <div className="flex items-start justify-between">
                    <div className={showTitleTooltips ? 'min-w-0' : ''}>
                      <h3
                        className={`font-medium text-gray-900 ${showTitleTooltips ? 'truncate' : ''}`}
                        title={showTitleTooltips ? listTitle : undefined}
                      >
                        {listTitle}
                      </h3>
                      <p className="text-sm text-gray-600">
                        {job?.vendor_name} • {job?.vehicle_info}
                      </p>
                      <p className="text-sm text-gray-500">
                        {job?.time_tbd
                          ? `Promise: ${
                              safeFormatDate(job?.scheduled_start_time, {
                                weekday: 'short',
                                month: 'short',
                                day: 'numeric',
                              }) || '—'
                            }`
                          : jobStartTime
                            ? jobStartTime?.toLocaleString()
                            : 'Invalid Time'}
                      </p>
                      <div className="mt-2 flex items-center gap-2 flex-wrap">
                        <span
                          className={`px-2 py-1 rounded text-xs font-medium ${colors?.badge || 'bg-blue-500 text-white'} ${colors?.pulse ? 'animate-pulse' : ''}`}
                        >
                          {statusLabel}
                        </span>
                        <span className="text-xs text-gray-600">
                          {job?.service_type === 'vendor' || job?.service_type === 'offsite'
                            ? 'Vendor/Offsite'
                            : 'Onsite'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={(e) =>
                          String(job?.job_status || '').toLowerCase() === 'completed'
                            ? handleReopen(job, e)
                            : handleComplete(job, e)
                        }
                        className={
                          String(job?.job_status || '').toLowerCase() === 'completed'
                            ? 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                            : 'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }
                        aria-label={
                          String(job?.job_status || '').toLowerCase() === 'completed'
                            ? 'Reopen'
                            : 'Complete'
                        }
                        title={
                          String(job?.job_status || '').toLowerCase() === 'completed'
                            ? 'Reopen deal'
                            : 'Mark completed'
                        }
                      >
                        {String(job?.job_status || '').toLowerCase() === 'completed' ? (
                          <RefreshCw className="h-5 w-5" />
                        ) : (
                          <CheckCircle className="h-5 w-5" />
                        )}
                      </button>
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: colors?.hex || job?.color_code || '#3b82f6' }}
                      ></div>
                    </div>
                  </div>

                  {showDetailPopovers ? (
                    <EventDetailPopover id={popoverId} title={listTitle} lines={popoverLines} />
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Error state component with safe date handling
  const ErrorState = () => (
    <div className="p-4 text-center text-red-500">
      <AlertTriangle className="w-12 h-12 mx-auto mb-4" />
      <h3 className="text-lg font-medium mb-2">Error Loading Data</h3>
      <p className="text-sm mb-4">{error || 'Failed to load calendar data'}</p>
      <button
        onClick={refreshData}
        className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
      >
        Try Again
      </button>
    </div>
  )

  // Loading state component with safe date handling
  const LoadingState = () => (
    <div className="p-4 text-center">
      <RefreshCw className="w-12 h-12 mx-auto mb-4 animate-spin" />
      <p className="text-sm text-gray-500">Loading calendar data...</p>
      <p className="text-xs text-gray-400 mt-2">{debugInfo || 'Initializing system...'}</p>
    </div>
  )

  // Main calendar view component with safe date handling
  const MainCalendarView = () => {
    const viewLabel = viewType === 'week' ? 'Weekly' : viewType === 'month' ? 'Monthly' : 'Daily'
    const hideShellActions = suppressChrome
    const isEmptyRange = Array.isArray(jobs) && jobs.length === 0
    const emptyTitle =
      viewType === 'week'
        ? 'No jobs scheduled for this week'
        : viewType === 'day'
          ? 'No jobs scheduled for this day'
          : 'No jobs scheduled for this period'

    return (
      <div className="p-4">
        {!suppressChrome && (
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{viewLabel} Schedule</h1>
              <p className="text-gray-600">{formatDisplayDate()}</p>
              <div className="mt-2">
                <CalendarLegend compact />
              </div>
            </div>
            {!hideShellActions && (
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigateDate(-1)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  disabled={loading}
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>

                <button
                  onClick={goToToday}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                >
                  Today
                </button>

                <button
                  onClick={() => navigateDate(1)}
                  className="p-2 rounded-full hover:bg-gray-100 transition-colors"
                  disabled={loading}
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-4">
          <div className="min-w-0">
            <div className="relative">
              <CalendarGrid jobs={jobs} viewType={viewType} />

              {isEmptyRange ? (
                <div className="absolute inset-0 flex items-center justify-center p-4 pointer-events-none">
                  <div className="max-w-md text-center rounded-lg border bg-white/95 backdrop-blur-sm p-4 shadow-sm pointer-events-auto">
                    <div className="text-base font-semibold text-gray-900">{emptyTitle}</div>
                    <div className="mt-1 text-sm text-gray-600">
                      {unifiedShellEnabled
                        ? 'Switch to List for a queue view, or open Board to book work.'
                        : 'Switch to Agenda for a queue view, or open Flow to book work.'}
                    </div>
                    {!hideShellActions && (
                      <div className="mt-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const destination = getCalendarDestination({ target: 'list' })
                            trackCalendarNavigation({
                              source: 'CalendarSchedulingCenter.EmptyState.OpenAgenda',
                              destination,
                              context: {
                                from: `${location?.pathname || ''}${location?.search || ''}`,
                              },
                            })
                            navigate(destination)
                          }}
                          className="px-3 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                        >
                          Open Agenda
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const destination = getCalendarDestination({ target: 'board' })
                            trackCalendarNavigation({
                              source: 'CalendarSchedulingCenter.EmptyState.OpenSchedulingBoard',
                              destination,
                              context: {
                                from: `${location?.pathname || ''}${location?.search || ''}`,
                              },
                            })
                            navigate(destination)
                          }}
                          className="px-3 py-2 text-sm rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                        >
                          {unifiedShellEnabled ? 'Open Board' : 'Open Flow'}
                        </button>
                        <button
                          type="button"
                          onClick={goToToday}
                          className="px-3 py-2 text-sm rounded border border-gray-200 bg-white text-gray-800 hover:bg-gray-50 transition-colors"
                        >
                          Today
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <div className="space-y-4">
            {!suppressChrome && <CalendarLegend showStatuses />}

            {!suppressChrome && (
              <div className="bg-white p-4 rounded-lg shadow border">
                <h3 className="font-medium text-gray-900 mb-3">View Settings</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      setViewType('day')
                      setUrlState({ nextViewType: 'day', nextDate: currentDate })
                    }}
                    className={`w-full py-2 rounded transition-colors ${
                      viewType === 'day'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Day View
                  </button>
                  <button
                    onClick={() => {
                      setViewType('week')
                      setUrlState({ nextViewType: 'week', nextDate: currentDate })
                    }}
                    className={`w-full py-2 rounded transition-colors ${
                      viewType === 'week'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Week View
                  </button>
                  <button
                    onClick={() => {
                      setViewType('month')
                      setUrlState({ nextViewType: 'month', nextDate: currentDate })
                    }}
                    className={`w-full py-2 rounded transition-colors ${
                      viewType === 'month'
                        ? 'bg-blue-500 text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Month View
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  const content = (
    <div className="max-w-7xl mx-auto p-4">
      {!isEmbedded && (
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            {unifiedShellEnabled ? 'Calendar' : 'Calendar Scheduling Center'}
          </h1>
          <div className="flex items-center gap-2">
            <div className="text-sm text-gray-600">{user?.name || 'User'}</div>
          </div>
        </div>
      )}

      {!isEmbedded && (
        <div className="mb-6">
          <CalendarViewTabs />
        </div>
      )}

      {loading ? <LoadingState /> : error ? <ErrorState /> : <MainCalendarView />}
    </div>
  )

  if (isEmbedded) return content

  return <AppLayout>{content}</AppLayout>
}

export default CalendarSchedulingCenter
