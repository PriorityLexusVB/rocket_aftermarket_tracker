// src/pages/calendar-agenda/index.jsx
// Feature-flagged Simple Agenda view (VITE_SIMPLE_CALENDAR=true)
// Minimal, read-only upcoming appointments list with inline actions: View Deal, Reschedule, Complete
// Does NOT modify legacy calendar components; safe to remove.
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { jobService } from '@/services/jobService'
import { calendarService } from '@/services/calendarService'
import { getNeedsSchedulingPromiseItems, getScheduleItems } from '@/services/scheduleItemsService'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/components/ui/ToastProvider'
import { formatScheduleRange } from '@/utils/dateTimeUtils'
import RescheduleModal from './RescheduleModal'
import SupabaseConfigNotice from '@/components/ui/SupabaseConfigNotice'

const TZ = 'America/New_York'

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
export function applyFilters(
  rows,
  { q, status, dateRange, vendorFilter, assignee, deliveryCoordinatorId, now: nowOverride } = {}
) {
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

    if (assignee === 'me') {
      if (!deliveryCoordinatorId) return false
      const dcId = raw?.delivery_coordinator_id ?? r?.delivery_coordinator_id
      if (dcId !== deliveryCoordinatorId) return false
    }

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

    if (q) {
      const needle = q.toLowerCase()
      const hay = [
        r?.raw?.title ?? r?.title,
        r?.raw?.description ?? r?.description,
        r?.raw?.job_number ?? r?.job_number,
        r?.raw?.vehicle?.owner_name ?? r?.vehicle?.owner_name,
        r?.customerName,
        r?.vehicleLabel,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

export default function CalendarAgenda() {
  const { orgId, session, userProfile, loading: authLoading, profileLoading } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState([])
  const [conflicts, setConflicts] = useState(new Map()) // jobId -> boolean

  const isDeliveryCoordinator = useMemo(() => {
    const dept = String(userProfile?.department || '')
      .trim()
      .toLowerCase()
    return dept === 'delivery coordinator'
  }, [userProfile?.department])

  const authIsLoading = authLoading || profileLoading

  // Initialize filters from URL params, with localStorage fallback
  const [q, setQ] = useState(() => {
    const urlParam = new URLSearchParams(location.search).get('q')
    if (urlParam) return urlParam
    return typeof localStorage !== 'undefined' ? localStorage.getItem('agendaFilter_q') || '' : ''
  })
  const [status, setStatus] = useState(() => {
    const urlParam = new URLSearchParams(location.search).get('status')
    if (urlParam) return urlParam
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('agendaFilter_status') || ''
      : ''
  })
  const [dateRange, setDateRange] = useState(() => {
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

  const [assignee, setAssignee] = useState(() => {
    const urlParam = new URLSearchParams(location.search).get('assignee')
    if (urlParam) return urlParam
    return typeof localStorage !== 'undefined'
      ? localStorage.getItem('agendaFilter_assignee') || ''
      : ''
  })

  // Delivery coordinator view defaults: My items + next 3 days.
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const urlDateRange = params.get('dateRange')
    const urlAssignee = params.get('assignee')

    const storedDateRange =
      typeof localStorage !== 'undefined' ? localStorage.getItem('agendaFilter_dateRange') : null
    const storedAssignee =
      typeof localStorage !== 'undefined' ? localStorage.getItem('agendaFilter_assignee') : null

    if (!isDeliveryCoordinator) return

    if (!urlDateRange && !storedDateRange && (dateRange === 'all' || !dateRange)) {
      setDateRange('next3days')
    }
    if (!urlAssignee && !storedAssignee && !assignee) {
      setAssignee('me')
    }
  }, [location.search, dateRange, assignee, isDeliveryCoordinator])

  // When Supabase env is missing, dev fallback returns empty rows. Make that explicit.
  const supabaseNotice = <SupabaseConfigNotice className="mb-3" />
  const focusId = useMemo(
    () => new URLSearchParams(location.search).get('focus'),
    [location.search]
  )
  const focusRef = useRef(null)

  // Reschedule modal state
  const [rescheduleModal, setRescheduleModal] = useState({
    open: false,
    job: null,
    initialStart: null,
    initialEnd: null,
  })

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

      if (assignee) localStorage.setItem('agendaFilter_assignee', assignee)
      else localStorage.removeItem('agendaFilter_assignee')
    }

    const params = new URLSearchParams(location.search)
    if (q) params.set('q', q)
    else params.delete('q')
    if (status) params.set('status', status)
    else params.delete('status')
    if (dateRange && dateRange !== 'all') params.set('dateRange', dateRange)
    else params.delete('dateRange')
    if (vendorFilter) params.set('vendor', vendorFilter)
    else params.delete('vendor')
    if (assignee) params.set('assignee', assignee)
    else params.delete('assignee')
    if (focusId) params.set('focus', focusId)
    const next = params.toString()
    const current = location.search.replace(/^\?/, '')
    if (next !== current) navigate({ search: next ? `?${next}` : '' }, { replace: true })
  }, [q, status, dateRange, vendorFilter, assignee, focusId, navigate, location.search])

  // If the URL/localStorage pins assignee=me but we're not authenticated, clear it.
  useEffect(() => {
    if (assignee === 'me' && !session?.user?.id) setAssignee('')
  }, [assignee, session?.user?.id])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      if (!orgId) {
        setJobs([])
        setConflicts(new Map())
        setLoading(false)
        return
      }

      const now = new Date()
      const rangeStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      const rangeEnd = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000)

      // Scheduled items (have a schedule window) + promised-only items (no time yet)
      const [scheduledRes, promisedRes] = await Promise.all([
        getScheduleItems({ rangeStart, rangeEnd, orgId }),
        getNeedsSchedulingPromiseItems({ rangeStart, rangeEnd, orgId }),
      ])

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

      setJobs(combined)
    } catch (e) {
      console.warn('[agenda] load failed', e)
      setJobs([])
    }
    setLoading(false)
  }, [orgId])

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
        assignee,
        deliveryCoordinatorId: session?.user?.id || null,
      }),
    [jobs, q, status, dateRange, vendorFilter, assignee, session?.user?.id]
  )
  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach((j) => {
      const promisedKey = j?.raw?.promised_date
        ? String(j.raw.promised_date).slice(0, 10)
        : j?.promisedAt
          ? String(j.promisedAt).slice(0, 10)
          : null

      const key = j?.scheduledStart
        ? toDateKey(j.scheduledStart)
        : promisedKey || toDateKey(getEffectiveScheduleWindow(j?.raw || j)?.start)
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(j)
    })
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
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
      // Update line item schedules using the new service method
      await jobService.updateLineItemSchedules(rescheduleModal.job.id, scheduleData)

      // Show success message
      toast?.success?.('Schedule updated successfully')

      // Close modal and refresh
      setRescheduleModal({ open: false, job: null, initialStart: null, initialEnd: null })
      await load()
    } catch (e) {
      console.error('[agenda] reschedule failed', e)
      toast?.error?.(e?.message || 'Failed to reschedule')
    }
  }

  async function handleComplete(job) {
    const previousStatus = job.job_status
    const previousCompletedAt = job.completed_at
    try {
      await jobService.updateStatus(job.id, 'completed', { completed_at: new Date().toISOString() })

      // Show success with Undo action
      if (toast?.success) {
        const undo = async () => {
          try {
            await jobService.updateStatus(job.id, previousStatus || 'scheduled', {
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
          message: 'Marked completed',
          action: { label: 'Undo', onClick: undo },
          duration: 10000,
        })
      }

      await load()
    } catch (err) {
      console.error('[agenda] complete failed', err)
      toast?.error?.('Complete failed')
    }
  }

  if (authIsLoading) return <div className="p-4">Loading agenda…</div>

  if (loading) return <div className="p-4">Loading agenda…</div>

  return (
    <div className="p-4 space-y-4" aria-label="Scheduled Appointments Agenda">
      {/* Aria-live region for screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true"></div>

      {supabaseNotice}

      {/* Header with always-visible search and date range */}
      <header className="space-y-3" aria-label="Agenda controls">
        <div className="flex items-center gap-4 flex-wrap">
          <h1 className="text-xl font-semibold">Appointments</h1>
          <input
            aria-label="Search appointments"
            placeholder="Search"
            className="border rounded px-2 py-1"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select
            aria-label="Filter by date range"
            className="border rounded px-2 py-1"
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
            className="px-3 py-1 border rounded bg-white hover:bg-gray-50 text-sm font-medium"
            aria-label="Show my next 3 days"
            onClick={() => {
              setAssignee('me')
              setDateRange('next3days')
            }}
            disabled={!session?.user?.id}
            title={session?.user?.id ? 'Filter to your upcoming items' : 'Sign in to use this'}
          >
            My Next 3 Days
          </button>

          {/* Filter toggle button */}
          <button
            onClick={() => setFiltersExpanded((prev) => !prev)}
            className="px-3 py-1 border rounded bg-white hover:bg-gray-50 text-sm font-medium"
            aria-expanded={filtersExpanded}
            aria-label={filtersExpanded ? 'Hide filters' : 'Show filters'}
          >
            Filters {filtersExpanded ? '▲' : '▼'}
          </button>
        </div>

        {/* Collapsible filters panel */}
        {filtersExpanded && (
          <div className="flex items-center gap-4 flex-wrap p-3 bg-gray-50 rounded border">
            <select
              aria-label="Filter by assignment"
              className="border rounded px-2 py-1 bg-white"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              disabled={!session?.user?.id}
              title={session?.user?.id ? '' : 'Sign in to filter by assignment'}
            >
              <option value="">All Assignments</option>
              <option value="me">My Items</option>
            </select>
            <select
              aria-label="Filter by status"
              className="border rounded px-2 py-1 bg-white"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="scheduled">Scheduled</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            {/* Note: vendor filter can be added here when vendor list is available */}
          </div>
        )}
      </header>

      {groups.length === 0 && (
        <div role="status" aria-live="polite">
          No scheduled or promised items in this range.
        </div>
      )}
      {groups.map(([dateKey, rows]) => (
        <section key={dateKey} aria-label={`Appointments for ${dateKey}`} className="space-y-2">
          <h2 className="text-sm font-medium text-gray-600 mt-6">{dateKey}</h2>
          <ul className="divide-y rounded border bg-white" role="list">
            {rows.map((r) => {
              const focused = r.id === focusId
              const hasConflict = conflicts.get(r.id)
              const raw = r?.raw || r
              const { start, end } = r?.scheduledStart
                ? { start: r.scheduledStart, end: r.scheduledEnd }
                : getEffectiveScheduleWindow(raw)
              const timeRange = start ? formatScheduleRange(start, end) : null
              const title = raw?.title || raw?.job_number
              const vehicleLabel =
                r?.vehicleLabel ||
                `${raw?.vehicle?.make || ''} ${raw?.vehicle?.model || ''} ${raw?.vehicle?.year || ''}`.trim()

              const promisedLabel = !start && (r?.promisedAt || raw?.promised_date)
              const promisedText = promisedLabel
                ? `All-day (Time TBD) • ${(r?.promisedAt || raw?.promised_date || '').toString().slice(0, 10)}`
                : null

              return (
                <li
                  key={r.id}
                  ref={focused ? focusRef : null}
                  tabIndex={0}
                  aria-label={`Appointment ${title || r.id}`}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${focused ? 'bg-yellow-50' : ''}`}
                >
                  <div className="flex-1">
                    <div className="font-medium truncate flex items-center gap-2">
                      {title}
                      {hasConflict && (
                        <span
                          className="text-yellow-600"
                          title="Potential scheduling conflict"
                          aria-label="Potential scheduling conflict"
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                    {timeRange && (
                      <div className="text-xs text-gray-600 font-mono truncate">{timeRange}</div>
                    )}
                    <div className="text-xs text-gray-500 truncate">{vehicleLabel}</div>
                    {promisedText && (
                      <div className="text-xs text-gray-500 truncate">{promisedText}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-auto">
                    <button
                      onClick={() => navigate(`/deals/${r.id}/edit`)}
                      className="text-blue-600 hover:underline"
                      aria-label="View deal"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleReschedule(r)}
                      className="text-indigo-600 hover:underline"
                      aria-label="Reschedule appointment"
                    >
                      Reschedule
                    </button>
                    <button
                      onClick={() => handleComplete(r)}
                      className="text-green-600 hover:underline"
                      aria-label="Mark appointment complete"
                    >
                      Complete
                    </button>
                  </div>
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
  )
}

export { toDateKey }
