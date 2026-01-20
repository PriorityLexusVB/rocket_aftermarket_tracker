// src/pages/currently-active-appointments/components/SnapshotView.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSearchParams } from 'react-router-dom'
import useTenant from '@/hooks/useTenant'
import { useToast } from '@/components/ui/ToastProvider'
import SupabaseConfigNotice from '@/components/ui/SupabaseConfigNotice'
import { createUndoEntry, canUndo } from './undoHelpers'
import { formatTime } from '@/utils/dateTimeUtils'
import { getEtDayUtcMs, toSafeDateForTimeZone } from '@/utils/scheduleDisplay'
import { getStatusBadge } from '@/lib/time'
import {
  getScheduleItems,
  classifyScheduleState,
  getUnscheduledInProgressInHouseItems,
  getNeedsSchedulingPromiseItems,
} from '@/services/scheduleItemsService'

const SIMPLE_CAL_ON = String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

const MS_DAY = 24 * 60 * 60 * 1000

function addDays(d, days) {
  const base = d instanceof Date ? d : new Date(d)
  return new Date(base.getTime() + days * MS_DAY)
}

function startOfDay(d) {
  const base = d instanceof Date ? d : new Date(d)
  const out = new Date(base)
  out.setHours(0, 0, 0, 0)
  return out
}

function formatPromiseLabel(d) {
  const dt = safeDate(d)
  if (!dt) return '—'
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(dt)
}

function safeDate(input) {
  if (input === null || input === undefined) return null
  return toSafeDateForTimeZone(input)
}

// Exported to allow unit testing
export function filterAndSort(jobs) {
  const rows = Array.isArray(jobs) ? jobs : []
  const filtered = rows.filter((j) => {
    if (!(j?.job_status === 'scheduled' || j?.job_status === 'in_progress')) return false
    const promised = j?.next_promised_iso || j?.promised_date || j?.promisedAt || null
    return !!(j?.scheduled_start_time || promised)
  })

  const effectiveDayMs = (j) => {
    const start = safeDate(j?.scheduled_start_time)
    const promised = safeDate(j?.next_promised_iso || j?.promised_date || j?.promisedAt)
    const base = start || promised
    if (!base) return null
    return Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate())
  }

  const effectiveTimeMs = (j) => {
    const start = safeDate(j?.scheduled_start_time)
    return start ? start.getTime() : Number.POSITIVE_INFINITY
  }

  filtered.sort((a, b) => {
    const aDay = effectiveDayMs(a) ?? 0
    const bDay = effectiveDayMs(b) ?? 0
    if (aDay !== bDay) return aDay - bDay

    const aTime = effectiveTimeMs(a)
    const bTime = effectiveTimeMs(b)
    if (aTime !== bTime) return aTime - bTime

    return 0
  })

  return filtered
}

// Exported to allow unit testing
export function splitSnapshotItems(items, { now = new Date() } = {}) {
  const list = Array.isArray(items) ? items : []
  const nowDate = safeDate(now) || new Date()

  const upcoming = []
  const overdueRecent = []
  const overdueOld = []
  const unscheduledInProgress = []

  for (const it of list) {
    const start = safeDate(it?.scheduledStart)
    const promised = safeDate(it?.promisedAt)

    const state =
      it?.scheduleState ||
      classifyScheduleState({
        scheduledStart: it?.scheduledStart,
        scheduledEnd: it?.scheduledEnd,
        promisedAt: it?.promisedAt,
        jobStatus: it?.raw?.job_status,
        now: nowDate,
      })

    // Controlled unscheduled bucket (operations snapshot):
    // Include only in-house/on-site jobs that are actively in progress but have no schedule window.
    if (!start && state === 'unscheduled') {
      const status = String(it?.raw?.job_status || '').toLowerCase()
      const svc = String(it?.raw?.service_type || '').toLowerCase()
      const isInHouse =
        it?.locationType === 'In-House' ||
        svc === 'onsite' ||
        svc === 'in_house' ||
        svc === 'inhouse'

      if (isInHouse && (status === 'in_progress' || status === 'quality_check')) {
        unscheduledInProgress.push(it)
      }
      continue
    }

    // Effective schedule date: scheduled time if present else promised day.
    const effectiveMs = (() => {
      if (start) return start.getTime()
      if (!promised) return null
      return Date.UTC(promised.getUTCFullYear(), promised.getUTCMonth(), promised.getUTCDate())
    })()
    if (!effectiveMs) continue

    if (state === 'scheduled' || state === 'scheduled_no_time' || state === 'in_progress') {
      upcoming.push(it)
    } else if (state === 'overdue_recent') overdueRecent.push(it)
    else if (state === 'overdue_old') overdueOld.push(it)
  }

  const sortByEffective = (a, b) => {
    const aStart = safeDate(a?.scheduledStart)
    const bStart = safeDate(b?.scheduledStart)
    const aProm = safeDate(a?.promisedAt)
    const bProm = safeDate(b?.promisedAt)

    const aBase = aStart || aProm
    const bBase = bStart || bProm
    const aDay = aBase
      ? Date.UTC(aBase.getUTCFullYear(), aBase.getUTCMonth(), aBase.getUTCDate())
      : 0
    const bDay = bBase
      ? Date.UTC(bBase.getUTCFullYear(), bBase.getUTCMonth(), bBase.getUTCDate())
      : 0

    if (aDay !== bDay) return aDay - bDay

    const aTime = aStart ? aStart.getTime() : Number.POSITIVE_INFINITY
    const bTime = bStart ? bStart.getTime() : Number.POSITIVE_INFINITY
    if (aTime !== bTime) return aTime - bTime

    return 0
  }

  upcoming.sort(sortByEffective)
  overdueRecent.sort(sortByEffective)
  overdueOld.sort(sortByEffective)

  return { upcoming, overdueRecent, overdueOld, unscheduledInProgress }
}

// Exported to allow unit testing
export function splitNeedsSchedulingItems(items, { now = new Date() } = {}) {
  const list = Array.isArray(items) ? items : []
  const nowDayUtcMs =
    getEtDayUtcMs(now) ?? Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const overdue = []
  const upcoming = []

  for (const it of list) {
    const p = safeDate(it?.promisedAt || it?.raw?.next_promised_iso || it?.raw?.promised_date)
    if (!p) continue
    const pDayUtcMs =
      getEtDayUtcMs(p) ?? Date.UTC(p.getUTCFullYear(), p.getUTCMonth(), p.getUTCDate())
    if (pDayUtcMs < nowDayUtcMs) overdue.push(it)
    else upcoming.push(it)
  }

  const sortByPromise = (a, b) => {
    const aMs = safeDate(a?.promisedAt)?.getTime() || 0
    const bMs = safeDate(b?.promisedAt)?.getTime() || 0
    return aMs - bMs
  }

  overdue.sort(sortByPromise)
  upcoming.sort(sortByPromise)

  return { overdue, upcoming }
}

// Exported to allow unit testing: detect overlapping appointments per vendor
// Returns a Set of job ids that have a local overlap with at least one other job for the same vendor
export function detectConflicts(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return new Set()

  // Group jobs by vendor id (fallback to null for unassigned)
  const byVendor = new Map()
  for (const j of rows) {
    const vId = j?.vendor?.id ?? j?.vendor_id ?? j?.vendorId ?? null
    if (!byVendor.has(vId)) byVendor.set(vId, [])
    byVendor.get(vId).push(j)
  }

  const conflictIds = new Set()
  for (const [, jobs] of byVendor) {
    // Only consider jobs that have both start/end for overlap detection
    const withTimes = jobs
      .map((j) => ({
        id: j.id,
        start: j?.scheduledStart ?? j?.scheduled_start_time,
        end: j?.scheduledEnd ?? j?.scheduled_end_time,
      }))
      .filter((j) => j?.start && j?.end)
      .map((j) => ({
        id: j.id,
        start: new Date(j.start).getTime(),
        end: new Date(j.end).getTime(),
      }))
      .sort((a, b) => a.start - b.start)

    // Sweep-line style check for overlaps
    for (let i = 0; i < withTimes.length; i++) {
      for (let k = i + 1; k < withTimes.length; k++) {
        const a = withTimes[i]
        const b = withTimes[k]
        if (b.start >= a.end) break // no overlap onward for this i
        // Overlap
        conflictIds.add(a.id)
        conflictIds.add(b.id)
      }
    }
  }

  return conflictIds
}

// Undo helpers moved to './undoHelpers'

export default function SnapshotView() {
  const { orgId, loading: tenantLoading } = useTenant()
  const toast = useToast?.()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [undoMap, setUndoMap] = useState(new Map()) // id -> { prevStatus, timeoutId }
  const [statusMessage, setStatusMessage] = useState('') // For aria-live announcements
  const [showOlderOverdue, setShowOlderOverdue] = useState(false)
  const [sourceDebug, setSourceDebug] = useState(null)
  const [windowMode, setWindowMode] = useState('next7') // 'today' | 'next7' | 'all_day'

  const effectiveStatusForBadge = useCallback((item) => {
    const rawStatus = String(item?.raw?.job_status || item?.raw?.status || '').toLowerCase()

    // In scheduling UIs, a promised day without a time window is treated as scheduled (all-day).
    // Avoid showing confusing "Pending" badges for these rows.
    const promised = item?.promisedAt || item?.raw?.next_promised_iso || item?.raw?.promised_date
    const hasTime = !!(item?.scheduledStart || item?.scheduledEnd)
    const isAllDayScheduled = !hasTime && !!promised

    if (isAllDayScheduled && (rawStatus === 'pending' || rawStatus === 'new' || rawStatus === '')) {
      return 'scheduled'
    }

    return rawStatus || 'scheduled'
  }, [])

  const now = useMemo(() => new Date(), [])

  const split = useMemo(() => splitSnapshotItems(items, { now }), [items, now])
  const needsSplit = useMemo(() => splitNeedsSchedulingItems(items, { now }), [items, now])

  const groupedUpcoming = useMemo(() => {
    const scheduled = []
    const inProgress = []

    for (const it of split.upcoming) {
      const state =
        it?.scheduleState ||
        classifyScheduleState({
          scheduledStart: it?.scheduledStart,
          scheduledEnd: it?.scheduledEnd,
          promisedAt: it?.promisedAt,
          jobStatus: it?.raw?.job_status,
          now,
        })

      if (state === 'in_progress') inProgress.push(it)
      else scheduled.push(it)
    }

    return { scheduled, inProgress }
  }, [now, split.upcoming])
  const rows = useMemo(() => {
    const merged = [...split.upcoming, ...split.overdueRecent]
    if (showOlderOverdue) merged.push(...split.overdueOld)
    return merged
  }, [showOlderOverdue, split.overdueOld, split.overdueRecent, split.upcoming])

  const conflictIds = useMemo(() => detectConflicts(rows), [rows])

  const load = useCallback(async () => {
    if (!orgId) {
      setItems([])
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const nowDate = new Date()

      if (windowMode === 'all_day') {
        const start = addDays(nowDate, -365)
        const end = addDays(nowDate, 7)
        const res = await getNeedsSchedulingPromiseItems({
          orgId,
          rangeStart: start,
          rangeEnd: end,
        })

        if (import.meta.env.DEV) {
          // More reliable than the "Source Debug" UI line (which can be truncated in a11y snapshots)
          console.log('[Snapshot all_day debug]', res?.debug || null)
        }
        setItems(res.items || [])

        if (import.meta.env.DEV) {
          const allItems = Array.isArray(res.items) ? res.items : []
          const countBy = (arr, keyFn) =>
            (arr || []).reduce((acc, it) => {
              const k = keyFn(it)
              if (!k) return acc
              acc[k] = (acc[k] || 0) + 1
              return acc
            }, {})

          const scheduleStateCounts = countBy(allItems, (it) => String(it?.scheduleState || ''))
          const scheduleSourceCounts = countBy(allItems, (it) => String(it?.scheduleSource || ''))

          setSourceDebug({
            needsScheduling: res.debug || null,
            scheduleState: {
              scheduled: scheduleStateCounts?.scheduled || 0,
              scheduled_no_time: scheduleStateCounts?.scheduled_no_time || 0,
              in_progress: scheduleStateCounts?.in_progress || 0,
              overdue_recent: scheduleStateCounts?.overdue_recent || 0,
              overdue_old: scheduleStateCounts?.overdue_old || 0,
              unscheduled: scheduleStateCounts?.unscheduled || 0,
            },
            scheduleSource: {
              needs_scheduling_promise: scheduleSourceCounts?.needs_scheduling_promise || 0,
              job_parts: scheduleSourceCounts?.job_parts || 0,
              job: scheduleSourceCounts?.job || 0,
              legacy_appt: scheduleSourceCounts?.legacy_appt || 0,
              none: scheduleSourceCounts?.none || 0,
            },
            effectiveFilters: {
              window: windowMode,
              org_id: orgId,
              vendor: 'all',
            },
          })
        } else {
          setSourceDebug(null)
        }

        return
      }

      const windowStart = windowMode === 'today' ? startOfDay(nowDate) : nowDate
      const windowEnd =
        windowMode === 'today' ? addDays(startOfDay(nowDate), 1) : addDays(nowDate, 7)

      // Default “Active” = next 7 days scheduled + in progress
      const upcomingRes = await getScheduleItems({
        rangeStart: windowStart,
        rangeEnd: windowEnd,
        orgId,
      })

      // Overdue: last 7 days visible; older overdue collapsed.
      // Fetch a wider overdue window so we can compute the older bucket.
      const overdueRes = await getScheduleItems({
        rangeStart: addDays(nowDate, -365),
        rangeEnd: nowDate,
        orgId,
      })

      // Controlled unscheduled bucket: in-house/on-site in_progress / quality_check with no schedule window.
      const unscheduledRes = await getUnscheduledInProgressInHouseItems({ orgId })
      const unscheduledItems = Array.isArray(unscheduledRes?.items) ? unscheduledRes.items : []

      // Date-only scheduled (promised day with no time) should still appear in Up Next.
      const dateOnlyRes = await getNeedsSchedulingPromiseItems({
        rangeStart: windowStart,
        rangeEnd: windowEnd,
        orgId,
      })
      const dateOnlyItems = Array.isArray(dateOnlyRes?.items) ? dateOnlyRes.items : []

      const combined = [...(upcomingRes.items || []), ...(overdueRes.items || [])]

      const itemKey = (it) => {
        if (!it) return null
        return (
          it?.calendarKey ||
          it?.calendar_key ||
          (it?.id && it?.promisedAt && it?.scheduleSource === 'needs_scheduling_promise'
            ? `${it.id}::promise::${String(it.promisedAt).slice(0, 10)}`
            : it?.id) ||
          null
        )
      }

      // De-dupe scheduled items by id (upcoming and overdue windows can overlap at boundary).
      // Promise-only items are allowed to appear multiple times via calendarKey.
      const byKey = new Map()
      for (const it of combined) {
        const k = it?.id ? String(it.id) : null
        if (k) byKey.set(k, it)
      }

      // Source totals split: scheduled-RPC vs unscheduled-query
      const scheduledRpcUnique = byKey.size

      // Add date-only items. Skip in_progress/quality_check here to avoid duplicates with the
      // dedicated unscheduled in-progress bucket.
      for (const it of dateOnlyItems) {
        const status = String(it?.raw?.job_status || it?.raw?.status || '').toLowerCase()
        if (status === 'in_progress' || status === 'quality_check') continue

        const k = itemKey(it)
        if (k && !byKey.has(k)) byKey.set(k, it)
      }

      // Add controlled unscheduled bucket (job-level uniqueness by id).
      for (const it of unscheduledItems) {
        const k = it?.id ? String(it.id) : null
        if (k && !byKey.has(k)) byKey.set(k, it)
      }

      setItems(Array.from(byKey.values()))

      if (import.meta.env.DEV) {
        const allItems = Array.from(byKey.values())
        const countBy = (arr, keyFn) =>
          (arr || []).reduce((acc, it) => {
            const k = keyFn(it)
            if (!k) return acc
            acc[k] = (acc[k] || 0) + 1
            return acc
          }, {})

        const scheduleStateCounts = countBy(allItems, (it) => String(it?.scheduleState || ''))
        const scheduleSourceCounts = countBy(allItems, (it) => String(it?.scheduleSource || ''))

        const unscheduledQuery = unscheduledItems.length

        setSourceDebug({
          upcoming: upcomingRes.debug || null,
          dateOnly: dateOnlyRes?.debug || null,
          overdue: overdueRes.debug || null,
          totals: {
            upcomingItems: (upcomingRes.items || []).length,
            dateOnlyItems: dateOnlyItems.length,
            overdueItems: (overdueRes.items || []).length,
            combinedUnique: byKey.size,
            scheduledRpcUnique,
            unscheduledQuery,
          },
          counts: {
            scheduleState: {
              scheduled: scheduleStateCounts?.scheduled || 0,
              scheduled_no_time: scheduleStateCounts?.scheduled_no_time || 0,
              in_progress: scheduleStateCounts?.in_progress || 0,
              overdue_recent: scheduleStateCounts?.overdue_recent || 0,
              overdue_old: scheduleStateCounts?.overdue_old || 0,
              unscheduled: scheduleStateCounts?.unscheduled || 0,
            },
            scheduleSource: {
              job_parts: scheduleSourceCounts?.job_parts || 0,
              job: scheduleSourceCounts?.job || 0,
              legacy_appt: scheduleSourceCounts?.legacy_appt || 0,
              needs_scheduling_promise: scheduleSourceCounts?.needs_scheduling_promise || 0,
              none: scheduleSourceCounts?.none || 0,
            },
          },
          effectiveFilters: {
            window: windowMode,
            org_id: orgId,
            vendor: 'all',
          },
        })
      } else {
        setSourceDebug(null)
      }
    } catch (e) {
      console.warn('[SnapshotView] load failed', e)
      setItems([])
      setSourceDebug(null)
    } finally {
      setLoading(false)
    }
  }, [orgId, windowMode])

  useEffect(() => {
    const mode = String(searchParams?.get?.('window') || '')
    const normalized = mode === 'needs_scheduling' ? 'all_day' : mode
    if (normalized === 'all_day' && windowMode !== 'all_day') {
      setWindowMode('all_day')
      return
    }
  }, [searchParams, windowMode])

  useEffect(() => {
    if (tenantLoading) return
    load()
  }, [load, tenantLoading])

  async function handleComplete(job) {
    const prevStatus = job?.raw?.job_status || 'scheduled'
    const jobTitle = job?.raw?.title || job?.raw?.job_number || 'Appointment'
    try {
      // Use the existing jobService updateStatus path via raw id.
      const { jobService } = await import('@/services/jobService')
      await jobService.updateStatus(job.id, 'completed', { completed_at: new Date().toISOString() })
      const message = `Marked "${jobTitle}" as done`
      toast?.success?.(message)
      setStatusMessage(message) // For screen readers
      await load()

      // set undo window (10s)
      const tId = setTimeout(() => {
        setUndoMap((m) => {
          const copy = new Map(m)
          copy.delete(job.id)
          return copy
        })
      }, 10000)
      setUndoMap((m) => {
        const copy = new Map(m)
        copy.set(job.id, createUndoEntry(job.id, prevStatus, tId))
        return copy
      })
    } catch (e) {
      console.warn('[SnapshotView] complete failed', e)
      const errorMsg = 'Could not mark done'
      toast?.error?.(errorMsg)
      setStatusMessage(errorMsg)
    }
  }

  async function handleUndo(jobId) {
    const meta = undoMap.get(jobId)
    if (!meta) return
    clearTimeout(meta.timeoutId)
    try {
      const { jobService } = await import('@/services/jobService')
      await jobService.updateStatus(jobId, meta.prevStatus, { completed_at: null })
      const message = 'Restored status'
      toast?.success?.(message)
      setStatusMessage(message)
    } catch (e) {
      console.warn('[SnapshotView] undo failed', e)
      const errorMsg = 'Undo failed'
      toast?.error?.(errorMsg)
      setStatusMessage(errorMsg)
    } finally {
      setUndoMap((m) => {
        const copy = new Map(m)
        copy.delete(jobId)
        return copy
      })
      await load()
    }
  }

  if (loading) return <div className="p-6">Loading…</div>

  return (
    <div className="p-6 space-y-4" aria-label="Active Appointments Snapshot">
      {/* Accessible status announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true" role="status">
        {statusMessage}
      </div>

      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Active Appointments (Snapshot)</h1>
          <div className="text-xs text-muted-foreground">
            Operations view: scheduled + controlled unscheduled
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div
            className="inline-flex rounded-md border border-border bg-card overflow-hidden"
            role="group"
            aria-label="Snapshot mode toggle"
          >
            <button
              type="button"
              onClick={() => {
                setWindowMode('today')
                const next = new URLSearchParams(searchParams)
                next.delete('window')
                setSearchParams(next, { replace: true })
              }}
              className={
                windowMode === 'today'
                  ? 'px-3 py-1.5 text-sm font-medium btn-primary'
                  : 'px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-gray-50'
              }
              aria-pressed={windowMode === 'today'}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => {
                setWindowMode('next7')
                const next = new URLSearchParams(searchParams)
                next.delete('window')
                setSearchParams(next, { replace: true })
              }}
              className={
                windowMode === 'next7'
                  ? 'px-3 py-1.5 text-sm font-medium btn-primary'
                  : 'px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-gray-50'
              }
              aria-pressed={windowMode === 'next7'}
            >
              Next 7 Days
            </button>
            <button
              type="button"
              onClick={() => {
                setWindowMode('all_day')
                const next = new URLSearchParams(searchParams)
                next.set('window', 'all_day')
                setSearchParams(next, { replace: true })
              }}
              className={
                windowMode === 'all_day'
                  ? 'px-3 py-1.5 text-sm font-medium btn-primary'
                  : 'px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-gray-50'
              }
              aria-pressed={windowMode === 'all_day'}
            >
              Scheduled (All-day)
            </button>
          </div>

          {SIMPLE_CAL_ON && (
            <button
              onClick={() => navigate('/calendar/agenda')}
              className="text-blue-600 hover:underline"
              aria-label="Open Agenda"
            >
              Open Agenda
            </button>
          )}
        </div>
      </header>

      {import.meta.env.DEV && sourceDebug ? (
        <div className="text-[11px] text-muted-foreground" aria-label="Source Debug">
          DEV • window:{sourceDebug?.effectiveFilters?.window} • org:
          {sourceDebug?.effectiveFilters?.org_id} • vendor:
          {sourceDebug?.effectiveFilters?.vendor}
          {sourceDebug?.effectiveFilters?.window === 'all_day'
            ? ` • needs:${JSON.stringify(sourceDebug?.needsScheduling || null)}`
            : ''}
          • scheduled-RPC:{sourceDebug?.totals?.scheduledRpcUnique ?? 0} • unscheduled:
          {sourceDebug?.totals?.unscheduledQuery ?? 0} • state:
          {JSON.stringify(sourceDebug?.counts?.scheduleState || {})} • source:
          {JSON.stringify(sourceDebug?.counts?.scheduleSource || {})}
        </div>
      ) : null}

      {import.meta.env.DEV && sourceDebug?.effectiveFilters?.window === 'all_day' ? (
        <div className="text-[11px] text-muted-foreground" aria-label="All-day Debug">
          needs:{JSON.stringify(sourceDebug?.needsScheduling || null)}
        </div>
      ) : null}

      <SupabaseConfigNotice />

      {windowMode !== 'all_day' &&
      split.upcoming.length === 0 &&
      split.overdueRecent.length === 0 &&
      split.overdueOld.length === 0 &&
      split.unscheduledInProgress.length === 0 ? (
        <div role="status" aria-live="polite" className="text-muted-foreground">
          No appointments in this range.
        </div>
      ) : null}

      {windowMode === 'all_day' &&
      needsSplit.overdue.length === 0 &&
      needsSplit.upcoming.length === 0 ? (
        <div role="status" aria-live="polite" className="text-muted-foreground">
          No all-day items in this range.
        </div>
      ) : null}

      {windowMode === 'all_day' && needsSplit.overdue.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <div className="text-foreground font-medium">Overdue (All-day)</div>
          <div className="text-xs text-muted-foreground">Promised day passed</div>
        </div>
      ) : null}

      {windowMode === 'all_day' && needsSplit.overdue.length > 0 ? (
        <ul role="list" className="divide-y rounded-lg border border-border bg-card">
          {needsSplit.overdue.map((j) => {
            const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
            const vendorName = j?.vendorName || 'On-site'
            const customer = j?.customerName || vehicle?.owner_name || ''
            const status = effectiveStatusForBadge(j)
            const statusBadge = getStatusBadge(status)
            const promiseLabel = formatPromiseLabel(j?.promisedAt)
            const hasLoaner = !!(
              j?.raw?.has_active_loaner ||
              j?.raw?.loaner_id ||
              j?.raw?.customer_needs_loaner
            )
            return (
              <li
                key={j?.calendarKey || j?.calendar_key || j.id}
                className="flex flex-col gap-2 px-3 py-2 text-sm hover:bg-gray-50 sm:flex-row sm:items-center sm:gap-3"
                aria-label={`All-day ${j?.raw?.title || j?.raw?.job_number || j?.id}`}
              >
                <div className="w-full flex items-center gap-2 text-xs text-muted-foreground sm:w-28">
                  <span>{promiseLabel}</span>
                  <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[11px] font-medium">
                    Overdue
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-foreground">
                    {j?.raw?.title || j?.raw?.job_number}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {customer ? `${customer} • ` : ''}
                    {vehicle
                      ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                      : ''}
                  </div>
                </div>
                <div className="w-full truncate text-muted-foreground sm:w-40">{vendorName}</div>
                <div className="w-full sm:w-28">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge?.bg || 'bg-gray-100'} ${statusBadge?.textColor || 'text-gray-800'}`}
                  >
                    {statusBadge?.label || status}
                  </span>
                </div>
                {hasLoaner ? (
                  <div className="w-full sm:w-20">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-800">
                      Loaner
                    </span>
                  </div>
                ) : (
                  <div className="hidden sm:block sm:w-20" />
                )}
                <div className="flex items-center gap-2 sm:ml-auto">
                  <button
                    onClick={() => navigate(`/deals/${j.id}/edit`)}
                    className="text-blue-600 hover:underline"
                    aria-label="View deal"
                  >
                    View
                  </button>
                  {SIMPLE_CAL_ON && (
                    <button
                      onClick={() => navigate(`/calendar/agenda?focus=${encodeURIComponent(j.id)}`)}
                      className="text-blue-600 hover:underline"
                      aria-label="Schedule in Agenda"
                    >
                      Schedule
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {windowMode === 'all_day' && needsSplit.upcoming.length > 0 ? (
        <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <div className="text-foreground font-medium">Upcoming (All-day)</div>
          <div className="text-xs text-muted-foreground">Promised day in range</div>
        </div>
      ) : null}

      {windowMode === 'all_day' && needsSplit.upcoming.length > 0 ? (
        <ul role="list" className="divide-y rounded-lg border border-border bg-card">
          {needsSplit.upcoming.map((j) => {
            const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
            const vendorName = j?.vendorName || 'On-site'
            const customer = j?.customerName || vehicle?.owner_name || ''
            const status = effectiveStatusForBadge(j)
            const statusBadge = getStatusBadge(status)
            const promiseLabel = formatPromiseLabel(j?.promisedAt)
            const hasLoaner = !!(
              j?.raw?.has_active_loaner ||
              j?.raw?.loaner_id ||
              j?.raw?.customer_needs_loaner
            )
            return (
              <li
                key={j?.calendarKey || j?.calendar_key || j.id}
                className="flex flex-col gap-2 px-3 py-2 text-sm hover:bg-gray-50 sm:flex-row sm:items-center sm:gap-3"
                aria-label={`All-day ${j?.raw?.title || j?.raw?.job_number || j?.id}`}
              >
                <div className="w-full flex items-center gap-1 text-xs text-muted-foreground sm:w-28">
                  <span>{promiseLabel}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate text-foreground">
                    {j?.raw?.title || j?.raw?.job_number}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {customer ? `${customer} • ` : ''}
                    {vehicle
                      ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                      : ''}
                  </div>
                </div>
                <div className="w-full truncate text-muted-foreground sm:w-40">{vendorName}</div>
                <div className="w-full sm:w-28">
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge?.bg || 'bg-gray-100'} ${statusBadge?.textColor || 'text-gray-800'}`}
                  >
                    {statusBadge?.label || status}
                  </span>
                </div>
                {hasLoaner ? (
                  <div className="w-full sm:w-20">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-800">
                      Loaner
                    </span>
                  </div>
                ) : (
                  <div className="hidden sm:block sm:w-20" />
                )}
                <div className="flex items-center gap-2 sm:ml-auto">
                  <button
                    onClick={() => navigate(`/deals/${j.id}/edit`)}
                    className="text-blue-600 hover:underline"
                    aria-label="View deal"
                  >
                    View
                  </button>
                  {SIMPLE_CAL_ON && (
                    <button
                      onClick={() => navigate(`/calendar/agenda?focus=${encodeURIComponent(j.id)}`)}
                      className="text-blue-600 hover:underline"
                      aria-label="Schedule in Agenda"
                    >
                      Schedule
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}

      {windowMode === 'all_day' ? null : (
        <>
          {split.overdueOld.length > 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="text-muted-foreground">Overdue Old</div>
              <button
                type="button"
                onClick={() => setShowOlderOverdue((v) => !v)}
                className="text-blue-600 hover:underline"
                aria-label={
                  showOlderOverdue
                    ? 'Hide older overdue'
                    : `Show older overdue (${split.overdueOld.length})`
                }
              >
                {showOlderOverdue
                  ? 'Hide older overdue'
                  : `Show older overdue (${split.overdueOld.length})`}
              </button>
            </div>
          ) : null}

          {groupedUpcoming.scheduled.length > 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="text-foreground font-medium">Scheduled</div>
              <div className="text-xs text-muted-foreground">Next window</div>
            </div>
          ) : null}

          {groupedUpcoming.scheduled.length > 0 ? (
            <ul role="list" className="divide-y rounded-lg border border-border bg-card">
              {groupedUpcoming.scheduled.map((j) => {
                const hasTime = !!j?.scheduledStart
                const start = hasTime ? formatTime(j.scheduledStart) : null
                const end = hasTime ? formatTime(j.scheduledEnd) : null
                const promiseLabel = !hasTime ? formatPromiseLabel(j?.promisedAt) : null
                const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
                const vendorName = j?.vendorName || 'On-site'
                const customer = j?.customerName || vehicle?.owner_name || ''
                const status = effectiveStatusForBadge(j)
                const statusBadge = getStatusBadge(status)
                const hasLoaner = !!(
                  j?.raw?.has_active_loaner ||
                  j?.raw?.loaner_id ||
                  j?.raw?.customer_needs_loaner
                )
                return (
                  <li
                    key={j?.calendarKey || j?.calendar_key || j.id}
                    className="flex flex-col gap-2 px-3 py-2 text-sm hover:bg-gray-50 sm:flex-row sm:items-center sm:gap-3"
                    aria-label={`Appointment ${j?.raw?.title || j?.raw?.job_number || j?.id}`}
                  >
                    <div className="w-full flex items-center gap-1 text-xs text-muted-foreground sm:w-28">
                      <span>
                        {hasTime ? (
                          <>
                            {start}
                            {end ? ` – ${end}` : ''}
                          </>
                        ) : (
                          <>All day{promiseLabel ? ` • ${promiseLabel}` : ''}</>
                        )}
                      </span>
                      {conflictIds.has(j.id) && (
                        <span
                          className="text-amber-600"
                          title="Potential scheduling overlap for this vendor"
                          aria-label="Scheduling conflict detected"
                          role="img"
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-foreground">
                        {j?.raw?.title || j?.raw?.job_number}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {customer ? `${customer} • ` : ''}
                        {vehicle
                          ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                          : ''}
                      </div>
                    </div>
                    <div className="w-full truncate text-muted-foreground sm:w-40">
                      {vendorName}
                    </div>
                    <div className="w-full sm:w-28">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${statusBadge?.bg || 'bg-gray-100'} ${statusBadge?.textColor || 'text-gray-800'}`}
                      >
                        {statusBadge?.label || status}
                      </span>
                    </div>
                    {hasLoaner ? (
                      <div className="w-full sm:w-20">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-violet-100 text-violet-800">
                          Loaner
                        </span>
                      </div>
                    ) : (
                      <div className="hidden sm:block sm:w-20" />
                    )}
                    <div className="flex items-center gap-2 sm:ml-auto">
                      <button
                        onClick={() => navigate(`/deals/${j.id}/edit`)}
                        className="text-blue-600 hover:underline"
                        aria-label="View deal"
                      >
                        View
                      </button>
                      {SIMPLE_CAL_ON && (
                        <button
                          onClick={() =>
                            navigate(`/calendar/agenda?focus=${encodeURIComponent(j.id)}`)
                          }
                          className="text-blue-600 hover:underline"
                          aria-label="Reschedule in Agenda"
                        >
                          Reschedule
                        </button>
                      )}
                      {canUndo(undoMap, j.id) ? (
                        <button
                          onClick={() => handleUndo(j.id)}
                          className="text-amber-600 hover:underline"
                          aria-label="Undo complete"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => handleComplete(j)}
                          className="text-green-600 hover:underline"
                          aria-label="Mark done"
                          title="Marks this job as done (status: completed)"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {groupedUpcoming.inProgress.length > 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="text-foreground font-medium">In Progress</div>
              <div className="text-xs text-muted-foreground">Scheduled window</div>
            </div>
          ) : null}

          {groupedUpcoming.inProgress.length > 0 ? (
            <ul role="list" className="divide-y rounded-lg border border-border bg-card">
              {groupedUpcoming.inProgress.map((j) => {
                const hasTime = !!j?.scheduledStart
                const start = hasTime ? formatTime(j.scheduledStart) : null
                const end = hasTime ? formatTime(j.scheduledEnd) : null
                const promiseLabel = !hasTime ? formatPromiseLabel(j?.promisedAt) : null
                const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
                const vendorName = j?.vendorName || 'On-site'
                const customer = j?.customerName || vehicle?.owner_name || ''
                const statusLabel = String(j?.raw?.job_status || '').replace('_', ' ')
                return (
                  <li
                    key={j?.calendarKey || j?.calendar_key || j.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
                    aria-label={`Appointment ${j?.raw?.title || j?.raw?.job_number || j?.id}`}
                  >
                    <div className="w-28 flex items-center gap-1 text-xs text-muted-foreground">
                      <span>
                        {hasTime ? (
                          <>
                            {start}
                            {end ? ` – ${end}` : ''}
                          </>
                        ) : (
                          <>All day{promiseLabel ? ` • ${promiseLabel}` : ''}</>
                        )}
                      </span>
                      {conflictIds.has(j.id) && (
                        <span
                          className="text-amber-600"
                          title="Potential scheduling overlap for this vendor"
                          aria-label="Scheduling conflict detected"
                          role="img"
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-foreground">
                        {j?.raw?.title || j?.raw?.job_number}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {customer ? `${customer} • ` : ''}
                        {vehicle
                          ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                          : ''}
                      </div>
                    </div>
                    <div className="w-40 truncate text-muted-foreground">{vendorName}</div>
                    <div className="w-28 text-muted-foreground">{statusLabel}</div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => navigate(`/deals/${j.id}/edit`)}
                        className="text-blue-600 hover:underline"
                        aria-label="View deal"
                      >
                        View
                      </button>
                      {SIMPLE_CAL_ON && (
                        <button
                          onClick={() =>
                            navigate(`/calendar/agenda?focus=${encodeURIComponent(j.id)}`)
                          }
                          className="text-blue-600 hover:underline"
                          aria-label="Reschedule in Agenda"
                        >
                          Reschedule
                        </button>
                      )}
                      {canUndo(undoMap, j.id) ? (
                        <button
                          onClick={() => handleUndo(j.id)}
                          className="text-amber-600 hover:underline"
                          aria-label="Undo complete"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => handleComplete(j)}
                          className="text-green-600 hover:underline"
                          aria-label="Mark done"
                          title="Marks this job as done (status: completed)"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {split.overdueRecent.length > 0 ? (
            <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
              <div className="text-foreground font-medium">Overdue Recent</div>
              <div className="text-xs text-muted-foreground">Within 7 days</div>
            </div>
          ) : null}

          {split.overdueRecent.length > 0 ? (
            <ul role="list" className="divide-y rounded-lg border border-border bg-card">
              {split.overdueRecent.map((j) => {
                const hasTime = !!j?.scheduledStart
                const start = hasTime ? formatTime(j.scheduledStart) : null
                const end = hasTime ? formatTime(j.scheduledEnd) : null
                const promiseLabel = !hasTime ? formatPromiseLabel(j?.promisedAt) : null
                const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
                const vendorName = j?.vendorName || 'On-site'
                const customer = j?.customerName || vehicle?.owner_name || ''
                const statusLabel = String(j?.raw?.job_status || '').replace('_', ' ')
                return (
                  <li
                    key={j?.calendarKey || j?.calendar_key || j.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
                    aria-label={`Appointment ${j?.raw?.title || j?.raw?.job_number || j?.id}`}
                  >
                    <div className="w-28 flex items-center gap-1 text-xs text-muted-foreground">
                      <span>
                        {hasTime ? (
                          <>
                            {start}
                            {end ? ` – ${end}` : ''}
                          </>
                        ) : (
                          <>All day{promiseLabel ? ` • ${promiseLabel}` : ''}</>
                        )}
                      </span>
                      {conflictIds.has(j.id) && (
                        <span
                          className="text-amber-600"
                          title="Potential scheduling overlap for this vendor"
                          aria-label="Scheduling conflict detected"
                          role="img"
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-foreground">
                        {j?.raw?.title || j?.raw?.job_number}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {customer ? `${customer} • ` : ''}
                        {vehicle
                          ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                          : ''}
                      </div>
                    </div>
                    <div className="w-40 truncate text-muted-foreground">{vendorName}</div>
                    <div className="w-28 text-muted-foreground">{statusLabel}</div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => navigate(`/deals/${j.id}/edit`)}
                        className="text-blue-600 hover:underline"
                        aria-label="View deal"
                      >
                        View
                      </button>
                      {SIMPLE_CAL_ON && (
                        <button
                          onClick={() =>
                            navigate(`/calendar/agenda?focus=${encodeURIComponent(j.id)}`)
                          }
                          className="text-blue-600 hover:underline"
                          aria-label="Reschedule in Agenda"
                        >
                          Reschedule
                        </button>
                      )}
                      {canUndo(undoMap, j.id) ? (
                        <button
                          onClick={() => handleUndo(j.id)}
                          className="text-amber-600 hover:underline"
                          aria-label="Undo complete"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => handleComplete(j)}
                          className="text-green-600 hover:underline"
                          aria-label="Mark done"
                          title="Marks this job as done (status: completed)"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {showOlderOverdue && split.overdueOld.length > 0 ? (
            <ul role="list" className="divide-y rounded-lg border border-border bg-card">
              {split.overdueOld.map((j) => {
                const hasTime = !!j?.scheduledStart
                const start = hasTime ? formatTime(j.scheduledStart) : null
                const end = hasTime ? formatTime(j.scheduledEnd) : null
                const promiseLabel = !hasTime ? formatPromiseLabel(j?.promisedAt) : null
                const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
                const vendorName = j?.vendorName || 'On-site'
                const customer = j?.customerName || vehicle?.owner_name || ''
                const statusLabel = String(j?.raw?.job_status || '').replace('_', ' ')
                return (
                  <li
                    key={j?.calendarKey || j?.calendar_key || j.id}
                    className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
                    aria-label={`Appointment ${j?.raw?.title || j?.raw?.job_number || j?.id}`}
                  >
                    <div className="w-28 flex items-center gap-1 text-xs text-muted-foreground">
                      <span>
                        {hasTime ? (
                          <>
                            {start}
                            {end ? ` – ${end}` : ''}
                          </>
                        ) : (
                          <>All day{promiseLabel ? ` • ${promiseLabel}` : ''}</>
                        )}
                      </span>
                      {conflictIds.has(j.id) && (
                        <span
                          className="text-amber-600"
                          title="Potential scheduling overlap for this vendor"
                          aria-label="Scheduling conflict detected"
                          role="img"
                        >
                          ⚠️
                        </span>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate text-foreground">
                        {j?.raw?.title || j?.raw?.job_number}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">
                        {customer ? `${customer} • ` : ''}
                        {vehicle
                          ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                          : ''}
                      </div>
                    </div>
                    <div className="w-40 truncate text-muted-foreground">{vendorName}</div>
                    <div className="w-28 text-muted-foreground">{statusLabel}</div>
                    <div className="flex items-center gap-2 ml-auto">
                      <button
                        onClick={() => navigate(`/deals/${j.id}/edit`)}
                        className="text-blue-600 hover:underline"
                        aria-label="View deal"
                      >
                        View
                      </button>
                      {SIMPLE_CAL_ON && (
                        <button
                          onClick={() =>
                            navigate(`/calendar/agenda?focus=${encodeURIComponent(j.id)}`)
                          }
                          className="text-blue-600 hover:underline"
                          aria-label="Reschedule in Agenda"
                        >
                          Reschedule
                        </button>
                      )}
                      {canUndo(undoMap, j.id) ? (
                        <button
                          onClick={() => handleUndo(j.id)}
                          className="text-amber-600 hover:underline"
                          aria-label="Undo complete"
                        >
                          Undo
                        </button>
                      ) : (
                        <button
                          onClick={() => handleComplete(j)}
                          className="text-green-600 hover:underline"
                          aria-label="Mark done"
                          title="Marks this job as done (status: completed)"
                        >
                          Mark done
                        </button>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          ) : null}

          {/* NOTE: Unscheduled section remains below (separate operational bucket) */}

          {/* Legacy combined list removed in favor of sectioned lists */}
          {/*
      <ul role="list" className="divide-y rounded border bg-white">
        {rows.map((j) => {
          const start = formatTime(j.scheduledStart)
          const end = formatTime(j.scheduledEnd)
          const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
          const vendorName = j?.vendorName || 'On-site'
          const customer = j?.customerName || vehicle?.owner_name || ''
          const statusLabel = String(j?.raw?.job_status || '').replace('_', ' ')
          return (
            <li
              key={j.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
              aria-label={`Appointment ${j?.raw?.title || j?.raw?.job_number || j?.id}`}
            >
              <div className="w-28 text-gray-700 flex items-center gap-1 text-xs">
                <span>
                  {start}
                  {end ? ` – ${end}` : ''}
                </span>
                {conflictIds.has(j.id) && (
                  <span
                    className="text-amber-600"
                    title="Potential scheduling overlap for this vendor"
                    aria-label="Scheduling conflict detected"
                    role="img"
                  >
                    ⚠️
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{j?.raw?.title || j?.raw?.job_number}</div>
                <div className="text-xs text-gray-500 truncate">
                  {customer ? `${customer} • ` : ''}
                  {vehicle
                    ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                    : ''}
                </div>
              </div>
              <div className="w-40 text-gray-600 truncate">{vendorName}</div>
              <div className="w-28 text-gray-600">{statusLabel}</div>
              <div className="flex items-center gap-2 ml-auto">
                <button
                  onClick={() => navigate(`/deals/${j.id}/edit`)}
                  className="text-blue-600 hover:underline"
                  aria-label="View deal"
                >
                  View
                </button>
                {SIMPLE_CAL_ON && (
                  <button
                    onClick={() => navigate(`/calendar/agenda?focus=${encodeURIComponent(j.id)}`)}
                    className="text-blue-600 hover:underline"
                    aria-label="Reschedule in Agenda"
                  >
                    Reschedule
                  </button>
                )}
                {canUndo(undoMap, j.id) ? (
                  <button
                    onClick={() => handleUndo(j.id)}
                    className="text-amber-600 hover:underline"
                    aria-label="Undo complete"
                  >
                    Undo
                  </button>
                ) : (
                  <button
                    onClick={() => handleComplete(j)}
                    className="text-green-600 hover:underline"
                    aria-label="Mark done"
                    title="Marks this job as done (status: completed)"
                  >
                    Mark done
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      */}

          {split.unscheduledInProgress.length > 0 ? (
            <div className="pt-2">
              <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2 text-sm">
                <div className="text-foreground font-medium">In Progress (Unscheduled)</div>
                <div className="text-xs text-muted-foreground">In-house/on-site only</div>
              </div>
              <ul role="list" className="mt-2 divide-y rounded-lg border border-border bg-card">
                {split.unscheduledInProgress.map((j) => {
                  const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
                  const customer = j?.customerName || vehicle?.owner_name || ''
                  const statusLabel = String(j?.raw?.job_status || '').replace('_', ' ')
                  const svc = String(j?.raw?.service_type || '').toLowerCase()
                  const locationLabel =
                    svc === 'onsite' || svc === 'in_house' || svc === 'inhouse'
                      ? 'Unscheduled (In House / On-Site)'
                      : 'Unscheduled'

                  return (
                    <li
                      key={j?.calendarKey || j?.calendar_key || j.id}
                      className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50"
                      aria-label={`Appointment ${j?.raw?.title || j?.raw?.job_number || j?.id}`}
                    >
                      <div className="w-28 flex items-center gap-1 text-xs text-muted-foreground">
                        <span>Unscheduled</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate text-foreground">
                          {j?.raw?.title || j?.raw?.job_number}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {customer ? `${customer} • ` : ''}
                          {vehicle
                            ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                            : ''}
                        </div>
                      </div>
                      <div className="w-40 text-muted-foreground truncate">{locationLabel}</div>
                      <div className="w-28 text-muted-foreground">{statusLabel}</div>
                      <div className="flex items-center gap-2 ml-auto">
                        <button
                          onClick={() => navigate(`/deals/${j.id}/edit`)}
                          className="text-blue-600 hover:underline"
                          aria-label="View deal"
                        >
                          View
                        </button>
                        {canUndo(undoMap, j.id) ? (
                          <button
                            onClick={() => handleUndo(j.id)}
                            className="text-amber-600 hover:underline"
                            aria-label="Undo complete"
                          >
                            Undo
                          </button>
                        ) : (
                          <button
                            onClick={() => handleComplete(j)}
                            className="text-green-600 hover:underline"
                            aria-label="Mark done"
                            title="Marks this job as done (status: completed)"
                          >
                            Mark done
                          </button>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
