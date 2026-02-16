// src/pages/calendar-agenda/index.jsx
// Feature-flagged Simple Agenda view (VITE_SIMPLE_CALENDAR=true)
// Minimal, read-only upcoming appointments list with inline actions: View Deal, Reschedule, Complete
// Does NOT modify legacy calendar components; safe to remove.
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { jobService } from '@/services/jobService'
import { calendarService } from '@/services/calendarService'
import { getNeedsSchedulingPromiseItems, getScheduleItems } from '@/services/scheduleItemsService'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatScheduleRange } from '@/utils/dateTimeUtils'
import { getReopenTargetStatus } from '@/utils/jobStatusTimeRules'
import { withTimeout } from '@/utils/promiseTimeout'
import RescheduleModal from './RescheduleModal'
import SupabaseConfigNotice from '@/components/ui/SupabaseConfigNotice'
import Navbar from '@/components/ui/Navbar'
import CalendarViewTabs from '@/components/calendar/CalendarViewTabs'
import EventDetailPopover from '@/components/calendar/EventDetailPopover'
import { isCalendarDealDrawerEnabled, isCalendarUnifiedShellEnabled } from '@/config/featureFlags'
import { getJobLocationType } from '@/utils/locationType'
import { getMicroFlashClass } from '@/utils/microInteractions'
import { calendarQueryMatches } from '@/utils/calendarQueryMatch'

const TZ = 'America/New_York'
const LOAD_TIMEOUT_MS = 15000

function summarizeOpCodesFromParts(parts, max = 5) {
  const list = Array.isArray(parts) ? parts : []
  const byCode = new Map()

  for (const p of list) {
    const code = String(p?.product?.op_code || p?.product?.opCode || '')
      .trim()
      .toUpperCase()
    if (!code) continue

    const qtyRaw = p?.quantity_used ?? p?.quantity ?? 1
    const qtyNum = Number(qtyRaw)
    const qty = Number.isFinite(qtyNum) && qtyNum > 0 ? qtyNum : 1

    const existing = byCode.get(code)
    if (!existing) byCode.set(code, qty)
    else byCode.set(code, existing + qty)
  }

  const tokens = Array.from(byCode.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([code, qty]) => (qty > 1 ? `${code}×${qty}` : code))

  const clipped = tokens.slice(0, max)
  return { tokens: clipped, extraCount: Math.max(0, tokens.length - clipped.length) }
}

function toYmdInTz(date, timeZone) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

// Lightweight date key grouping (America/New_York)
function toDateKey(ts) {
  if (!ts) return 'unscheduled'
  const d = new Date(ts)
  // Force America/New_York without external deps: compute offset via Intl
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  // mm/dd/yyyy -> yyyy-mm-dd
  const [m, dd, yyyy] = fmt.split('/')
  return `${yyyy}-${m}-${dd}`
}

function getTimeZoneOffsetMs(date, timeZone) {
  // Parse short offset like "GMT-5" or "GMT-05:00"
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+0'
  if (tzName === 'GMT' || tzName === 'UTC') return 0
  const m = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/) // GMT-5, GMT-05:00
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const hours = Number(m[2] || 0)
  const minutes = Number(m[3] || 0)
  return sign * (hours * 60 + minutes) * 60 * 1000
}

function getZonedYmd(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const ymd = fmt.format(date) // YYYY-MM-DD
  const [year, month, day] = ymd.split('-').map(Number)
  return { year, month, day }
}

function zonedStartOfDay(date, timeZone) {
  const { year, month, day } = getZonedYmd(date, timeZone)
  const baseUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0)

  // Iterate once to stabilize around DST boundaries
  const guess = new Date(baseUtc)
  const offset1 = getTimeZoneOffsetMs(guess, timeZone)
  const utc1 = baseUtc - offset1
  const d1 = new Date(utc1)
  const offset2 = getTimeZoneOffsetMs(d1, timeZone)
  const utc2 = baseUtc - offset2
  return new Date(utc2)
}

function zonedStartOfNextDay(date, timeZone, days = 1) {
  const start = zonedStartOfDay(date, timeZone)
  const probe = new Date(start.getTime() + days * 24 * 60 * 60 * 1000)
  return zonedStartOfDay(probe, timeZone)
}

function dateKeyToNoonUtcDate(dateKey) {
  if (!dateKey) return null
  const m = String(dateKey).match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return null
  const year = Number(m[1])
  const month = Number(m[2])
  const day = Number(m[3])
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0))
}

function formatAgendaDayHeader(dateKey) {
  const d = dateKeyToNoonUtcDate(dateKey)
  if (!d) return String(dateKey)
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(d)
}

function mapShellRangeToAgenda(range) {
  const key = String(range || '').toLowerCase()
  if (key === 'day') return 'today'
  if (key === 'week' || key === 'next7') return 'next7days'
  if (key === 'month' || key === 'next30') return 'all'
  return 'all'
}

export function getEffectiveScheduleWindow(job) {
  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  const scheduledParts = parts
    .filter((p) => p?.scheduled_start_time)
    .sort((a, b) => String(a.scheduled_start_time).localeCompare(String(b.scheduled_start_time)))

  const start = scheduledParts?.[0]?.scheduled_start_time || job?.scheduled_start_time || null
  const end = scheduledParts?.[0]?.scheduled_end_time || job?.scheduled_end_time || start || null
  return { start, end }
}

// Derive filtered list
export function applyFilters(rows, { q, status, dateRange, vendorFilter, now: nowOverride } = {}) {
  const now = nowOverride instanceof Date ? nowOverride : new Date()
  const rangeStart = zonedStartOfDay(now, TZ)
  const rangeEnd =
    dateRange === 'today'
      ? zonedStartOfNextDay(now, TZ, 1)
      : dateRange === 'next3days'
        ? zonedStartOfNextDay(now, TZ, 3)
        : dateRange === 'next7days'
          ? zonedStartOfNextDay(now, TZ, 7)
          : null

  return rows.filter((r) => {
    const raw = r?.raw || r
    const jobStatus = raw?.job_status ?? r?.job_status
    if (status && jobStatus !== status) return false

    const vendorId = r?.vendorId ?? r?.vendor_id ?? r?.raw?.vendor_id
    if (vendorFilter && vendorId !== vendorFilter) return false

    const { start: apptStartIso, end: apptEndIso } = r?.scheduledStart
      ? { start: r.scheduledStart, end: r.scheduledEnd }
      : getEffectiveScheduleWindow(r)

    // For day-based views, promised_date is treated as a pure day (no timezone shifting).
    const promisedVal = raw?.promised_date ?? r?.promisedAt ?? r?.promised_date ?? null
    const promisedKey = promisedVal ? String(promisedVal).slice(0, 10) : null

    // If it has neither a schedule window nor a promised date, it can't be placed on the Agenda.
    if (!apptStartIso && !promisedKey) return false

    // Date range filter
    if (rangeStart && rangeEnd) {
      if (apptStartIso) {
        const apptStart = new Date(apptStartIso)
        const apptEnd = apptEndIso ? new Date(apptEndIso) : apptStart
        if (Number.isNaN(apptStart.getTime()) || Number.isNaN(apptEnd.getTime())) return false
        // Overlap: appt_start < rangeEnd AND appt_end > rangeStart
        if (!(apptStart < rangeEnd && apptEnd > rangeStart)) return false
      } else if (promisedKey) {
        const startKey = toYmdInTz(rangeStart, TZ)
        const endKey = toYmdInTz(rangeEnd, TZ)
        if (!startKey || !endKey) return false
        if (promisedKey < startKey) return false
        if (promisedKey >= endKey) return false
      }
    }

    if (q && !calendarQueryMatches(r, q)) return false
    return true
  })
}

export function getAgendaRowClickHandler({ dealDrawerEnabled, onOpenDealDrawer, navigate, deal }) {
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

export default function CalendarAgenda({ embedded = false, shellState, onOpenDealDrawer, hideEmbeddedControls = false } = {}) {
  const { orgId, session, userProfile, loading: authLoading, profileLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const isEmbedded = embedded === true
  const showTitleTooltips = isEmbedded
  const showDetailPopovers = isEmbedded
  const shellRange = shellState?.range
  const dealDrawerEnabled = isCalendarDealDrawerEnabled()
  const unifiedShellEnabled = isCalendarUnifiedShellEnabled()
  const microInteractionsEnabled = unifiedShellEnabled
  const [consistency, setConsistency] = useState({
    rpcCount: 0,
    jobCount: 0,
    missingCount: 0,
  })
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [jobs, setJobs] = useState([])
  const [conflicts, setConflicts] = useState(new Map())

  const isDeliveryCoordinator = useMemo(() => {
    const dept = String(userProfile?.department || '')
      .trim()
      .toLowerCase()
    return dept === 'delivery coordinator'
  }, [userProfile?.department])

  const authIsLoading = authLoading || profileLoading

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = isEmbedded ? 'Calendar' : 'Calendar — Agenda'
    }
  }, [isEmbedded])

  // Initialize filters from URL params, with localStorage fallback
  const [q, setQ] = useState(() => {
    if (isEmbedded && shellState?.q) return shellState.q
    const urlParam = new URLSearchParams(location.search).get('q')
    if (urlParam) return urlParam
    return typeof localStorage !== 'undefined' ? localStorage.getItem('agendaFilter_q') || '' : ''
  })
  const [debouncedQ, setDebouncedQ] = useState(q)
  const [status, setStatus] = useState(() => {
    const urlParam = new URLSearchParams(location.search).get('status')
    if (urlParam) return urlParam
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('agendaFilter_status') || ''
      : ''
  })
  const [dateRange, setDateRange] = useState(() => {
    if (isEmbedded) return mapShellRangeToAgenda(shellRange)
    const urlParam = new URLSearchParams(location.search).get('dateRange')
    if (urlParam) return urlParam
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('agendaFilter_dateRange') || 'all'
      : 'all'
  })
  const [vendorFilter] = useState(() => {
    const urlParam = new URLSearchParams(location.search).get('vendor')
    if (urlParam) return urlParam
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('agendaFilter_vendor') || ''
      : ''
  })
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300)
    return () => clearTimeout(handle)
  }, [q])

  // Delivery coordinator view defaults: My items + next 3 days.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const urlDateRange = params.get('dateRange')
    const storedDateRange =
      typeof localStorage !== 'undefined' ? localStorage.getItem('agendaFilter_dateRange') : null

    if (!isDeliveryCoordinator) return

    if (!urlDateRange && !storedDateRange && (dateRange === 'all' || !dateRange)) {
      setDateRange('next3days')
    }
  }, [location.search, dateRange, isDeliveryCoordinator])

  useEffect(() => {
    if (!isEmbedded) return
    const nextRange = mapShellRangeToAgenda(shellRange)
    if (nextRange !== dateRange) setDateRange(nextRange)
  }, [isEmbedded, shellRange, dateRange])

  useEffect(() => {
    if (!isEmbedded) return
    const urlQ = new URLSearchParams(location.search).get('q') || ''
    const nextQ = shellState?.q ?? urlQ
    if (nextQ !== q) setQ(nextQ)
  }, [isEmbedded, location.search, q, shellState?.q])

  // When Supabase env is missing, dev fallback returns empty rows. Make that explicit.
  const supabaseNotice = <SupabaseConfigNotice className="mb-3" />
  const focusId = useMemo(
    () => new URLSearchParams(location.search).get('focus'),
    [location.search]
  )
  const focusRef = useRef(null)
  const focusOpenedRef = useRef(null)
  const microFlashTimerRef = useRef(null)
  const [recentlyUpdatedId, setRecentlyUpdatedId] = useState(null)

  // Reschedule modal state
  const [rescheduleModal, setRescheduleModal] = useState({
    open: false,
    job: null,
    initialStart: null,
    initialEnd: null,
  })

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

  // Filters toggle state
  const [filtersExpanded, setFiltersExpanded] = useState(false)

  // Sync filters to URL and localStorage
  useEffect(() => {
    // Persist to localStorage
    if (typeof localStorage !== 'undefined') {
      if (q) localStorage.setItem('agendaFilter_q', q)
      else localStorage.removeItem('agendaFilter_q')

      if (status) localStorage.setItem('agendaFilter_status', status)
      else localStorage.removeItem('agendaFilter_status')

      if (dateRange) localStorage.setItem('agendaFilter_dateRange', dateRange)
      else localStorage.removeItem('agendaFilter_dateRange')

      if (vendorFilter) localStorage.setItem('agendaFilter_vendor', vendorFilter)
      else localStorage.removeItem('agendaFilter_vendor')
    }

    if (isEmbedded) return

    const params = new URLSearchParams(location.search)
    if (q) params.set('q', q)
    else params.delete('q')
    if (status) params.set('status', status)
    else params.delete('status')
    if (dateRange && dateRange !== 'all') params.set('dateRange', dateRange)
    else params.delete('dateRange')
    if (vendorFilter) params.set('vendor', vendorFilter)
    else params.delete('vendor')
    if (focusId) params.set('focus', focusId)
    const next = params.toString()
    const current = location.search.replace(/^\?/, '')
    if (next !== current) navigate({ search: next ? `?${next}` : '' }, { replace: true })
  }, [q, status, dateRange, vendorFilter, focusId, navigate, location.search, isEmbedded])

  useEffect(() => {
    if (!isEmbedded) return
    const params = new URLSearchParams(location.search)
    const nextQ = debouncedQ.trim()
    if (nextQ) params.set('q', nextQ)
    else params.delete('q')
    const next = params.toString()
    const current = location.search.replace(/^\?/, '')
    if (next !== current) navigate({ search: next ? `?${next}` : '' }, { replace: true })
  }, [debouncedQ, isEmbedded, navigate, location.search])

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      if (!orgId) {
        setJobs([])
        setConflicts(new Map())
        setConsistency({ rpcCount: 0, jobCount: 0, missingCount: 0 })
        return
      }

      const now = new Date()
      const rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const rangeEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

      // Scheduled items (have a schedule window) + promised-only items (no time yet)
      const [scheduledRes, promisedRes] = await withTimeout(
        Promise.all([
          getScheduleItems({ rangeStart, rangeEnd, orgId }),
          getNeedsSchedulingPromiseItems({ rangeStart, rangeEnd, orgId }),
        ]),
        LOAD_TIMEOUT_MS,
        { label: 'Agenda load' }
      )

      const scheduledDebug = scheduledRes?.debug || {}
      setConsistency({
        rpcCount: scheduledDebug?.rpcCount || 0,
        jobCount: scheduledDebug?.jobCount || 0,
        missingCount: scheduledDebug?.missingCount || 0,
      })

      const locationParam = new URLSearchParams(location.search).get('location') || 'All'
      const isLocationFilterActive = unifiedShellEnabled && locationParam !== 'All'
      const filterByLocation = (items) => {
        if (!isLocationFilterActive) return items
        const list = Array.isArray(items) ? items : []
        return list.filter((item) => {
          const raw = item?.raw || item
          return getJobLocationType(raw) === locationParam
        })
      }

      const excluded = new Set(['draft', 'canceled', 'cancelled'])
      const combined = [...(scheduledRes?.items || []), ...(promisedRes?.items || [])].filter(
        (it) => !excluded.has(String(it?.raw?.job_status || it?.job_status || '').toLowerCase())
      )

      combined.sort((a, b) => {
        const aIso = a?.scheduledStart || a?.promisedAt || null
        const bIso = b?.scheduledStart || b?.promisedAt || null
        const aMs = aIso ? new Date(aIso).getTime() : 0
        const bMs = bIso ? new Date(bIso).getTime() : 0
        return aMs - bMs
      })

      setJobs(filterByLocation(combined))
    } catch (e) {
      console.warn('[agenda] load failed', e)
      setJobs([])
      setLoadError(e?.message || 'Failed to load agenda')
      setConsistency({ rpcCount: 0, jobCount: 0, missingCount: 0 })
    } finally {
      setLoading(false)
    }
  }, [location.search, orgId, unifiedShellEnabled])

  useEffect(() => {
    if (authIsLoading) return
    load()
  }, [authIsLoading, load])

  // Check for conflicts (passive, no blocking)
  useEffect(() => {
    const checkConflicts = async () => {
      const conflictMap = new Map()
      for (const job of jobs) {
        const vendorId = job?.vendorId ?? job?.vendor_id ?? job?.raw?.vendor_id
        const startIso = job?.scheduledStart ?? job?.scheduled_start_time
        const endIso = job?.scheduledEnd ?? job?.scheduled_end_time
        if (!vendorId || !startIso || !endIso) continue
        try {
          const start = new Date(startIso)
          const end = new Date(endIso)
          // Check 30min window
          const checkStart = new Date(start.getTime() - 30 * 60 * 1000)
          const checkEnd = new Date(end.getTime() + 30 * 60 * 1000)
          const { hasConflict } = await calendarService.checkSchedulingConflict(
            vendorId,
            checkStart,
            checkEnd,
            job.id
          )
          conflictMap.set(job.id, hasConflict)
        } catch (err) {
          console.debug('[agenda] conflict check skipped', err)
        }
      }
      setConflicts(conflictMap)
    }
    if (jobs.length > 0) {
      checkConflicts()
    }
  }, [jobs])

  // Group
  const filtered = useMemo(
    () =>
      applyFilters(jobs, {
        q,
        status,
        dateRange,
        vendorFilter,
      }),
    [jobs, q, status, dateRange, vendorFilter]
  )
  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach((j) => {
      const raw = j?.raw || j
      const promisedKey = raw?.promised_date
        ? String(raw.promised_date).slice(0, 10)
        : j?.promisedAt
          ? String(j.promisedAt).slice(0, 10)
          : null

      const scheduledWindow = j?.scheduledStart
        ? { start: j.scheduledStart }
        : getEffectiveScheduleWindow(raw)
      const scheduledStart = scheduledWindow?.start
      const hasTime = !!scheduledStart

      const key = hasTime
        ? toDateKey(scheduledStart)
        : promisedKey || toDateKey(scheduledWindow?.start)

      if (!key) return

      const bucket = map.get(key) || { allDay: [], scheduled: [] }
      if (hasTime) bucket.scheduled.push(j)
      else bucket.allDay.push(j)
      map.set(key, bucket)
    })
    return Array.from(map.entries())
      .map(([key, bucket]) => [key, [...bucket.allDay, ...bucket.scheduled]])
      .sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  // Focus highlight
  useEffect(() => {
    if (!focusId) return
    const el = focusRef.current
    if (el) {
      el.classList.add('animate-pulse')
      const t = setTimeout(() => el.classList.remove('animate-pulse'), 3000)
      return () => clearTimeout(t)
    }
  }, [focusId])

  useEffect(() => {
    if (!focusId) return
    if (!dealDrawerEnabled || typeof onOpenDealDrawer !== 'function') return
    if (focusOpenedRef.current === focusId) return

    const match = (jobs || []).find((row) => String(row?.id || row?.raw?.id) === String(focusId))
    if (!match) return

    onOpenDealDrawer(match?.raw || match)
    focusOpenedRef.current = focusId
  }, [dealDrawerEnabled, focusId, jobs, onOpenDealDrawer])

  function handleReschedule(job) {
    const raw = job?.raw || job
    const { start, end } = job?.scheduledStart
      ? { start: job.scheduledStart, end: job.scheduledEnd }
      : getEffectiveScheduleWindow(raw)
    setRescheduleModal({ open: true, job: raw, initialStart: start, initialEnd: end })
  }

  async function handleRescheduleSubmit(scheduleData) {
    if (!rescheduleModal.job) return

    try {
      const jobId = rescheduleModal.job.id
      const vendorId = rescheduleModal.job?.vendor_id
      const hadConflict = microInteractionsEnabled && conflicts.get(jobId)
      const { startTime, endTime } = scheduleData || {}

      // Update line item schedules using the new service method
      await jobService.updateLineItemSchedules(jobId, scheduleData)

      if (microInteractionsEnabled && jobId) {
        if (microFlashTimerRef.current) clearTimeout(microFlashTimerRef.current)
        setRecentlyUpdatedId(jobId)
        microFlashTimerRef.current = setTimeout(() => {
          setRecentlyUpdatedId(null)
          microFlashTimerRef.current = null
        }, 600)
      }

      if (microInteractionsEnabled && hadConflict && vendorId && startTime && endTime) {
        try {
          const { hasConflict } = await calendarService.checkSchedulingConflict(
            vendorId,
            new Date(startTime),
            new Date(endTime),
            jobId
          )
          if (!hasConflict) {
            toast?.success?.('Conflict resolved')
          }
        } catch (err) {
          console.debug('[agenda] conflict recheck skipped', err)
        }
      }

      // Show success message
      toast?.success?.(microInteractionsEnabled ? 'Saved' : 'Schedule updated successfully')

      // Close modal and refresh
      setRescheduleModal({ open: false, job: null, initialStart: null, initialEnd: null })
      await load()
    } catch (e) {
      console.error('[agenda] reschedule failed', e)
      toast?.error?.(e?.message || 'Failed to reschedule')
    }
  }

  useEffect(() => {
    return () => {
      if (microFlashTimerRef.current) clearTimeout(microFlashTimerRef.current)
    }
  }, [])

  async function handleComplete(job) {
    const previousStatus = job.job_status
    const previousCompletedAt = job.completed_at

    await withStatusLock(job?.id, async () => {
      try {
        await jobService.updateStatus(job.id, 'completed', {
          completed_at: new Date().toISOString(),
        })

        // Show success with Undo action
        if (toast?.success) {
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
              await jobService.updateStatus(job.id, undoStatus, {
                completed_at: previousCompletedAt || null,
              })
              toast.success('Undo successful')
              await load()
            } catch (err) {
              console.error('[agenda] undo failed', err)
              toast.error('Undo failed')
            }
          }

          // Toast with undo action (10s timeout)
          toast.success({
            message: 'Completed',
            action: { label: 'Undo', onClick: undo },
            duration: 10000,
          })
        }

        await load()
      } catch (err) {
        console.error('[agenda] complete failed', err)
        toast?.error?.('Could not complete')
      }
    })
  }

  async function handleReopen(job) {
    await withStatusLock(job?.id, async () => {
      try {
        const targetStatus = getReopenTargetStatus(job, { now: new Date() })
        await jobService.updateStatus(job.id, targetStatus, { completed_at: null })
        toast?.success?.('Reopened')
        await load()
      } catch (err) {
        console.error('[agenda] reopen failed', err)
        toast?.error?.('Could not reopen')
      }
    })
  }

  const renderAgendaRow = (r) => {
    const focused = r.id === focusId
    const hasConflict = conflicts.get(r.id)
    const microFlash = getMicroFlashClass({
      enabled: microInteractionsEnabled,
      activeId: recentlyUpdatedId,
      itemId: r.id,
    })
    const raw = r?.raw || r
    const { start, end } = r?.scheduledStart
      ? { start: r.scheduledStart, end: r.scheduledEnd }
      : getEffectiveScheduleWindow(raw)
    const timeRange = start ? formatScheduleRange(start, end) : null
    const title = raw?.title || raw?.job_number
    const titleText = title || r.id || 'Appointment'
    const popoverId = showDetailPopovers ? `agenda-popover-${r.id}` : undefined
    const popoverLines = showDetailPopovers
      ? [
          timeRange ? `Time: ${timeRange}` : 'Time: All-day',
          customerName ? `Customer: ${customerName}` : null,
          vehicleLabel ? `Vehicle: ${vehicleLabel}` : null,
        ]
      : []
    const vehicleLabel =
      r?.vehicleLabel ||
      `${raw?.vehicle?.make || ''} ${raw?.vehicle?.model || ''} ${raw?.vehicle?.year || ''}`.trim()
    const customerName = r?.customerName || raw?.customer_name || raw?.vehicle?.owner_name || ''
    const stock = raw?.vehicle?.stock_number || ''
    const ops = summarizeOpCodesFromParts(raw?.job_parts, 6)

    const handleRowClick = getAgendaRowClickHandler({
      dealDrawerEnabled,
      onOpenDealDrawer,
      navigate,
      deal: raw,
    })

    return (
      <li
        key={r?.calendarKey || r?.calendar_key || r.id}
        ref={focused ? focusRef : null}
        tabIndex={0}
        aria-label={`Appointment ${titleText}`}
        aria-describedby={popoverId}
        className={`group relative grid grid-cols-[7rem_1fr_auto] items-center gap-4 px-4 py-3 text-sm hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
          focused ? 'bg-amber-50' : ''
        } ${microFlash}`}
        onClick={handleRowClick}
      >
        {/* Time column (blank for all-day) */}
        <div className="w-28 text-xs font-mono tabular-nums text-slate-600">
          {timeRange ? (
            <span className="truncate" title={timeRange}>
              {timeRange}
            </span>
          ) : (
            <span className="text-slate-400">All-day</span>
          )}
        </div>

        <div className="min-w-0">
          <div
            className={`font-medium flex items-center gap-2 ${showTitleTooltips ? 'min-w-0' : ''}`}
          >
            <span
              className={showTitleTooltips ? 'truncate' : ''}
              title={showTitleTooltips ? titleText : undefined}
            >
              {titleText}
            </span>
            {hasConflict && (
              <span
                className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                title="Potential scheduling conflict"
                aria-label="Potential scheduling conflict"
              >
                Conflict
              </span>
            )}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {[customerName, vehicleLabel, stock ? `Stock ${stock}` : null]
              .filter(Boolean)
              .join(' • ')}
          </div>
          {ops.tokens.length ? (
            <div className="mt-1 flex flex-wrap items-center gap-1" aria-label="Products">
              {ops.tokens.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                  title={t}
                >
                  {t}
                </span>
              ))}
              {ops.extraCount ? (
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                  +{ops.extraCount}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="flex items-center justify-end">
          <details className="relative">
            <summary
              onClick={(event) => event.stopPropagation()}
              className="list-none rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
              aria-label="More actions"
            >
              ⋯
            </summary>
            <div className="absolute right-0 z-20 mt-2 w-40 rounded-md border border-slate-200 bg-white p-1 text-xs text-slate-700 shadow-lg">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  handleReschedule(r)
                }}
                className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
              >
                Reschedule
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  return String(r?.job_status || '').toLowerCase() === 'completed'
                    ? handleReopen(r)
                    : handleComplete(r)
                }}
                disabled={isStatusInFlight(r?.id)}
                className={`w-full rounded px-2 py-1 text-left hover:bg-slate-100 ${
                  isStatusInFlight(r?.id) ? 'text-slate-300 cursor-not-allowed' : ''
                }`}
              >
                {String(r?.job_status || '').toLowerCase() === 'completed' ? 'Reopen' : 'Complete'}
              </button>
            </div>
          </details>
        </div>

        {showDetailPopovers ? (
          <EventDetailPopover id={popoverId} title={titleText} lines={popoverLines} />
        ) : null}
      </li>
    )
  }

  if (authIsLoading)
    return (
      <div className="p-4" role="status" aria-live="polite">
        Loading agenda…
      </div>
    )

  if (loading)
    return (
      <div className="p-4" role="status" aria-live="polite">
        Loading agenda…
      </div>
    )

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900" aria-label="Calendar Agenda">
      {!isEmbedded && <Navbar />}
      <div
        className="p-4 md:p-8 max-w-7xl mx-auto space-y-6"
        style={isEmbedded ? undefined : { paddingTop: '5rem' }}
      >
        {/* Aria-live region for screen reader announcements */}
        <div className="sr-only" aria-live="polite" aria-atomic="true"></div>

        {supabaseNotice}

        {unifiedShellEnabled &&
          (consistency?.missingCount > 0 ||
            (consistency?.rpcCount > 0 && consistency?.jobCount === 0)) && (
            <div className="space-y-2">
              {consistency?.rpcCount > 0 && consistency?.jobCount === 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <div>
                        <div className="font-semibold">
                          Calendar items found, but Deals are empty.
                        </div>
                        <div className="text-amber-800">
                          This usually means a tenant or filter mismatch. Try refreshing or review
                          your Deals list filters.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={load}
                        className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/deals')}
                        className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        Open Deals
                      </button>
                    </div>
                  </div>
                </div>
              )}
              {consistency?.missingCount > 0 && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-start gap-2 text-sm">
                      <AlertTriangle className="mt-0.5 h-4 w-4" />
                      <div>
                        <div className="font-semibold">Unlinked appointments detected.</div>
                        <div className="text-amber-800">
                          {consistency.missingCount} scheduled item
                          {consistency.missingCount === 1 ? '' : 's'} could not be linked to a deal.
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={load}
                        className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate('/deals')}
                        className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900 hover:bg-amber-100"
                      >
                        Open Deals
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

        {loadError ? (
          <div
            role="alert"
            className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-amber-900"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-sm">
                <span className="font-medium">Agenda didn’t load.</span>{' '}
                <span className="text-amber-800">{String(loadError)}</span>
              </div>
              <button
                type="button"
                onClick={() => load()}
                className="h-8 rounded-md border border-amber-300 bg-white px-3 text-sm font-medium text-amber-900 hover:bg-amber-100"
              >
                Retry
              </button>
            </div>
          </div>
        ) : null}

        {/* Header with always-visible search and date range */}
        {(!isEmbedded || !hideEmbeddedControls) && (
          <header className="relative z-30 space-y-3" aria-label="Agenda controls">
          {!isEmbedded && <CalendarViewTabs />}
          <div className="flex items-center gap-4 flex-wrap">
            {!isEmbedded && (
              <div className="flex items-baseline gap-3">
                <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Calendar</h1>
                <span className="text-sm font-medium text-gray-500">Agenda</span>
              </div>
            )}
            <label className="sr-only" htmlFor="agenda-search">
              Search appointments
            </label>
            <input
              id="agenda-search"
              name="agenda-search"
              aria-label="Search appointments"
              placeholder="Search"
              className="h-9 w-64 max-w-full rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <label className="sr-only" htmlFor="agenda-date-range">
              Filter by date range
            </label>
            <select
              id="agenda-date-range"
              name="agenda-date-range"
              aria-label="Filter by date range"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value)}
            >
              <option value="all">All Dates</option>
              <option value="today">Today</option>
              <option value="next3days">Next 3 Days</option>
              <option value="next7days">Next 7 Days</option>
            </select>

            <button
              type="button"
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
              aria-label="Show next 3 days"
              onClick={() => {
                setDateRange('next3days')
              }}
              title="Filter to the next 3 days"
            >
              Next 3 Days
            </button>

            {/* Filter toggle button */}
            <button
              onClick={() => setFiltersExpanded((prev) => !prev)}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              aria-expanded={filtersExpanded}
              aria-label={filtersExpanded ? 'Hide filters' : 'Show filters'}
            >
              Filters {filtersExpanded ? '▲' : '▼'}
            </button>
          </div>

          {/* Collapsible filters panel */}
          {filtersExpanded && (
            <div className="flex items-center gap-4 flex-wrap rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
              <label className="sr-only" htmlFor="agenda-status">
                Filter by status
              </label>
              <select
                id="agenda-status"
                name="agenda-status"
                aria-label="Filter by status"
                className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-slate-900/10"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="">All Statuses</option>
                <option value="pending">Booked (time TBD)</option>
                <option value="scheduled">Booked (time set)</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
              </select>
              {/* Note: vendor filter can be added here when vendor list is available */}
            </div>
          )}
        </header>
        )}

        {groups.length === 0 && (
          <div role="status" aria-live="polite">
            No scheduled or promised items in this range.
          </div>
        )}
        {groups.map(([dateKey, rows]) => (
          <section key={dateKey} aria-label={`Appointments for ${dateKey}`} className="space-y-2">
            <div
              className={`sticky z-10 -mx-4 md:-mx-8 px-4 md:px-8 py-2 bg-slate-50/90 backdrop-blur border-b border-slate-200 ${
                isEmbedded ? 'top-16' : 'top-[5rem]'
              }`}
            >
              <h2 className="text-sm font-semibold text-slate-900 tracking-wide">
                {formatAgendaDayHeader(dateKey)}
              </h2>
            </div>
            <ul
              className="divide-y overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
              role="list"
            >
              {rows.map((r) => {
                const focused = r.id === focusId
                const hasConflict = conflicts.get(r.id)
                const raw = r?.raw || r
                const { start, end } = r?.scheduledStart
                  ? { start: r.scheduledStart, end: r.scheduledEnd }
                  : getEffectiveScheduleWindow(raw)
                const timeRange = start ? formatScheduleRange(start, end) : null
                const title = raw?.title || raw?.job_number
                const titleText = title || r.id || 'Appointment'
                const popoverId = showDetailPopovers ? `agenda-popover-${r.id}` : undefined
                const popoverLines = showDetailPopovers
                  ? [
                      timeRange ? `Time: ${timeRange}` : 'Time: All-day',
                      customerName ? `Customer: ${customerName}` : null,
                      vehicleLabel ? `Vehicle: ${vehicleLabel}` : null,
                    ]
                  : []
                const vehicleLabel =
                  r?.vehicleLabel ||
                  `${raw?.vehicle?.make || ''} ${raw?.vehicle?.model || ''} ${raw?.vehicle?.year || ''}`.trim()
                const customerName =
                  r?.customerName || raw?.customer_name || raw?.vehicle?.owner_name || ''
                const stock = raw?.vehicle?.stock_number || ''
                const ops = summarizeOpCodesFromParts(raw?.job_parts, 6)

                const handleRowClick = getAgendaRowClickHandler({
                  dealDrawerEnabled,
                  onOpenDealDrawer,
                  navigate,
                  deal: raw,
                })

                return (
                  <li
                    key={r?.calendarKey || r?.calendar_key || r.id}
                    ref={focused ? focusRef : null}
                    tabIndex={0}
                    aria-label={`Appointment ${titleText}`}
                    aria-describedby={popoverId}
                    className={`group relative grid grid-cols-[7rem_1fr_auto] items-center gap-4 px-4 py-3 text-sm hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${focused ? 'bg-amber-50' : ''}`}
                    onClick={handleRowClick}
                  >
                    {/* Time column (blank for all-day) */}
                    <div className="w-28 text-xs font-mono tabular-nums text-slate-600">
                      {timeRange ? (
                        <span className="truncate" title={timeRange}>
                          {timeRange}
                        </span>
                      ) : (
                        <span className="text-slate-400">All-day</span>
                      )}
                    </div>

                    <div className="min-w-0">
                      <div
                        className={`font-medium flex items-center gap-2 ${showTitleTooltips ? 'min-w-0' : ''}`}
                      >
                        <span
                          className={showTitleTooltips ? 'truncate' : ''}
                          title={showTitleTooltips ? titleText : undefined}
                        >
                          {titleText}
                        </span>
                        {hasConflict && (
                          <span
                            className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800"
                            title="Potential scheduling conflict"
                            aria-label="Potential scheduling conflict"
                          >
                            Conflict
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500 truncate">
                        {[customerName, vehicleLabel, stock ? `Stock ${stock}` : null]
                          .filter(Boolean)
                          .join(' • ')}
                      </div>
                      {ops.tokens.length ? (
                        <div
                          className="mt-1 flex flex-wrap items-center gap-1"
                          aria-label="Products"
                        >
                          {ops.tokens.map((t) => (
                            <span
                              key={t}
                              className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-700"
                              title={t}
                            >
                              {t}
                            </span>
                          ))}
                          {ops.extraCount ? (
                            <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                              +{ops.extraCount}
                            </span>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-end gap-3">
                      <button
                        onClick={(event) => {
                          event?.stopPropagation?.()
                          navigate(`/deals/${r.id}/edit`)
                        }}
                        className="rounded-md px-2 py-1 text-blue-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        aria-label="View deal"
                      >
                        View
                      </button>
                      <button
                        onClick={(event) => {
                          event?.stopPropagation?.()
                          handleReschedule(r)
                        }}
                        className="rounded-md px-2 py-1 text-indigo-700 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white"
                        aria-label="Reschedule appointment"
                      >
                        Reschedule
                      </button>
                      <button
                        onClick={(event) => {
                          event?.stopPropagation?.()
                          return String(r?.job_status || '').toLowerCase() === 'completed'
                            ? handleReopen(r)
                            : handleComplete(r)
                        }}
                        disabled={isStatusInFlight(r?.id)}
                        className={`rounded-md px-2 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/10 focus-visible:ring-offset-2 focus-visible:ring-offset-white ${
                          isStatusInFlight(r?.id)
                            ? 'text-slate-300 cursor-not-allowed'
                            : String(r?.job_status || '').toLowerCase() === 'completed'
                              ? 'text-indigo-700 hover:underline'
                              : 'text-emerald-700 hover:underline'
                        }`}
                        aria-label={
                          String(r?.job_status || '').toLowerCase() === 'completed'
                            ? 'Reopen'
                            : 'Complete'
                        }
                        title={
                          String(r?.job_status || '').toLowerCase() === 'completed'
                            ? 'Reopen deal'
                            : 'Mark completed'
                        }
                      >
                        {String(r?.job_status || '').toLowerCase() === 'completed'
                          ? 'Reopen'
                          : 'Complete'}
                      </button>
                    </div>

                    {showDetailPopovers ? (
                      <EventDetailPopover id={popoverId} title={titleText} lines={popoverLines} />
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </section>
        ))}

        {/* Reschedule Modal */}
        <RescheduleModal
          open={rescheduleModal.open}
          onClose={() =>
            setRescheduleModal({ open: false, job: null, initialStart: null, initialEnd: null })
          }
          onSubmit={handleRescheduleSubmit}
          job={rescheduleModal.job}
          initialStart={rescheduleModal.initialStart}
          initialEnd={rescheduleModal.initialEnd}
        />
      </div>
    </div>
  )
}

export { toDateKey }
