// src/pages/currently-active-appointments/components/SnapshotView.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useTenant from '@/hooks/useTenant'
import { jobService } from '@/services/jobService'
import { useToast } from '@/components/ui/ToastProvider'
import { createUndoEntry, canUndo } from './undoHelpers'
import { formatTime } from '@/utils/dateTimeUtils'

const SIMPLE_CAL_ON = String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

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

// Exported to allow unit testing: detect overlapping appointments per vendor
// Returns a Set of job ids that have a local overlap with at least one other job for the same vendor
export function detectConflicts(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return new Set()

  // Group jobs by vendor id (fallback to null for unassigned)
  const byVendor = new Map()
  for (const j of rows) {
    const vId = j?.vendor?.id ?? j?.vendor_id ?? null
    if (!byVendor.has(vId)) byVendor.set(vId, [])
    byVendor.get(vId).push(j)
  }

  const conflictIds = new Set()
  for (const [, jobs] of byVendor) {
    // Only consider jobs that have both start/end for overlap detection
    const withTimes = jobs
      .filter((j) => j?.scheduled_start_time && j?.scheduled_end_time)
      .map((j) => ({
        id: j.id,
        start: new Date(j.scheduled_start_time).getTime(),
        end: new Date(j.scheduled_end_time).getTime(),
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
  const { orgId } = useTenant()
  const toast = useToast?.()
  const navigate = useNavigate()

  const [rawJobs, setRawJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [undoMap, setUndoMap] = useState(new Map()) // id -> { prevStatus, timeoutId }
  const [statusMessage, setStatusMessage] = useState('') // For aria-live announcements

  const rows = useMemo(() => filterAndSort(rawJobs), [rawJobs])
  const conflictIds = useMemo(() => detectConflicts(rows), [rows])

  async function load() {
    setLoading(true)
    try {
      const jobs = await jobService.getAllJobs({ orgId })
      setRawJobs(Array.isArray(jobs) ? jobs : [])
    } catch (e) {
      console.warn('[SnapshotView] load failed', e)
      setRawJobs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [orgId])

  async function handleComplete(job) {
    const prevStatus = job?.job_status || 'scheduled'
    const jobTitle = job?.title || job?.job_number || 'Appointment'
    try {
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
      await jobService.updateStatus(jobId, meta.prevStatus, { completed_at: null })
      const message = 'Restored status'
      toast?.success?.(message)
      setStatusMessage(message)
    } catch (e) {
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

      {rows.length === 0 && (
        <div role="status" aria-live="polite" className="text-gray-600">
          No scheduled or in-progress appointments.
        </div>
      )}

      <ul role="list" className="divide-y rounded border bg-white">
        {rows.map((j) => {
          const start = formatTime(j.scheduled_start_time)
          const end = formatTime(j.scheduled_end_time)
          const vehicle = j?.vehicle
          const vendorName = j?.vendor?.name || 'Unassigned'
          const customer = vehicle?.owner_name || ''
          const undoInfo = undoMap.get(j.id)
          return (
            <li
              key={j.id}
              className="flex items-center gap-3 px-3 py-2 text-sm"
              aria-label={`Appointment ${j.title || j.job_number}`}
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
                  >
                    6A0
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{j.title || j.job_number}</div>
                <div className="text-xs text-gray-500 truncate">
                  {customer ? `${customer} • ` : ''}
                  {vehicle
                    ? `${vehicle.year ?? ''} ${vehicle.make ?? ''} ${vehicle.model ?? ''}`.trim()
                    : ''}
                </div>
              </div>
              <div className="w-40 text-gray-600 truncate">{vendorName}</div>
              <div className="w-28 text-gray-600">{j.job_status?.replace('_', ' ')}</div>
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
