// src/pages/calendar-agenda/index.jsx
// Feature-flagged Simple Agenda view (VITE_SIMPLE_CALENDAR=true)
// Minimal, read-only upcoming appointments list with inline actions: View Deal, Reschedule, Complete
// Does NOT modify legacy calendar components; safe to remove.
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { jobService } from '@/services/jobService'
import { calendarService } from '@/services/calendarService'
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
function applyFilters(rows, { q, status, dateRange, vendorFilter }) {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const next7Days = new Date(today)
  next7Days.setDate(next7Days.getDate() + 7)

  return rows.filter((r) => {
    if (status && r.job_status !== status) return false
    if (vendorFilter && r.vendor_id !== vendorFilter) return false
    
    // Date range filter
    if (dateRange === 'today') {
      const startDate = new Date(r.scheduled_start_time)
      const jobDay = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate())
      if (jobDay.getTime() !== today.getTime()) return false
    } else if (dateRange === 'next7days') {
      const startDate = new Date(r.scheduled_start_time)
      if (startDate < today || startDate >= next7Days) return false
    }
    
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
  const [conflicts, setConflicts] = useState(new Map()) // jobId -> boolean
  const [q, setQ] = useState(() => new URLSearchParams(location.search).get('q') || '')
  const [status, setStatus] = useState(
    () => new URLSearchParams(location.search).get('status') || ''
  )
  const [dateRange, setDateRange] = useState(
    () => new URLSearchParams(location.search).get('dateRange') || 'all'
  )
  const [vendorFilter, setVendorFilter] = useState(
    () => new URLSearchParams(location.search).get('vendor') || ''
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
    if (dateRange && dateRange !== 'all') params.set('dateRange', dateRange)
    else params.delete('dateRange')
    if (vendorFilter) params.set('vendor', vendorFilter)
    else params.delete('vendor')
    if (focusId) params.set('focus', focusId)
    const next = params.toString()
    const current = location.search.replace(/^\?/, '')
    if (next !== current) navigate({ search: next ? `?${next}` : '' }, { replace: true })
  }, [q, status, dateRange, vendorFilter, focusId, navigate, location.search])

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

  // Check for conflicts (passive, no blocking)
  useEffect(() => {
    const checkConflicts = async () => {
      const conflictMap = new Map()
      for (const job of jobs) {
        if (!job.vendor_id || !job.scheduled_start_time || !job.scheduled_end_time) continue
        try {
          const start = new Date(job.scheduled_start_time)
          const end = new Date(job.scheduled_end_time)
          // Check 30min window
          const checkStart = new Date(start.getTime() - 30 * 60 * 1000)
          const checkEnd = new Date(end.getTime() + 30 * 60 * 1000)
          const { hasConflict } = await calendarService.checkSchedulingConflict(
            job.vendor_id,
            checkStart,
            checkEnd,
            job.id
          )
          conflictMap.set(job.id, hasConflict)
        } catch (e) {
          // Silent failure for conflict checking
        }
      }
      setConflicts(conflictMap)
    }
    if (jobs.length > 0) {
      checkConflicts()
    }
  }, [jobs])

  // Group
  const filtered = useMemo(() => applyFilters(jobs, { q, status, dateRange, vendorFilter }), [jobs, q, status, dateRange, vendorFilter])
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
          } catch (e) {
            toast.error('Undo failed')
          }
        }
        
        // Toast with undo action (10s timeout)
        toast.success('Marked completed', { 
          action: { label: 'Undo', onClick: undo },
          duration: 10000 
        })
      }
      
      await load()
    } catch (e) {
      toast?.error?.('Complete failed')
    }
  }

  if (loading) return <div className="p-4">Loading agenda…</div>

  return (
    <div className="p-4 space-y-4" aria-label="Scheduled Appointments Agenda">
      {/* Aria-live region for screen reader announcements */}
      <div className="sr-only" aria-live="polite" aria-atomic="true"></div>
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
          aria-label="Filter by date range"
          className="border rounded px-2 py-1"
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value)}
        >
          <option value="all">All Dates</option>
          <option value="today">Today</option>
          <option value="next7days">Next 7 Days</option>
        </select>
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
              const hasConflict = conflicts.get(r.id)
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
                    <div className="font-medium truncate flex items-center gap-2">
                      {r.title || r.job_number}
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
