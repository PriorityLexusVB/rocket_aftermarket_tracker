// src/pages/calendar-agenda/index.jsx
// Feature-flagged Simple Agenda view (VITE_SIMPLE_CALENDAR=true)
// Minimal, read-only upcoming appointments list with inline actions: View Deal, Reschedule, Complete
// Does NOT modify legacy calendar components; safe to remove.
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { jobService } from '@/services/jobService'
import useTenant from '@/hooks/useTenant'
import { useToast } from '@/components/ui/ToastProvider'

// Lightweight date key grouping (America/New_York)
function toDateKey(ts) {
  if (!ts) return 'unscheduled'
  const d = new Date(ts)
  // Force America/New_York without external deps: compute offset via Intl
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  // mm/dd/yyyy -> yyyy-mm-dd
  const [m, dd, yyyy] = fmt.split('/')
  return `${yyyy}-${m}-${dd}`
}

// Derive filtered list
function applyFilters(rows, { q, status }) {
  return rows.filter((r) => {
    if (status && r.job_status !== status) return false
    if (q) {
      const needle = q.toLowerCase()
      const hay = [r.title, r.description, r.job_number, r.vehicle?.owner_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

export default function CalendarAgenda() {
  const { orgId } = useTenant()
  const toast = useToast?.()
  const navigate = useNavigate()
  const location = useLocation()
  const [loading, setLoading] = useState(true)
  const [jobs, setJobs] = useState([])
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '')
  const [status, setStatus] = useState(
    () => new URLSearchParams(location.search).get('status') || ''
  )
  const focusId = useMemo(
    () => new URLSearchParams(location.search).get('focus'),
    [location.search]
  )
  const focusRef = useRef(null)

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    if (q) params.set('q', q)
    else params.delete('q')
    if (status) params.set('status', status)
    else params.delete('status')
    if (focusId) params.set('focus', focusId)
    const next = params.toString()
    const current = location.search.replace(/^\?/, '')
    if (next !== current) navigate({ search: next ? `?${next}` : '' }, { replace: true })
  }, [q, status, focusId, navigate, location.search])

  const load = useCallback(async () => {
    setLoading(true)
    // Fetch scheduled jobs only (scheduled_start_time not null, status optional filter)
    let all = []
    try {
      all = await jobService.getAllJobs({ orgId })
    } catch (e) {
      console.warn('[agenda] load failed', e)
    }
    // Filter to those with a start time in the future OR today
    const now = Date.now()
    const upcoming = (all || []).filter((j) => j.scheduled_start_time)
    // Sort ascending by start time
    upcoming.sort((a, b) => new Date(a.scheduled_start_time) - new Date(b.scheduled_start_time))
    setJobs(upcoming)
    setLoading(false)
  }, [orgId])

  useEffect(() => {
    load()
  }, [load])

  // Group
  const filtered = useMemo(() => applyFilters(jobs, { q, status }), [jobs, q, status])
  const groups = useMemo(() => {
    const map = new Map()
    filtered.forEach((j) => {
      const key = toDateKey(j.scheduled_start_time)
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

  async function handleReschedule(job) {
    // Minimal inline reschedule: +1 hour from current end or start
    const start = new Date(job.scheduled_start_time)
    const end = new Date(job.scheduled_end_time || start.getTime() + 60 * 60 * 1000)
    start.setHours(start.getHours() + 1)
    end.setHours(end.getHours() + 1)
    try {
      await jobService.updateJob(job.id, {
        scheduled_start_time: start.toISOString(),
        scheduled_end_time: end.toISOString(),
      })
      toast?.success?.('Rescheduled')
      await load()
    } catch (e) {
      toast?.error?.('Reschedule failed')
    }
  }

  async function handleComplete(job) {
    try {
      await jobService.updateStatus(job.id, 'completed', { completed_at: new Date().toISOString() })
      toast?.success?.('Marked completed')
      await load()
    } catch (e) {
      toast?.error?.('Complete failed')
    }
  }

  if (loading) return <div className="p-4">Loading agenda…</div>

  return (
    <div className="p-4 space-y-4" aria-label="Scheduled Appointments Agenda">
      <header className="flex items-center gap-4 flex-wrap" aria-label="Agenda controls">
        <h1 className="text-xl font-semibold">Scheduled Appointments</h1>
        <input
          aria-label="Search appointments"
          placeholder="Search"
          className="border rounded px-2 py-1"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          aria-label="Filter by status"
          className="border rounded px-2 py-1"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All Statuses</option>
          <option value="scheduled">Scheduled</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
        </select>
      </header>
      {groups.length === 0 && (
        <div role="status" aria-live="polite">
          No upcoming appointments.
        </div>
      )}
      {groups.map(([dateKey, rows]) => (
        <section key={dateKey} aria-label={`Appointments for ${dateKey}`} className="space-y-2">
          <h2 className="text-sm font-medium text-gray-600 mt-6">{dateKey}</h2>
          <ul className="divide-y rounded border bg-white" role="list">
            {rows.map((r) => {
              const focused = r.id === focusId
              return (
                <li
                  key={r.id}
                  ref={focused ? focusRef : null}
                  tabIndex={0}
                  aria-label={`Appointment ${r.title || r.job_number}`}
                  className={`flex items-center gap-3 px-3 py-2 text-sm ${focused ? 'bg-yellow-50' : ''}`}
                >
                  <div className="w-32 text-gray-700">
                    {new Date(r.scheduled_start_time).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium truncate">{r.title || r.job_number}</div>
                    <div className="text-xs text-gray-500 truncate">
                      {r.vehicle?.make} {r.vehicle?.model} {r.vehicle?.year}
                    </div>
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
    </div>
  )
}

export { toDateKey }
