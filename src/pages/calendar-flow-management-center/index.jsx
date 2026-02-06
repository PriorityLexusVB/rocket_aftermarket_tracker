import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Clock,
  Car,
  Building2,
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  Search,
  Download,
  Eye,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'
import AppLayout from '../../components/layouts/AppLayout'
import { calendarService } from '../../services/calendarService'
import {
  getNeedsSchedulingPromiseItems,
  getScheduledJobsByDateRange,
} from '@/services/scheduleItemsService'
import { jobService } from '@/services/jobService'
import { vendorService } from '../../services/vendorService'
import useTenant from '@/hooks/useTenant'
import QuickFilters from './components/QuickFilters'
import { useToast } from '@/components/ui/ToastProvider'

import PromisedQueue from './components/PromisedQueue'
import JobDrawer from './components/JobDrawer'
import RoundUpModal from './components/RoundUpModal'
import { formatTime, isOverdue, getStatusBadge } from '../../lib/time'
import { useLocation, useNavigate } from 'react-router-dom'
import { formatEtDateLabel, toSafeDateForTimeZone } from '@/utils/scheduleDisplay'
import { getReopenTargetStatus } from '@/utils/jobStatusTimeRules'
import { withTimeout } from '@/utils/promiseTimeout'
import CalendarViewTabs from '@/components/calendar/CalendarViewTabs'
import EventDetailPopover from '@/components/calendar/EventDetailPopover'
import { getEventColors } from '@/utils/calendarColors'
import { isCalendarDealDrawerEnabled, isCalendarUnifiedShellEnabled } from '@/config/featureFlags'

const LOAD_TIMEOUT_MS = 15000

function getPromiseValue(job) {
  return job?.next_promised_iso || job?.promised_date || job?.promisedAt || null
}

function toEtDateKey(input) {
  const d = toSafeDateForTimeZone(input)
  if (!d) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(d)

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const y = map.year
  const m = map.month
  const day = map.day
  return y && m && day ? `${y}-${m}-${day}` : null
}

const CalendarFlowManagementCenter = ({ embedded = false, shellState, onOpenDealDrawer } = {}) => {
  const SNAPSHOT_ON = String(import.meta.env.VITE_ACTIVE_SNAPSHOT || '').toLowerCase() === 'true'

  const location = useLocation()
  const lastAutoFocusRef = useRef(null)

  // State management
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [jumpLoading, setJumpLoading] = useState(false)

  // Separate original data from filtered data
  const [originalJobs, setOriginalJobs] = useState([])
  const [originalOnSiteJobs, setOriginalOnSiteJobs] = useState([])
  const [filteredJobs, setFilteredJobs] = useState([])
  const [filteredOnSiteJobs, setFilteredOnSiteJobs] = useState([])

  const [vendors, setVendors] = useState([])
  const [selectedJob, setSelectedJob] = useState(null)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showRoundUp, setShowRoundUp] = useState(false)
  const [roundUpType, setRoundUpType] = useState('daily')

  const unifiedShellEnabled = isCalendarUnifiedShellEnabled()
  const dealDrawerEnabled = isCalendarDealDrawerEnabled()
  const canOpenDrawer = dealDrawerEnabled && typeof onOpenDealDrawer === 'function'
  const isEmbedded = embedded === true
  const showTitleTooltips = unifiedShellEnabled || isEmbedded
  const showDetailPopovers = unifiedShellEnabled || isEmbedded
  const useUnifiedColors = unifiedShellEnabled || isEmbedded
  const shellRange = shellState?.range

  const resolveShellViewMode = (range) => {
    const key = String(range || '').toLowerCase()
    if (key === 'day') return 'day'
    if (key === 'month' || key === 'next30') return 'month'
    if (key === 'week' || key === 'next7') return 'week'
    return 'week'
  }

  // View settings - Updated default and possible values
  const [viewMode, setViewMode] = useState(() =>
    isEmbedded ? resolveShellViewMode(shellRange) : 'week'
  ) // week, day, month
  const [vendorLanesEnabled, setVendorLanesEnabled] = useState(true)
  const [showEmptyLanes, setShowEmptyLanes] = useState(false)
  const [currentDate, setCurrentDate] = useState(() =>
    isEmbedded && shellState?.date instanceof Date ? shellState.date : new Date()
  )

  // Filters
  const [filters, setFilters] = useState({
    vendors: [],
    statuses: [],
    searchQuery: '',
  })

  // Drag and drop
  const [draggedJob, setDraggedJob] = useState(null)

  // All-day queue (promised day, no schedule window)
  const [needsSchedulingItems, setNeedsSchedulingItems] = useState([])

  const { orgId, loading: tenantLoading } = useTenant()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    if (!isEmbedded || !(shellState?.date instanceof Date)) return
    const nextDate = shellState.date
    if (Number.isNaN(nextDate.getTime())) return
    const currKey = currentDate?.toDateString?.()
    const nextKey = nextDate?.toDateString?.()
    if (currKey && nextKey && currKey !== nextKey) setCurrentDate(nextDate)
  }, [isEmbedded, shellState?.date, currentDate])

  useEffect(() => {
    if (!isEmbedded) return
    const nextMode = resolveShellViewMode(shellRange)
    if (nextMode !== viewMode) setViewMode(nextMode)
  }, [isEmbedded, shellRange, viewMode])

  const getViewStartDate = useCallback(() => {
    const date = new Date(currentDate)
    switch (viewMode) {
      case 'day':
        date?.setHours(0, 0, 0, 0)
        return date
      case 'week':
        const dayOfWeek = date?.getDay()
        const diffToMonday = (dayOfWeek + 6) % 7
        date?.setDate(date?.getDate() - diffToMonday) // Monday start
        date?.setHours(0, 0, 0, 0)
        return date
      case 'month':
        date?.setDate(1) // First day of the month
        date?.setHours(0, 0, 0, 0)
        return date
      default:
        date?.setHours(0, 0, 0, 0)
        return date
    }
  }, [currentDate, viewMode])

  const getViewEndDate = useCallback(() => {
    const date = getViewStartDate()
    switch (viewMode) {
      case 'day':
        date?.setDate(date?.getDate() + 1)
        return date
      case 'week':
        date?.setDate(date?.getDate() + 6) // Monday to Saturday
        return date
      case 'month':
        // End-exclusive: first day of next month
        date?.setMonth(date?.getMonth() + 1)
        return date
      default:
        date?.setDate(date?.getDate() + 1)
        return date
    }
  }, [getViewStartDate, viewMode])

  const viewDateKeys = useMemo(() => {
    const start = getViewStartDate()
    if (!start) return new Set()

    if (viewMode === 'day') {
      const key = toEtDateKey(start)
      return new Set(key ? [key] : [])
    }

    if (viewMode === 'week') {
      const out = new Set()
      for (let i = 0; i < 6; i++) {
        const d = new Date(start)
        d?.setDate(d?.getDate() + i)
        const key = toEtDateKey(d)
        if (key) out.add(key)
      }
      return out
    }

    return new Set()
  }, [getViewStartDate, viewMode])

  const needsSchedulingJobs = useMemo(() => {
    return (needsSchedulingItems || [])
      .map((it) => {
        const raw = it?.raw
        if (!raw) return null

        const promisedAt =
          it?.promisedAt || raw?.next_promised_iso || raw?.promised_date || raw?.promisedAt || null

        return {
          ...raw,
          calendar_key:
            it?.calendarKey ||
            it?.calendar_key ||
            (it?.promisedAt ? `${raw?.id}::promise::${String(it.promisedAt).slice(0, 10)}` : null),
          promisedAt,
          next_promised_iso: raw?.next_promised_iso ?? promisedAt,
          promised_date: raw?.promised_date ?? promisedAt,
        }
      })
      .filter(Boolean)
  }, [needsSchedulingItems])

  const needsSchedulingJobsInView = useMemo(() => {
    if (!needsSchedulingJobs.length) return []
    if (!viewDateKeys || viewDateKeys.size === 0) return []

    return needsSchedulingJobs.filter((job) => {
      const key = toEtDateKey(getPromiseValue(job))
      return !!(key && viewDateKeys.has(key))
    })
  }, [needsSchedulingJobs, viewDateKeys])

  const loadCalendarData = useCallback(async () => {
    if (tenantLoading || !orgId) {
      setOriginalJobs([])
      setOriginalOnSiteJobs([])
      setNeedsSchedulingItems([])
      setLoadError(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setLoadError(null)
    try {
      const startDate = getViewStartDate()
      const endDate = getViewEndDate()

      // Canonical scheduling truth: overlap window from calendar RPC, then hydrate job rows.
      const { jobs: jobsData } = await withTimeout(
        getScheduledJobsByDateRange({
          rangeStart: startDate,
          rangeEnd: endDate,
          orgId,
        }),
        LOAD_TIMEOUT_MS,
        { label: 'Flow Center scheduled load' }
      )

      const vendorJobs = jobsData?.filter((job) => job?.vendor_id)
      const onSiteJobs = jobsData?.filter((job) => !job?.vendor_id)

      // Store original data separately
      setOriginalJobs(vendorJobs)
      setOriginalOnSiteJobs(onSiteJobs)

      // Promise-only needs-scheduling queue for this view window (include overdue)
      const needsStart = new Date(startDate)
      needsStart?.setDate(needsStart?.getDate() - 365)
      const needsRes = await withTimeout(
        getNeedsSchedulingPromiseItems({
          orgId,
          rangeStart: needsStart,
          rangeEnd: endDate,
        }),
        LOAD_TIMEOUT_MS,
        { label: 'Flow Center needs-scheduling load' }
      )
      setNeedsSchedulingItems(needsRes?.items || [])
    } catch (error) {
      console.error('Error loading calendar data:', error)
      setLoadError(error?.message || 'Failed to load calendar data')
      setOriginalJobs([])
      setOriginalOnSiteJobs([])
      setNeedsSchedulingItems([])
    } finally {
      setLoading(false)
    }
  }, [getViewEndDate, getViewStartDate, orgId, tenantLoading])

  // Enhanced filter application function
  const applyFiltersToJobList = useCallback(
    (jobList) => {
      if (!jobList || jobList?.length === 0) return []

      let filteredJobs = [...jobList]

      // Apply search filter
      if (filters?.searchQuery) {
        const query = filters?.searchQuery?.toLowerCase()
        filteredJobs = filteredJobs?.filter(
          (job) =>
            job?.job_number?.toLowerCase()?.includes(query) ||
            job?.title?.toLowerCase()?.includes(query) ||
            job?.vehicle_info?.toLowerCase()?.includes(query) ||
            job?.customer_name?.toLowerCase()?.includes(query) ||
            job?.customer_phone?.toLowerCase()?.includes(query)
        )
      }

      // Apply status filters (multiple statuses)
      if (filters?.statuses?.length > 0) {
        filteredJobs = filteredJobs?.filter((job) => {
          // Map filter IDs to actual job status values
          const statusMapping = {
            today: () => {
              const jobDate = new Date(job?.scheduled_start_time)
              const today = new Date()
              return jobDate?.toDateString() === today?.toDateString()
            },
            in_progress: () => job?.job_status === 'in_progress',
            overdue: () =>
              isOverdue(job?.next_promised_iso || job?.promised_date || job?.promisedAt || null),
            no_show: () => job?.job_status === 'no_show',
            completed: () => job?.job_status === 'completed',
          }

          // Check if job matches any of the selected statuses
          return filters?.statuses?.some((statusId) => statusMapping?.[statusId]?.())
        })
      }

      // Apply vendor filters
      if (filters?.vendors?.length > 0) {
        filteredJobs = filteredJobs?.filter((job) => filters?.vendors?.includes(job?.vendor_id))
      }

      return filteredJobs
    },
    [filters]
  )

  // New centralized filter application function
  const applyFilters = useCallback(() => {
    // Apply filters to assigned jobs
    const filteredAssigned = applyFiltersToJobList(originalJobs)
    setFilteredJobs(filteredAssigned)

    // Apply filters to unassigned jobs
    const filteredOnSite = applyFiltersToJobList(originalOnSiteJobs)
    setFilteredOnSiteJobs(filteredOnSite)
  }, [applyFiltersToJobList, originalJobs, originalOnSiteJobs])

  const loadVendors = useCallback(async () => {
    try {
      if (tenantLoading || !orgId) {
        setVendors([])
        return
      }
      const vendorsData = await vendorService?.getAllVendors?.(orgId)
      setVendors((vendorsData || [])?.filter((v) => v?.is_active))
    } catch (error) {
      console.error('Error loading vendors:', error)
    }
  }, [orgId, tenantLoading])

  // Load initial data
  useEffect(() => {
    if (tenantLoading) return
    if (!orgId) return
    loadCalendarData()
    loadVendors()
  }, [loadCalendarData, loadVendors, orgId, tenantLoading])

  // If a focus id is provided, open that job in the drawer once data is available.
  useEffect(() => {
    const qs = new URLSearchParams(location?.search || '')
    const focusId = qs.get('focus')

    if (!focusId) return
    if (lastAutoFocusRef.current === focusId) return

    const allJobs = [...(originalJobs || []), ...(originalOnSiteJobs || [])]
    const match = allJobs.find((j) => String(j?.id) === String(focusId))
    if (!match) return

    setSelectedJob(match)
    setShowDrawer(true)
    lastAutoFocusRef.current = focusId
  }, [location?.search, originalJobs, originalOnSiteJobs])

  // Apply filters whenever filters or original data change
  useEffect(() => {
    applyFilters()
  }, [applyFilters])

  const handleJobClick = (job) => {
    setSelectedJob(job)
    setShowDrawer(true)
  }

  const promisedQueueClick = canOpenDrawer ? onOpenDealDrawer : handleJobClick

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

  const handleJobStatusUpdate = async (jobId, newStatus) => {
    await withStatusLock(jobId, async () => {
      try {
        const nextStatus = String(newStatus || '').toLowerCase()

        // Status-only updates should use jobService so we can correctly manage completed_at.
        if (nextStatus === 'completed') {
          await jobService.updateStatus(jobId, 'completed', {
            completed_at: new Date().toISOString(),
          })
          toast?.success?.('Completed')
        } else {
          // Clearing completed_at avoids "completed" timestamps lingering after status changes.
          await jobService.updateStatus(jobId, nextStatus, { completed_at: null })
        }

        loadCalendarData() // Refresh data
      } catch (error) {
        console.error('Error updating job status:', error)
        toast?.error?.(error?.message || 'Failed to update status')
      }
    })
  }

  const handleCompleteJob = async (job, e) => {
    e?.stopPropagation?.()
    const jobId = job?.id
    if (!jobId) return

    const previousStatus = job?.job_status
    const previousCompletedAt = job?.completed_at
    if (String(previousStatus || '').toLowerCase() === 'completed') return

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
            console.error('[Flow Mgmt] undo complete failed', err)
            toast?.error?.('Undo failed')
          }
        }

        toast?.success?.({
          message: 'Completed',
          action: { label: 'Undo', onClick: undo },
          duration: 10000,
        })

        await loadCalendarData()
      } catch {
        toast?.error?.('Failed to complete')
      }
    })
  }

  const handleReopenJob = useCallback(
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
        } catch (error) {
          console.error('[Flow Mgmt] reopen failed', error)
          toast?.error?.(error?.message || 'Failed to reopen')
        }
      })
    },
    [loadCalendarData, toast, withStatusLock]
  )

  const handleDragStart = (job) => {
    setDraggedJob(job)
  }

  const handleDragEnd = () => {
    setDraggedJob(null)
  }

  const handleDrop = async (vendorId, timeSlot) => {
    if (!draggedJob) return

    try {
      // Vendor lane drop (no explicit time slot): set vendor/location only.
      if (!timeSlot) {
        await calendarService?.updateJobSchedule(draggedJob?.id, {
          vendorId,
          location: vendorId ? 'off_site' : undefined,
        })
        await loadCalendarData()
        toast?.success?.('Updated vendor')
        return
      }

      const startTime = new Date(timeSlot)
      if (Number.isNaN(startTime?.getTime?.())) {
        throw new Error('Invalid time slot')
      }
      const endTime = new Date(startTime)
      endTime?.setHours(startTime?.getHours() + (draggedJob?.estimated_hours || 2))

      // Canonical scheduling truth: write schedule times to job_parts.
      // Keep a best-effort fallback to job-level schedule update for legacy schemas.
      try {
        await jobService.updateLineItemSchedules(draggedJob?.id, {
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
        })
      } catch (e) {
        const msg = String(e?.message || '')
        const msgLower = msg.toLowerCase()

        // If the deal has no line items requiring scheduling, job-level schedule won't surface
        // in the line-item calendar/RPC views. Make this actionable for the user.
        if (msgLower.includes('no line items require scheduling')) {
          toast?.error?.('Cannot schedule: add a line item that requires scheduling first')
          return
        }

        console.warn('[Flow Mgmt] updateLineItemSchedules failed; falling back to job schedule:', e)
        toast?.info?.('Line-item scheduling unavailable; using legacy job schedule')
        await calendarService?.updateJobSchedule(draggedJob?.id, {
          vendorId,
          startTime,
          endTime,
          location: vendorId ? 'off_site' : 'on_site',
        })
        await loadCalendarData()
        return
      }

      // Still update the job row for vendor/location/status (but not job-level times).
      await calendarService?.updateJobSchedule(draggedJob?.id, {
        vendorId,
        location: vendorId ? 'off_site' : 'on_site',
        status: 'scheduled',
      })

      loadCalendarData()
      toast?.success?.('Scheduled')
    } catch (error) {
      console.error('Error updating vendor:', error)
      toast?.error?.(error?.message || 'Failed to update vendor')
    }
  }

  const findNextScheduledJob = useCallback(
    async ({ fromDate, searchDays }) => {
      if (tenantLoading || !orgId) return null

      const parseDateSafe = (value) => {
        if (!value) return null
        const date = new Date(value)
        return Number.isNaN(date?.getTime?.()) ? null : date
      }

      const rangeStart = new Date(fromDate || new Date())
      const rangeEnd = new Date(rangeStart)
      rangeEnd?.setDate(rangeEnd?.getDate() + (searchDays || 180))

      const { jobs } = await getScheduledJobsByDateRange({
        rangeStart,
        rangeEnd,
        orgId,
      })

      const fromMs = rangeStart?.getTime?.() || 0
      const candidates = (jobs || [])
        ?.map((job) => {
          const start = parseDateSafe(job?.scheduled_start_time)
          return start ? { job, start, startMs: start?.getTime?.() } : null
        })
        ?.filter((x) => x && x?.startMs > fromMs)

      if (!candidates || candidates?.length === 0) return null
      candidates?.sort((a, b) => a?.startMs - b?.startMs)
      return candidates?.[0] || null
    },
    [orgId, tenantLoading]
  )

  const handleJumpToNextScheduled = useCallback(async () => {
    setJumpLoading(true)
    try {
      const next = await findNextScheduledJob({ fromDate: new Date(), searchDays: 180 })
      if (next?.start) {
        setCurrentDate(new Date(next?.start))
      } else {
        if (import.meta?.env?.DEV) {
          console.info('[Flow Mgmt] No next scheduled job found in search window')
        }
      }
    } catch (error) {
      console.error('Error jumping to next scheduled job:', error)
    } finally {
      setJumpLoading(false)
    }
  }, [findNextScheduledJob])

  const handleGoToNextRangeWithJobs = useCallback(async () => {
    setJumpLoading(true)
    try {
      const fromDate = getViewEndDate()
      const next = await findNextScheduledJob({ fromDate, searchDays: 365 })
      if (next?.start) {
        setCurrentDate(new Date(next?.start))
      } else {
        if (import.meta?.env?.DEV) {
          console.info('[Flow Mgmt] No jobs found in future search window')
        }
      }
    } catch (error) {
      console.error('Error finding next range with jobs:', error)
    } finally {
      setJumpLoading(false)
    }
  }, [findNextScheduledJob, getViewEndDate])

  // New month view render function
  const renderMonthView = () => {
    const monthStart = getViewStartDate()
    const monthEnd = getViewEndDate()
    const startDate = new Date(monthStart)
    const endDate = new Date(monthEnd)

    // Get first day of the week that contains the first day of the month
    startDate?.setDate(startDate?.getDate() - startDate?.getDay() + 1) // Monday start
    // Get last day of the week that contains the last day of the month
    endDate?.setDate(endDate?.getDate() + (6 - endDate?.getDay()) + 1)

    const weeks = []
    const currentWeekStart = new Date(startDate)

    while (currentWeekStart <= endDate) {
      const week = []
      for (let day = 0; day < 7; day++) {
        const currentDate = new Date(currentWeekStart)
        currentDate?.setDate(currentWeekStart?.getDate() + day)

        const dayJobs = filteredJobs?.filter((job) => {
          const jobDate = new Date(job?.scheduled_start_time)
          return jobDate?.toDateString() === currentDate?.toDateString()
        })

        const dayKey = toEtDateKey(currentDate)
        const noTime = (needsSchedulingJobs || []).filter((job) => {
          const k = toEtDateKey(getPromiseValue(job))
          return !!(dayKey && k && k === dayKey)
        })

        const combined = [...(dayJobs || []), ...(noTime || [])]

        week?.push({
          date: new Date(currentDate),
          jobs: combined,
          isCurrentMonth: currentDate?.getMonth() === monthStart?.getMonth(),
          isToday: currentDate?.toDateString() === new Date()?.toDateString(),
        })
      }
      weeks?.push(week)
      currentWeekStart?.setDate(currentWeekStart?.getDate() + 7)
    }

    return (
      <div className="h-full flex flex-col">
        {/* Month header with days of week */}
        <div className="grid grid-cols-7 gap-2 mb-4 border-b border-gray-200 pb-2">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']?.map((day) => (
            <div key={day} className="text-center text-sm font-medium text-gray-500 py-2">
              {day}
            </div>
          ))}
        </div>

        {/* Month grid */}
        <div className="flex-1 space-y-2">
          {weeks?.map((week, weekIndex) => (
            <div key={weekIndex} className="grid grid-cols-7 gap-2 h-32">
              {week?.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`
                    border border-gray-200 rounded-lg p-2 overflow-hidden
                    ${day?.isCurrentMonth ? 'bg-white' : 'bg-gray-50'}
                    ${day?.isToday ? 'ring-2 ring-indigo-500' : ''}
                  `}
                >
                  {/* Day number */}
                  <div
                    className={`
                    text-sm font-medium mb-2
                    ${day?.isCurrentMonth ? 'text-gray-900' : 'text-gray-400'}
                    ${day?.isToday ? 'text-indigo-600' : ''}
                  `}
                  >
                    {day?.date?.getDate()}
                  </div>

                  {/* Jobs for this day */}
                  <div className="space-y-1">
                    {day?.jobs?.slice(0, 2)?.map((job) => {
                      const isOnSite = !job?.vendor_id || job?.location === 'on_site'
                      const serviceType = isOnSite ? 'onsite' : 'vendor'
                      const dayJobColors = useUnifiedColors
                        ? getEventColors(serviceType, job?.job_status)
                        : null
                      const dayJobClass = useUnifiedColors
                        ? dayJobColors?.className || ''
                        : isOnSite
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-orange-100 text-orange-800 border-orange-200'

                      return (
                        <div
                          key={job?.calendar_key || job?.id}
                          className={`text-xs p-1 rounded cursor-pointer truncate border ${dayJobClass}`}
                          onClick={() => handleJobClick(job)}
                          title={`${job?.job_number} - ${job?.title}`}
                        >
                          {job?.job_number?.split('-')?.pop()}
                        </div>
                      )
                    })}
                    {day?.jobs?.length > 2 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{day?.jobs?.length - 2} more
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Updated renderEventChip to work with filtered data
  const renderEventChip = (job, renderOptions) => {
    const options =
      renderOptions && typeof renderOptions === 'object' && !Array.isArray(renderOptions)
        ? renderOptions
        : null
    const density = options?.density || 'default'
    const containerClassName = options?.containerClassName || ''
    const containerStyle = options?.containerStyle || undefined

    const isOnSite = !job?.vendor_id || job?.location === 'on_site'
    const jobNumber = job?.job_number?.split('-')?.pop()
    const titleText = [jobNumber, job?.title].filter(Boolean).join(' • ')
    const serviceType = isOnSite ? 'onsite' : 'vendor'
    const unifiedColors = useUnifiedColors ? getEventColors(serviceType, job?.job_status) : null
    const chipBg = useUnifiedColors
      ? unifiedColors?.bg || 'bg-blue-100'
      : isOnSite
        ? 'bg-green-50'
        : 'bg-orange-50'
    const chipBorder = useUnifiedColors
      ? unifiedColors?.border || 'border-blue-300'
      : isOnSite
        ? 'border-green-200'
        : 'border-orange-200'
    const chipHoverBorder = useUnifiedColors
      ? serviceType === 'onsite'
        ? 'hover:border-blue-300'
        : 'hover:border-purple-300'
      : isOnSite
        ? 'hover:border-green-300'
        : 'hover:border-orange-300'
    const chipText = useUnifiedColors
      ? unifiedColors?.text || 'text-blue-900'
      : 'text-gray-900'
    const rawStatus = String(job?.job_status || '').toLowerCase()
    const overdue = isOverdue(
      job?.next_promised_iso || job?.promised_date || job?.promisedAt || null
    )

    const hasTimeWindow = !!job?.scheduled_start_time
    const promise = getPromiseValue(job)
    const allDayLabel = promise ? `All day • ${formatEtDateLabel(promise)}` : 'All day'

    // In scheduling UIs, a promised day without a time window is treated as scheduled (all-day).
    // Avoid confusing "Pending" badges for these rows.
    const statusForBadge =
      !hasTimeWindow &&
      promise &&
      (rawStatus === 'pending' || rawStatus === 'new' || rawStatus === '')
        ? 'scheduled'
        : rawStatus

    const statusBadge = getStatusBadge(statusForBadge)
    const statusColor = statusBadge?.color || 'bg-blue-500'

    const isCompleted = rawStatus === 'completed'

    const densityClasses = density === 'compact' ? 'p-2 text-xs leading-snug' : 'p-3 text-sm'
    const densityMargin = density === 'compact' ? 'mb-1' : 'mb-2'
    const timeLabel = hasTimeWindow
      ? `${formatTime(job?.scheduled_start_time)}–${formatTime(job?.scheduled_end_time)}`
      : allDayLabel
    const popoverId = showDetailPopovers ? `board-popover-${job?.id || job?.calendar_key}` : undefined
    const popoverLines = showDetailPopovers
      ? [
          timeLabel ? `Time: ${timeLabel}` : null,
          statusBadge?.label ? `Status: ${statusBadge.label}` : null,
          job?.customer_name ? `Customer: ${job.customer_name}` : null,
          job?.vehicle_info ? `Vehicle: ${job.vehicle_info}` : null,
          !isOnSite && job?.vendor_name ? `Vendor: ${job.vendor_name}` : null,
        ]
      : []

    return (
      <div
        key={job?.calendar_key || job?.id}
        aria-describedby={popoverId}
        className={`
          group relative rounded-lg border ${densityClasses} ${densityMargin} cursor-pointer transition-all duration-200 hover:shadow-md
          ${chipBg} ${chipBorder} ${chipHoverBorder} ${chipText}
          ${containerClassName}
        `}
        style={containerStyle}
        onClick={() => {
          if (canOpenDrawer) {
            onOpenDealDrawer(job)
            return
          }
          handleJobClick(job)
        }}
        draggable
        onDragStart={() => handleDragStart(job)}
        onDragEnd={handleDragEnd}
      >
        {/* Status stripe */}
        <div className={`absolute left-0 top-0 bottom-0 w-1 ${statusColor} rounded-l-lg`} />

        {/* Main content */}
        <div className="ml-2">
          {/* Top line */}
          <div className="flex items-center justify-between mb-1 gap-2">
            <div className="font-bold truncate flex items-center gap-2">
              <Car className="h-3 w-3 mr-1" />
              <span className="truncate" title={showTitleTooltips ? titleText : undefined}>
                {titleText}
              </span>
              {(job?.has_active_loaner || job?.loaner_id || job?.customer_needs_loaner) && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 whitespace-nowrap">
                  Loaner
                </span>
              )}
            </div>
            {overdue && (
              <div className="flex items-center text-red-600">
                <AlertTriangle className="h-3 w-3" />
                <span className="text-xs ml-1">Overdue</span>
              </div>
            )}

            <button
              type="button"
              onClick={(e) => (isCompleted ? handleReopenJob(job, e) : handleCompleteJob(job, e))}
              disabled={isStatusInFlight(job?.id)}
              className={
                isCompleted
                  ? `ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-indigo-200 bg-indigo-50 text-indigo-800 ${
                      isStatusInFlight(job?.id)
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-indigo-100'
                    }`
                  : `ml-1 inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-800 ${
                      isStatusInFlight(job?.id)
                        ? 'opacity-50 cursor-not-allowed'
                        : 'hover:bg-emerald-100'
                    }`
              }
              aria-label={isCompleted ? 'Reopen' : 'Complete'}
              title={isCompleted ? 'Reopen deal' : 'Mark completed'}
            >
              {isCompleted ? (
                <RefreshCw className="h-4 w-4" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
            </button>
          </div>

          {/* Second line */}
          <div className="text-xs text-gray-600 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="flex items-center">
                <Clock className="h-3 w-3 mr-1" />
                {hasTimeWindow
                  ? `${formatTime(job?.scheduled_start_time)}–${formatTime(job?.scheduled_end_time)}`
                  : allDayLabel}
              </div>
            </div>

            {/* Status badge */}
            <div
              className={`px-2 py-1 rounded-full text-xs font-medium ${statusBadge?.bg || 'bg-gray-100'} ${statusBadge?.textColor || 'text-gray-800'}`}
            >
              {statusBadge?.label || statusForBadge || job?.job_status}
            </div>
          </div>

          {/* Customer / service context */}
          {job?.customer_name || job?.service_type ? (
            <div className="text-xs text-gray-600 mt-1 truncate">
              {[job?.customer_name, job?.service_type].filter(Boolean).join(' • ')}
            </div>
          ) : null}

          {/* Vehicle line */}
          {job?.vehicle_info ? (
            <div className="text-xs text-gray-600 mt-1 truncate">{job?.vehicle_info}</div>
          ) : null}

          {/* Vendor line for off-site */}
          {!isOnSite && (
            <div className="text-xs text-gray-600 mt-1 flex items-center">
              <Building2 className="h-3 w-3 mr-1" />
              {job?.vendor_name}
            </div>
          )}

          {showDetailPopovers ? (
            <EventDetailPopover id={popoverId} title={titleText} lines={popoverLines} />
          ) : null}
        </div>
      </div>
    )
  }

  const renderWeekView = () => {
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const days =
      viewMode === 'day'
        ? [new Date(getViewStartDate())]
        : weekDays.map((_, dayIndex) => {
            const d = new Date(getViewStartDate())
            d?.setDate(d?.getDate() + dayIndex)
            return d
          })
    const timeSlots = Array.from({ length: 10 }, (_, i) => 8 + i) // 8AM to 6PM
    const HOUR_SLOT_PX = 180
    const PX_PER_MINUTE = HOUR_SLOT_PX / 60
    const DROP_MINUTE_INCREMENT = 5

    return (
      <div className="h-full">
        <div className={`grid ${viewMode === 'day' ? 'grid-cols-2' : 'grid-cols-7'} gap-2 h-full`}>
          {/* Time header */}
          <div className="col-span-1 space-y-0">
            <div className="h-12"></div> {/* Header spacer */}
            {timeSlots?.map((hour) => (
              <div
                key={hour}
                className="text-xs text-gray-500 text-right pr-2 flex items-start justify-end"
                style={{ height: HOUR_SLOT_PX }}
              >
                {hour}:00
              </div>
            ))}
          </div>
          {/* Days */}
          {days?.map((dayDate) => {
            const dayLabel = dayDate?.toLocaleDateString('en-US', { weekday: 'long' })
            const dayJobs = filteredJobs?.filter((job) => {
              const jobDate = new Date(job?.scheduled_start_time)
              return jobDate?.toDateString() === dayDate?.toDateString()
            })

            const dayKey = toEtDateKey(dayDate)
            const dayNoTimeJobs = (needsSchedulingJobsInView || []).filter((job) => {
              const k = toEtDateKey(getPromiseValue(job))
              return !!(dayKey && k && k === dayKey)
            })

            return (
              <div
                key={dayKey || dayDate?.toISOString?.() || String(dayDate)}
                className="border-l border-gray-200 pl-2"
              >
                {/* Day header */}
                <div className="h-12 border-b border-gray-200 pb-2">
                  <div className="font-medium text-sm">{dayLabel}</div>
                  <div className="text-xs text-gray-500">
                    {dayDate?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
                {dayNoTimeJobs?.length > 0 && (
                  <div className="py-2 border-b border-gray-100">
                    <div className="space-y-2">{dayNoTimeJobs?.map(renderEventChip)}</div>
                  </div>
                )}
                {/* Time slots */}
                <div className="space-y-0">
                  {timeSlots?.map((hour) => (
                    <div
                      key={`${dayKey || dayLabel}-${hour}`}
                      className={`border-b border-gray-100 relative py-1 ${
                        draggedJob ? 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-200' : ''
                      }`}
                      style={{ height: HOUR_SLOT_PX }}
                      onDragOver={(e) => e?.preventDefault()}
                      onDrop={(e) => {
                        const rect = e?.currentTarget?.getBoundingClientRect?.()
                        const offsetY = rect ? e?.clientY - rect.top : 0
                        const rawMinutes = rect?.height
                          ? Math.max(0, Math.min(59, Math.round((offsetY / rect.height) * 60)))
                          : 0
                        const minutes =
                          Math.round(rawMinutes / DROP_MINUTE_INCREMENT) * DROP_MINUTE_INCREMENT

                        const slot = new Date(dayDate)
                        slot?.setHours(hour, minutes, 0, 0)
                        handleDrop(null, slot)
                      }}
                    >
                      {/* Jobs for this time slot */}
                      {(() => {
                        const jobsInHour = (dayJobs || [])
                          .filter((job) => {
                            const jobStart = new Date(job?.scheduled_start_time)
                            return jobStart?.getHours?.() === hour
                          })
                          .sort((a, b) => {
                            const aStart = new Date(a?.scheduled_start_time)
                            const bStart = new Date(b?.scheduled_start_time)
                            return aStart - bStart
                          })

                        const minuteCounts = new Map()

                        return jobsInHour.map((job) => {
                          const jobStart = new Date(job?.scheduled_start_time)
                          const minutes = jobStart?.getMinutes?.() || 0
                          const seen = minuteCounts.get(minutes) || 0
                          minuteCounts.set(minutes, seen + 1)

                          const baseTop = Math.max(
                            0,
                            Math.min(HOUR_SLOT_PX - 8, minutes * PX_PER_MINUTE)
                          )
                          const stackedTop = Math.min(HOUR_SLOT_PX - 8, baseTop + seen * 10)

                          return renderEventChip(job, {
                            density: 'compact',
                            containerClassName: 'absolute left-1 right-1',
                            containerStyle: { top: stackedTop, zIndex: 10 + seen },
                          })
                        })
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const renderVendorLanes = () => {
    const allDayJobs = needsSchedulingJobsInView || []
    const allDayOnSiteJobs = allDayJobs.filter(
      (job) => !job?.vendor_id || job?.location === 'on_site'
    )
    const onSiteJobs = filteredJobs?.filter((job) => !job?.vendor_id || job?.location === 'on_site')
    const onSiteCombined = [...(allDayOnSiteJobs || []), ...(onSiteJobs || [])]
    const vendorsToShow = showEmptyLanes
      ? vendors
      : vendors?.filter(
          (vendor) =>
            filteredJobs?.some((job) => job?.vendor_id === vendor?.id) ||
            allDayJobs?.some((job) => job?.vendor_id === vendor?.id)
        )

    return (
      <div className="space-y-4">
        {/* On-Site Lane */}
        {(showEmptyLanes || onSiteCombined?.length > 0) && (
          <div className="bg-green-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <div className="w-4 h-4 bg-green-500 rounded mr-3"></div>
                <h3 className="font-medium">On-Site Jobs</h3>
              </div>
              <div className="text-sm text-gray-600">{onSiteCombined?.length || 0} jobs</div>
            </div>

            <div className="grid grid-cols-6 gap-2">{onSiteCombined?.map(renderEventChip)}</div>
          </div>
        )}
        {/* Vendor Lanes */}
        {vendorsToShow?.map((vendor) => {
          const vendorJobs = filteredJobs?.filter((job) => job?.vendor_id === vendor?.id)
          const allDayVendorJobs = allDayJobs?.filter((job) => job?.vendor_id === vendor?.id)
          const vendorJobsCombined = [...(allDayVendorJobs || []), ...(vendorJobs || [])]
          const capacity = vendorJobsCombined?.length
          const maxCapacity = 7 // Default capacity

          return (
            <div key={vendor?.id} className="bg-orange-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-4 h-4 bg-orange-500 rounded mr-3"></div>
                  <div>
                    <h3 className="font-medium">{vendor?.name}</h3>
                    <div className="text-sm text-gray-600">{vendor?.specialty}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium">
                    {capacity} / {maxCapacity}
                  </div>
                  <div className="text-xs text-gray-600">scheduled / capacity</div>
                </div>
              </div>
              <div
                className={`grid grid-cols-6 gap-2 min-h-[60px] border-2 border-dashed border-orange-200 rounded p-2 ${
                  draggedJob ? 'bg-orange-50/50 border-orange-300' : ''
                }`}
                onDragOver={(e) => e?.preventDefault()}
                onDrop={() => handleDrop(vendor?.id)}
              >
                {vendorJobsCombined?.map(renderEventChip)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const content = (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {unifiedShellEnabled ? 'Calendar' : 'Calendar Flow Management Center'}
            </h1>
            {!isEmbedded && (
              <p className="text-gray-600">Visual scheduling and workflow management</p>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Updated View Toggle - Replace Agenda with Month */}
            {!isEmbedded && (
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('day')}
                  className={`px-3 py-1 rounded text-sm ${viewMode === 'day' ? 'bg-white shadow-sm' : ''}`}
                >
                  Day
                </button>
                <button
                  onClick={() => setViewMode('week')}
                  className={`px-3 py-1 rounded text-sm ${viewMode === 'week' ? 'bg-white shadow-sm' : ''}`}
                >
                  Week
                </button>
                <button
                  onClick={() => setViewMode('month')}
                  className={`px-3 py-1 rounded text-sm ${viewMode === 'month' ? 'bg-white shadow-sm' : ''}`}
                >
                  Month
                </button>
              </div>
            )}

            {/* Vendor Lanes Toggle - Hide for month view */}
            {viewMode !== 'month' && (
              <button
                onClick={() => setVendorLanesEnabled(!vendorLanesEnabled)}
                className={`flex items-center px-4 py-2 rounded-lg border ${
                  vendorLanesEnabled
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <Eye className="h-4 w-4 mr-2" />
                Vendor Lanes
              </button>
            )}

            {/* Round-up Button */}
            <button
              onClick={() => setShowRoundUp(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Round-Up
            </button>

            <details className="rounded-lg border border-gray-200 bg-white px-3 py-2">
              <summary className="cursor-pointer select-none text-sm text-gray-700">Legend</summary>
              <div className="mt-2 grid gap-1 text-xs text-gray-600">
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-green-500" />
                  <span>On-site (PLV) (no vendor or on-site)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="inline-block h-2.5 w-2.5 rounded bg-orange-500" />
                  <span>Vendor lane (off-site)</span>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-3 w-3 text-red-600" />
                  <span>Overdue promise</span>
                </div>
                <div className="text-[11px] text-gray-500">
                  Drop onto a time slot to set minutes (5-min increments) or into a vendor lane to
                  set vendor.
                </div>
              </div>
            </details>
          </div>
        </div>

        {/* Navigation and Filters */}
        <div className="flex items-center justify-between mt-6">
          {/* Updated Date Navigation to handle month view */}
          <div className="flex items-center space-x-4">
            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                if (viewMode === 'month') {
                  newDate?.setMonth(newDate?.getMonth() - 1)
                } else if (viewMode === 'week') {
                  newDate?.setDate(newDate?.getDate() - 7)
                } else {
                  newDate?.setDate(newDate?.getDate() - 1)
                }
                setCurrentDate(newDate)
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>

            <div className="text-lg font-medium">
              {viewMode === 'month'
                ? currentDate?.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
                : viewMode === 'week'
                  ? `Week of ${currentDate?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`
                  : currentDate?.toLocaleDateString('en-US', {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
            </div>

            <button
              onClick={() => {
                const newDate = new Date(currentDate)
                if (viewMode === 'month') {
                  newDate?.setMonth(newDate?.getMonth() + 1)
                } else if (viewMode === 'week') {
                  newDate?.setDate(newDate?.getDate() + 7)
                } else {
                  newDate?.setDate(newDate?.getDate() + 1)
                }
                setCurrentDate(newDate)
              }}
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ChevronRight className="h-5 w-5" />
            </button>

            <button
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg"
            >
              Today
            </button>

            {viewMode !== 'month' && (
              <button
                onClick={handleJumpToNextScheduled}
                disabled={jumpLoading}
                className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg disabled:opacity-50"
                title="Jump to the next scheduled job"
              >
                {jumpLoading ? 'Finding…' : 'Jump to Next Scheduled'}
              </button>
            )}
          </div>

          {/* Search */}
          <div className="flex items-center space-x-4">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <input
                type="text"
                placeholder="Search stock #, phone, customer..."
                value={filters?.searchQuery}
                onChange={(e) => setFilters((prev) => ({ ...prev, searchQuery: e?.target?.value }))}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg w-80"
              />
            </div>
          </div>
        </div>

        {!isEmbedded && (
          <div className="mt-4">
            <CalendarViewTabs />
          </div>
        )}
      </div>

      {/* Quick Filters - Updated to use original data for counts */}
      <QuickFilters
        filters={filters}
        onFiltersChange={setFilters}
        jobCounts={{
          today: [...originalJobs, ...originalOnSiteJobs, ...needsSchedulingJobsInView]?.filter(
            (j) => {
              const jobDate = new Date(j?.scheduled_start_time)
              const today = new Date()
              return jobDate?.toDateString() === today?.toDateString()
            }
          )?.length,
          inProgress: [...originalJobs, ...originalOnSiteJobs]?.filter(
            (j) => j?.job_status === 'in_progress'
          )?.length,
          overdue: [...originalJobs, ...originalOnSiteJobs, ...needsSchedulingJobsInView]?.filter(
            (j) => isOverdue(getPromiseValue(j))
          )?.length,
          noShow: [...originalJobs, ...originalOnSiteJobs]?.filter(
            (j) => j?.job_status === 'no_show'
          )?.length,
          completed: [...originalJobs, ...originalOnSiteJobs]?.filter(
            (j) => j?.job_status === 'completed'
          )?.length,
        }}
      />

      {/* Main Content */}
      <div className="flex h-screen">
        {/* Promised Queue Sidebar - Hide for month view */}
        {viewMode !== 'month' && (
          <PromisedQueue
            jobs={needsSchedulingJobs}
            onJobClick={promisedQueueClick}
            onDragStart={handleDragStart}
            onComplete={(job) => handleCompleteJob(job)}
            onReopen={(job) => handleReopenJob(job)}
            isStatusInFlight={isStatusInFlight}
            loading={loading}
          />
        )}

        {/* Calendar View */}
        <div className={`flex-1 p-4 ${viewMode === 'month' ? 'w-full' : ''}`}>
          {loadError ? (
            <div
              role="alert"
              className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"
            >
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="text-sm">
                  <span className="font-medium">Calendar didn’t load.</span>{' '}
                  <span className="text-amber-800">{String(loadError)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => loadCalendarData()}
                  className="h-8 rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
                >
                  Retry
                </button>
              </div>
            </div>
          ) : null}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
            </div>
          ) : (
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 h-full overflow-auto">
              {viewMode === 'month' ? (
                renderMonthView()
              ) : filteredJobs?.length + filteredOnSiteJobs?.length === 0 &&
                (needsSchedulingJobsInView?.length || 0) === 0 ? (
                <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-lg font-semibold text-gray-900">
                    No jobs this {viewMode === 'day' ? 'day' : 'week'}.
                  </div>
                  <div className="text-sm text-gray-600 mt-1">
                    Try jumping forward to the next scheduled job.
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      onClick={handleGoToNextRangeWithJobs}
                      disabled={jumpLoading}
                      className="px-4 py-2 rounded-lg bg-gray-900 text-white text-sm hover:bg-gray-800 disabled:opacity-50"
                    >
                      {jumpLoading
                        ? 'Finding…'
                        : `Go to next ${viewMode === 'day' ? 'day' : 'week'} with jobs`}
                    </button>
                    {vendorLanesEnabled && (
                      <button
                        onClick={() => setShowEmptyLanes((v) => !v)}
                        className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                      >
                        {showEmptyLanes ? 'Hide empty lanes' : 'Show empty lanes'}
                      </button>
                    )}
                    <button
                      onClick={() => {
                        if (SNAPSHOT_ON) {
                          navigate('/currently-active-appointments?window=all_day')
                          return
                        }

                        toast?.info(
                          'All-day view requires VITE_ACTIVE_SNAPSHOT=true — opening Active Appointments.'
                        )
                        navigate('/currently-active-appointments')
                      }}
                      className="px-4 py-2 rounded-lg border border-gray-200 text-sm hover:bg-gray-50"
                    >
                      Go to All-day
                    </button>
                  </div>
                </div>
              ) : viewMode === 'day' ? (
                renderWeekView()
              ) : vendorLanesEnabled ? (
                <div className="h-full">
                  <div className="flex items-center justify-end px-4 py-3 border-b border-gray-100">
                    <button
                      onClick={() => setShowEmptyLanes((v) => !v)}
                      className="text-sm text-gray-700 hover:text-gray-900"
                    >
                      {showEmptyLanes ? 'Hide empty lanes' : 'Show empty lanes'}
                    </button>
                  </div>
                  <div className="p-4">{renderVendorLanes()}</div>
                </div>
              ) : (
                renderWeekView()
              )}
            </div>
          )}
        </div>
      </div>

      {/* Job Details Drawer */}
      <JobDrawer
        job={selectedJob}
        isOpen={showDrawer}
        onClose={() => setShowDrawer(false)}
        onStatusUpdate={handleJobStatusUpdate}
      />

      {/* Round-up Modal - Updated to use filtered data */}
      <RoundUpModal
        isOpen={showRoundUp}
        onClose={() => setShowRoundUp(false)}
        jobs={filteredJobs}
        type={roundUpType}
        onTypeChange={setRoundUpType}
        onComplete={(job) => handleCompleteJob(job)}
        onReopen={(job) => handleReopenJob(job)}
        isStatusInFlight={isStatusInFlight}
      />
    </div>
  )

  if (isEmbedded) return content

  return <AppLayout>{content}</AppLayout>
}

export default CalendarFlowManagementCenter
