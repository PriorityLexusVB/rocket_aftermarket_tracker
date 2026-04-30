import React, { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layouts/AppLayout'
import DealDrawer from '@/components/calendar/DealDrawer'
import useTenant from '@/hooks/useTenant'
import { jobService } from '@/services/jobService'
import { useToast } from '@/components/ui/ToastProvider'

const EXCLUDED_STATUSES = new Set(['completed', 'cancelled', 'canceled', 'draft'])
const OVERDUE_CANDIDATE_FIELDS = [
  'next_promised_iso',
  'promised_date',
  'promisedAt',
  'due_date',
  'dueDate',
  'next_due_iso',
  'dueAt',
  // FIX P2-4: scheduled_start_time as final fallback — if the appointment start
  // is in the past and the job is not in a terminal status, it is overdue.
  'scheduled_start_time',
]

const OVERDUE_SOURCE_LABELS = {
  next_promised_iso: 'Promised date',
  promised_date: 'Promised date',
  promisedAt: 'Promised date',
  due_date: 'Due date',
  dueDate: 'Due date',
  next_due_iso: 'Due date',
  dueAt: 'Due date',
  scheduled_start_time: 'Scheduled start',
}

function toDate(input) {
  const date = input ? new Date(input) : null
  return date && !Number.isNaN(date.getTime()) ? date : null
}

function getRowKey(job) {
  return String(job?.id || job?.job_number || '')
}

function getEarliestOverdueMeta(job, now = new Date()) {
  const nowTs = now.getTime()
  let earliestMeta = null

  for (const field of OVERDUE_CANDIDATE_FIELDS) {
    // scheduled_start_time is only a valid overdue signal for jobs that have
    // already been started (in_progress, quality_check). For 'scheduled' status
    // the appointment start being in the past just means it hasn't kicked off yet,
    // not that it's overdue — the coordinator needs to see it, not the overdue inbox.
    if (field === 'scheduled_start_time' && job?.job_status === 'scheduled') continue

    const ts = toDate(job?.[field])?.getTime()
    if (typeof ts !== 'number') continue
    if (ts >= nowTs) continue

    if (!earliestMeta || ts < earliestMeta.timestamp) {
      earliestMeta = {
        timestamp: ts,
        label: OVERDUE_SOURCE_LABELS[field] || 'Past due date',
      }
    }
  }

  return earliestMeta
}

function getEarliestOverdueTimestamp(job, now = new Date()) {
  return getEarliestOverdueMeta(job, now)?.timestamp ?? null
}

export function isStrictOverdueJob(job, now = new Date()) {
  const status = String(job?.job_status || job?.status || '').toLowerCase()
  if (EXCLUDED_STATUSES.has(status)) return false

  return getEarliestOverdueTimestamp(job, now) !== null
}

function formatDateTime(input) {
  const date = toDate(input)
  if (!date) return '—'
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatOverdueBy(input) {
  const date = toDate(input)
  if (!date) return '—'

  const diffMs = Date.now() - date.getTime()
  if (diffMs <= 0) return '—'

  const totalHours = Math.floor(diffMs / (60 * 60 * 1000))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  if (days <= 0) return `${hours}h`
  if (hours <= 0) return `${days}d`
  return `${days}d ${hours}h`
}

export function normalizeOverdueRows(items, now = new Date()) {
  const list = Array.isArray(items) ? items : []
  const deduped = new Map()

  for (const item of list) {
    const job = item?.raw || item
    if (!job) continue
    if (!isStrictOverdueJob(job, now)) continue

    const key = getRowKey(job)
    if (!key) continue

    const existing = deduped.get(key)
    if (!existing) {
      deduped.set(key, job)
      continue
    }

    const existingOverdueTs = getEarliestOverdueTimestamp(existing, now) ?? Number.POSITIVE_INFINITY
    const nextOverdueTs = getEarliestOverdueTimestamp(job, now) ?? Number.POSITIVE_INFINITY
    if (nextOverdueTs < existingOverdueTs) {
      deduped.set(key, job)
    }
  }

  return Array.from(deduped.values()).sort((a, b) => {
    const aTime = getEarliestOverdueTimestamp(a, now) ?? 0
    const bTime = getEarliestOverdueTimestamp(b, now) ?? 0
    return aTime - bTime
  })
}

export default function OverdueInbox() {
  const { orgId, loading: tenantLoading } = useTenant()
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [completingId, setCompletingId] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDeal, setDrawerDeal] = useState(null)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Overdue Inbox'
    }
  }, [])

  useEffect(() => {
    let active = true

    const load = async (silent = false) => {
      if (tenantLoading) return
      if (!silent) setLoading(true)
      setError('')

      try {
        const jobs = await jobService.getAllJobs({ orgId })
        if (!active) return
        setRows(normalizeOverdueRows(jobs))
      } catch (e) {
        if (!active) return
        setError(e?.message || 'Failed to load overdue items')
      } finally {
        if (active && !silent) setLoading(false)
      }
    }

    load(false)
    return () => {
      active = false
    }
  }, [orgId, tenantLoading])

  const filteredRows = useMemo(() => {
    const search = query.trim().toLowerCase()
    if (!search) return rows
    return rows.filter((job) => {
      const haystack = [
        job?.job_number,
        job?.customer_name,
        job?.vehicle?.owner_name,
        job?.vehicle?.stock_number,
        job?.title,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return haystack.includes(search)
    })
  }, [rows, query])

  const handleMarkComplete = async (job, event) => {
    event?.stopPropagation?.()
    const jobId = String(job?.id || '')
    if (!jobId || completingId) return

    const previousRows = rows
    setCompletingId(jobId)
    setRows((prev) => prev.filter((item) => String(item?.id || '') !== jobId))

    try {
      await jobService.updateStatus(jobId, 'completed', {
        completed_at: new Date().toISOString(),
      })
      toast?.success?.('Marked complete')

      const jobs = await jobService.getAllJobs({ orgId })
      setRows(normalizeOverdueRows(jobs))
    } catch (e) {
      setRows(previousRows)
      toast?.error?.(e?.message || 'Failed to mark complete')
    } finally {
      setCompletingId('')
    }
  }

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl space-y-4 p-4 md:px-6 md:py-6">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Overdue Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Past-due items waiting for delivery coordinator action.
              </p>
              <p className="text-xs font-medium text-muted-foreground mt-1">{filteredRows.length} items</p>
            </div>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search deal, customer, stock"
              aria-label="Search overdue inbox"
              className="h-9 w-full max-w-xs rounded-md border border-input bg-background px-3 text-sm text-foreground"
            />
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
          {loading ? (
            <div className="p-6 text-sm text-muted-foreground">Loading overdue items…</div>
          ) : error ? (
            <div className="p-6 text-sm text-red-600">{error}</div>
          ) : filteredRows.length === 0 ? (
            <div className="p-6 text-sm text-muted-foreground">No overdue items</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border text-sm">
                <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3">Deal #</th>
                    <th className="px-4 py-3">Customer</th>
                    <th className="px-4 py-3">Past due date</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Overdue by</th>
                    <th className="px-4 py-3">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((job) => {
                    const jobId = String(job?.id || '')
                    const overdueMeta = getEarliestOverdueMeta(job)
                    const overdueDateValue = overdueMeta?.timestamp ? new Date(overdueMeta.timestamp) : null
                    const status = String(job?.job_status || job?.status || 'pending')
                    const location =
                      job?.location || job?.service_type || job?.location_type || job?.locationType || '—'

                    return (
                      <tr
                        key={job?.id || job?.job_number}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => {
                          setDrawerDeal(job)
                          setDrawerOpen(true)
                        }}
                      >
                        <td className="px-4 py-3 font-medium text-foreground">{job?.job_number || '—'}</td>
                        <td className="px-4 py-3 text-foreground">
                          {job?.customer_name || job?.vehicle?.owner_name || '—'}
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          <div className="flex flex-col gap-1">
                            <span>{formatDateTime(overdueDateValue)}</span>
                            {overdueMeta?.label ? (
                              <span className="inline-flex w-fit rounded border border-border bg-muted/40 px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                                {overdueMeta.label}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-foreground">{status}</td>
                        <td className="px-4 py-3 text-foreground">{location}</td>
                        <td className="px-4 py-3 text-foreground">{formatDateTime(job?.updated_at)}</td>
                        <td className="px-4 py-3 font-medium text-red-700">{formatOverdueBy(overdueDateValue)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={(event) => handleMarkComplete(job, event)}
                            disabled={completingId === jobId}
                            className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {completingId === jobId ? 'Saving…' : 'Mark Complete'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>

      <DealDrawer open={drawerOpen} deal={drawerDeal} onClose={() => setDrawerOpen(false)} />
    </AppLayout>
  )
}
