// src/pages/currently-active-appointments/components/SnapshotView.jsx
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useTenant from '@/hooks/useTenant'
import { useToast } from '@/components/ui/ToastProvider'
import { createUndoEntry, canUndo } from './undoHelpers'
import { formatTime } from '@/utils/dateTimeUtils'
import { getScheduleItems, classifyScheduleState } from '@/services/scheduleItemsService'

const SIMPLE_CAL_ON = String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

const MS_DAY = 24 * 60 * 60 * 1000

function addDays(d, days) {
  const base = d instanceof Date ? d : new Date(d)
  return new Date(base.getTime() + days * MS_DAY)
}

function safeDate(input) {
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

// Exported to allow unit testing
export function filterAndSort(jobs) {
  const rows = Array.isArray(jobs) ? jobs : []
  const filtered = rows.filter(
    (j) =>
      (j?.job_status === 'scheduled' || j?.job_status === 'in_progress') && j?.scheduled_start_time
  )
  filtered.sort(
    (a, b) =>
      new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
  )
  return filtered
}

// Exported to allow unit testing
export function splitSnapshotItems(items, { now = new Date() } = {}) {
  const list = Array.isArray(items) ? items : []
  const nowDate = safeDate(now) || new Date()

  const upcoming = []
  const overdueRecent = []
  const overdueOld = []

  for (const it of list) {
    const start = safeDate(it?.scheduledStart)
    if (!start) continue

    const state =
      it?.scheduleState ||
      classifyScheduleState({
        scheduledStart: it?.scheduledStart,
        scheduledEnd: it?.scheduledEnd,
        jobStatus: it?.raw?.job_status,
        now: nowDate,
      })

    if (state === 'scheduled' || state === 'in_progress') upcoming.push(it)
    else if (state === 'overdue_recent') overdueRecent.push(it)
    else if (state === 'overdue_old') overdueOld.push(it)
  }

  const sortByStart = (a, b) => {
    const aMs = safeDate(a?.scheduledStart)?.getTime() || 0
    const bMs = safeDate(b?.scheduledStart)?.getTime() || 0
    return aMs - bMs
  }

  upcoming.sort(sortByStart)
  overdueRecent.sort(sortByStart)
  overdueOld.sort(sortByStart)

  return { upcoming, overdueRecent, overdueOld }
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

  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [undoMap, setUndoMap] = useState(new Map()) // id -> { prevStatus, timeoutId }
  const [statusMessage, setStatusMessage] = useState('') // For aria-live announcements
  const [showOlderOverdue, setShowOlderOverdue] = useState(false)
  const [sourceDebug, setSourceDebug] = useState(null)

  const now = useMemo(() => new Date(), [])

  const split = useMemo(() => splitSnapshotItems(items, { now }), [items, now])
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

      // Default “Active” = next 7 days scheduled + in progress
      const upcomingRes = await getScheduleItems({
        rangeStart: nowDate,
        rangeEnd: addDays(nowDate, 7),
        orgId,
      })

      // Overdue: last 7 days visible; older overdue collapsed.
      // Fetch a wider overdue window so we can compute the older bucket.
      const overdueRes = await getScheduleItems({
        rangeStart: addDays(nowDate, -365),
        rangeEnd: nowDate,
        orgId,
      })

      const combined = [...(upcomingRes.items || []), ...(overdueRes.items || [])]

      // De-dupe by id (upcoming and overdue windows can overlap at boundary)
      const byId = new Map()
      for (const it of combined) {
        if (it?.id) byId.set(it.id, it)
      }
      setItems(Array.from(byId.values()))

      if (import.meta.env.DEV) {
        setSourceDebug({
          upcoming: upcomingRes.debug || null,
          overdue: overdueRes.debug || null,
          totals: {
            upcomingItems: (upcomingRes.items || []).length,
            overdueItems: (overdueRes.items || []).length,
            combinedUnique: byId.size,
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
  }, [orgId])

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
      const message = `Marked "${jobTitle}" as completed`
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
      const errorMsg = 'Complete failed'
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

      <header className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Active Appointments (Snapshot)</h1>
        {SIMPLE_CAL_ON && (
          <button
            onClick={() => navigate('/calendar/agenda')}
            className="text-indigo-600 hover:underline"
            aria-label="Open Agenda"
          >
            Open Agenda
          </button>
        )}
      </header>

      {import.meta.env.DEV && sourceDebug ? (
        <div className="text-[11px] text-gray-500" aria-label="Source Debug">
          Source Debug • upcoming: {sourceDebug?.totals?.upcomingItems ?? 0} • overdue(window):{' '}
          {sourceDebug?.totals?.overdueItems ?? 0} • unique:{' '}
          {sourceDebug?.totals?.combinedUnique ?? 0} • sources(upcoming):{' '}
          {JSON.stringify(sourceDebug?.upcoming?.scheduleSources || {})} • sources(overdue):{' '}
          {JSON.stringify(sourceDebug?.overdue?.scheduleSources || {})}
        </div>
      ) : null}

      {split.upcoming.length === 0 && split.overdueRecent.length === 0 && (
        <div role="status" aria-live="polite" className="text-gray-600">
          No appointments in this range.
        </div>
      )}

      {split.overdueOld.length > 0 ? (
        <div className="flex items-center justify-between rounded border bg-white px-3 py-2 text-sm">
          <div className="text-gray-700">Overdue (older than 7 days)</div>
          <button
            type="button"
            onClick={() => setShowOlderOverdue((v) => !v)}
            className="text-indigo-600 hover:underline"
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

      <ul role="list" className="divide-y rounded border bg-white">
        {rows.map((j) => {
          const start = formatTime(j.scheduledStart)
          const end = formatTime(j.scheduledEnd)
          const vehicle = j?.raw?.vehicle || j?.raw?.vehicles
          const vendorName = j?.vendorName || 'Unassigned'
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
                    className="text-indigo-600 hover:underline"
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
                    aria-label="Mark complete"
                  >
                    Complete
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
