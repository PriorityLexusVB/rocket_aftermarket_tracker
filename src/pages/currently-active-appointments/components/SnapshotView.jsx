// src/pages/currently-active-appointments/components/SnapshotView.jsx
import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useTenant from '@/hooks/useTenant'
import { jobService } from '@/services/jobService'
import { useToast } from '@/components/ui/ToastProvider'

const SIMPLE_CAL_ON = String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

// Format a time in America/New_York without adding a new dependency
function formatLocalTimeNY(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d)
  } catch (_) {
    return ''
  }
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

export default function SnapshotView() {
  const { orgId } = useTenant()
  const toast = useToast?.()
  const navigate = useNavigate()

  const [rawJobs, setRawJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [undoMap, setUndoMap] = useState(new Map()) // id -> { prevStatus, timeoutId }

  const rows = useMemo(() => filterAndSort(rawJobs), [rawJobs])

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
    try {
      await jobService.updateStatus(job.id, 'completed', { completed_at: new Date().toISOString() })
      toast?.success?.(`Marked "${job?.title || job?.job_number || 'Appointment'}" as completed`)
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
        copy.set(job.id, { prevStatus, timeoutId: tId })
        return copy
      })
    } catch (e) {
      toast?.error?.('Complete failed')
    }
  }

  async function handleUndo(jobId) {
    const meta = undoMap.get(jobId)
    if (!meta) return
    clearTimeout(meta.timeoutId)
    try {
      await jobService.updateStatus(jobId, meta.prevStatus, { completed_at: null })
      toast?.success?.('Restored status')
    } catch (e) {
      toast?.error?.('Undo failed')
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
          const start = formatLocalTimeNY(j.scheduled_start_time)
          const end = formatLocalTimeNY(j.scheduled_end_time)
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
              <div className="w-28 text-gray-700">
                {start}
                {end ? ` – ${end}` : ''}
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
                {undoInfo ? (
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
