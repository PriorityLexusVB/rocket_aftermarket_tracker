import React, { useEffect, useMemo, useState } from 'react'
import AppLayout from '@/components/layouts/AppLayout'
import DealDrawer from '@/components/calendar/DealDrawer'
import useTenant from '@/hooks/useTenant'
import { getNeedsSchedulingPromiseItems } from '@/services/scheduleItemsService'
import { isOverdue } from '@/lib/time'

const EXCLUDED_STATUSES = new Set(['completed', 'cancelled', 'canceled', 'draft'])

function getPromiseValue(job) {
  return job?.next_promised_iso || job?.promised_date || job?.promisedAt || null
}

function toDate(input) {
  const d = input ? new Date(input) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

function formatDateTime(input) {
  const d = toDate(input)
  if (!d) return '—'
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatOverdueBy(input) {
  const d = toDate(input)
  if (!d) return '—'

  const diffMs = Date.now() - d.getTime()
  if (diffMs <= 0) return '—'

  const totalHours = Math.floor(diffMs / (60 * 60 * 1000))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24

  if (days <= 0) return `${hours}h`
  if (hours <= 0) return `${days}d`
  return `${days}d ${hours}h`
}

function normalizeOverdueRows(items) {
  const list = Array.isArray(items) ? items : []
  return list
    .map((item) => item?.raw || item)
    .filter(Boolean)
    .filter((job) => {
      const status = String(job?.job_status || job?.status || '').toLowerCase()
      if (EXCLUDED_STATUSES.has(status)) return false
      return isOverdue(getPromiseValue(job))
    })
    .sort((a, b) => {
      const aTime = toDate(getPromiseValue(a))?.getTime() || 0
      const bTime = toDate(getPromiseValue(b))?.getTime() || 0
      return aTime - bTime
    })
}

export default function OverdueInbox() {
  const { orgId, loading: tenantLoading } = useTenant()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDeal, setDrawerDeal] = useState(null)

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Overdue Inbox'
    }
  }, [])

  useEffect(() => {
    let active = true

    const load = async () => {
      if (tenantLoading) return
      setLoading(true)
      setError('')

      try {
        const rangeStart = new Date('2000-01-01T00:00:00.000Z')
        const rangeEnd = new Date()
        rangeEnd.setDate(rangeEnd.getDate() + 1)

        const { items } = await getNeedsSchedulingPromiseItems({ orgId, rangeStart, rangeEnd })
        if (!active) return
        setRows(normalizeOverdueRows(items))
      } catch (e) {
        if (!active) return
        setError(e?.message || 'Failed to load overdue items')
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
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

  return (
    <AppLayout>
      <div className="mx-auto w-full max-w-7xl p-4 md:px-6">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-xl font-semibold text-foreground">Overdue Inbox</h1>
              <p className="text-sm text-muted-foreground">
                Overdue promised items waiting for delivery coordinator action.
              </p>
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

        <section className="mt-4 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
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
                    <th className="px-4 py-3">Promise</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Updated</th>
                    <th className="px-4 py-3">Overdue by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredRows.map((job) => {
                    const promise = getPromiseValue(job)
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
                        <td className="px-4 py-3 text-foreground">{formatDateTime(promise)}</td>
                        <td className="px-4 py-3 text-foreground">{status}</td>
                        <td className="px-4 py-3 text-foreground">{location}</td>
                        <td className="px-4 py-3 text-foreground">{formatDateTime(job?.updated_at)}</td>
                        <td className="px-4 py-3 font-medium text-red-700">{formatOverdueBy(promise)}</td>
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