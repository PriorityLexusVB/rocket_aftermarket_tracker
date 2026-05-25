import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { openCalendar } from '@/lib/navigation/calendarNavigation'
import AppLayout from '@/components/layouts/AppLayout'
import { calendarService } from '@/services/calendarService'
import { jobService } from '@/services/jobService'
import { claimsService } from '@/services/claimsService'
import { getAllDeals } from '@/services/dealService'
import { getOpenOpportunitySummary, listOpenCountsByJobIds } from '@/services/opportunitiesService'
import { getDealFinancials } from '@/utils/dealKpis'
import { useAuth } from '@/contexts/AuthContext'
import { handleAuthError, isTechNoiseMessage } from '@/lib/authErrorHandler'
import { getPromiseIso, isOverdueJob } from '@/services/scheduleItemsService'
import { supabase } from '@/lib/supabase'

const SIMPLE_AGENDA_ENABLED =
  String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

const startOfToday = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const endOfToday = () => {
  const d = new Date()
  d.setHours(23, 59, 59, 999)
  return d
}

const endOfTomorrow = () => {
  const d = new Date()
  d.setDate(d.getDate() + 1)
  d.setHours(23, 59, 59, 999)
  return d
}

const startOfMonth = () => {
  const d = new Date()
  d.setDate(1)
  d.setHours(0, 0, 0, 0)
  return d
}

const toFiniteNumberOrNull = (value) => {
  if (value == null) return null
  const num = typeof value === 'number' ? value : Number.parseFloat(value)
  return Number.isFinite(num) ? num : null
}

const Pill = ({ children, className = '' }) => (
  <span
    className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium border ${className}`}
  >
    {children}
  </span>
)

const KpiCard = ({ label, value, sublabel, href, ariaLabel }) => {
  const body = (
    <>
      <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</div>
      <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
      {sublabel ? <div className="mt-1 text-xs text-gray-500">{sublabel}</div> : null}
    </>
  )
  if (href) {
    return (
      <Link
        to={href}
        aria-label={ariaLabel || label}
        className="block rounded-xl border bg-white p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {body}
      </Link>
    )
  }
  return <div className="rounded-xl border bg-white p-4 shadow-sm">{body}</div>
}

const DashboardPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const { orgId } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [todayJobs, setTodayJobs] = useState([])
  const [jobsThroughTomorrow, setJobsThroughTomorrow] = useState([])
  const [mtdDeals, setMtdDeals] = useState([])
  const [todayDeals, setTodayDeals] = useState([])
  const [openClaims, setOpenClaims] = useState(null)
  const [openOppSummary, setOpenOppSummary] = useState(null)
  const [openOppByJobId, setOpenOppByJobId] = useState({})
  const openOppByJobIdRef = useRef({})
  const [crossDayOverdueCount, setCrossDayOverdueCount] = useState(0)
  // Wave XXX-E (2/3): replaced the dead "Pending Approvals" KPI with "Needs Schedule"
  const [needsSchedule, setNeedsSchedule] = useState({ total: 0, vendor: 0, inhouse: 0 })
  // Wave XXX-P: persistent Overdue tile on the strip (was only conditional rose card)
  const [overdueData, setOverdueData] = useState({ count: 0, oldestDays: 0 })

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      setOpenOppByJobId({})

      // Wave XXX-M: fetch jobs whose promised_date is today but have no
      // scheduled_start_time. Without this, "promised today" in-house jobs
      // (e.g., the Thursday rust-proofing case) never appear on the dashboard.
      const todayStartIso = startOfToday().toISOString()
      const todayEndIso = endOfToday().toISOString()

      const [jobsTodayRes, jobsThroughTomorrowRes, jobsMtdRes, deals, claimsStats, oppSummary, overdueCountRes, needsScheduleRes, overdueWithOldestRes, promisedTodayRes] =
        await Promise.all([
          calendarService.getJobsByDateRange(startOfToday(), endOfToday(), {
            orgId: orgId || null,
          }),
          calendarService.getJobsByDateRange(startOfToday(), endOfTomorrow(), {
            orgId: orgId || null,
          }),
          calendarService.getJobsByDateRange(startOfMonth(), endOfToday(), {
            orgId: orgId || null,
          }),
          getAllDeals(),
          claimsService.getClaimsStats(orgId || null),
          getOpenOpportunitySummary().catch(() => null),
          // PostgrestFilterBuilder is thenable but NOT a Promise — it has `.then`
          // but no `.catch`. Wave XXVII shipped this with `.catch(() => null)`
          // which threw a TypeError on EVERY dashboard load (live since 1dd3a44).
          // Wave XXIX-C fixed the .catch but exposed a SECOND Wave XXVII bug:
          // the not-in list included `canceled` (American spelling) and
          // `no_show` — NEITHER of those is a valid `job_status` enum value.
          // The valid enum is: pending, in_progress, completed, cancelled (BR),
          // scheduled, quality_check, delivered, draft. PostgREST returned 400
          // on every dashboard load. Wave XXIX-E uses only valid done-states.
          supabase
            .from('jobs')
            .select('id', { count: 'exact', head: true })
            .lt('promised_date', startOfToday().toISOString())
            .not('job_status', 'in', '(completed,cancelled,delivered)')
            .then((r) => r, () => null),
          calendarService.getNeedsScheduleStats(orgId || null),
          // Wave XXX-P: overdue count + oldest-days for the new Overdue tile
          calendarService.getOverdueWithOldest(orgId || null),
          // Promise-only-today jobs: promised today, no scheduled time. Get the
          // vehicle relation so the row renders the same shape as scheduled jobs.
          supabase
            .from('jobs')
            .select('id, title, customer_name, vendor_id, vendor_name, vehicle_id, vehicle_info, scheduled_start_time, scheduled_end_time, promised_date, job_status, vehicle:vehicles(year, make, model, stock_number, owner_name)')
            .gte('promised_date', todayStartIso)
            .lte('promised_date', todayEndIso)
            .is('scheduled_start_time', null)
            .not('job_status', 'in', '(completed,cancelled,delivered,draft,no_show)')
            .then((r) => r, () => null),
        ])

      setNeedsSchedule(needsScheduleRes?.data || { total: 0, vendor: 0, inhouse: 0 })
      setOverdueData(overdueWithOldestRes?.data || { count: 0, oldestDays: 0 })

      const jobsToday = Array.isArray(jobsTodayRes?.data) ? jobsTodayRes.data : []
      const jobsTT = Array.isArray(jobsThroughTomorrowRes?.data) ? jobsThroughTomorrowRes.data : []
      const jobsMtd = Array.isArray(jobsMtdRes?.data) ? jobsMtdRes.data : []
      // Wave XXX-M: merge promise-only-today jobs into the today list. Dedupe by id
      // (a job that's both scheduled today AND promised today should appear once).
      const promisedTodayRows = Array.isArray(promisedTodayRes?.data) ? promisedTodayRes.data : []
      const todayIds = new Set(jobsToday.map((j) => j?.id))
      const promisedOnlyToday = promisedTodayRows
        .filter((j) => !todayIds.has(j?.id))
        .map((j) => ({ ...j, _promiseOnly: true }))
      const todayJobsCombined = [...jobsToday, ...promisedOnlyToday]
      const safeDeals = Array.isArray(deals) ? deals : []

      const dealById = new Map(safeDeals.map((d) => [d?.id, d]))
      const mappedTodayDeals = jobsToday.map((j) => dealById.get(j?.id)).filter(Boolean)
      const mappedMtdDeals = jobsMtd.map((j) => dealById.get(j?.id)).filter(Boolean)

      const closedStatuses = new Set(['resolved', 'closed', 'completed', 'denied'])
      const byStatus = claimsStats?.byStatus || {}
      const openClaimsCount = Object.entries(byStatus).reduce((sum, [status, count]) => {
        const key = String(status || '').toLowerCase()
        if (!key) return sum
        if (closedStatuses.has(key)) return sum
        return sum + (Number.isFinite(Number(count)) ? Number(count) : 0)
      }, 0)

      setTodayJobs(todayJobsCombined)
      setJobsThroughTomorrow(jobsTT)
      setTodayDeals(mappedTodayDeals)
      setMtdDeals(mappedMtdDeals)
      setOpenClaims(Number.isFinite(openClaimsCount) ? openClaimsCount : null)
      setOpenOppSummary(oppSummary && typeof oppSummary === 'object' ? oppSummary : null)
      setCrossDayOverdueCount(Number(overdueCountRes?.count) || 0)
    } catch (e) {
      console.error('[dashboard] load failed', e)
      // If this is a real auth failure (stale JWT, etc.), redirect to /auth.
      // RLS/permission denials are NOT redirected — they keep their friendly message.
      if (handleAuthError(e)) return
      const raw = String(e?.message || '')
      setError(
        isTechNoiseMessage(raw)
          ? "Couldn't load dashboard. Please refresh the page. If the problem continues, contact support."
          : raw || 'Failed to load dashboard'
      )
      setTodayJobs([])
      setJobsThroughTomorrow([])
      setTodayDeals([])
      setMtdDeals([])
      setOpenClaims(null)
      setOpenOppSummary(null)
      setCrossDayOverdueCount(0)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Keep the ref current so the bulk-fetch effect can read the latest map
  // without listing it as a dependency (which would cause a fetch loop).
  useEffect(() => {
    openOppByJobIdRef.current = openOppByJobId
  }, [openOppByJobId])

  useEffect(() => {
    let alive = true
    const ids = todayJobs.map((j) => j?.id).filter(Boolean)
    const missing = ids.filter((id) => openOppByJobIdRef.current[id] == null)
    if (!missing.length) return () => {}
    ;(async () => {
      const counts = await listOpenCountsByJobIds(missing)
      if (!alive) return
      setOpenOppByJobId((prev) => ({ ...prev, ...counts }))
    })()
    return () => { alive = false }
  }, [todayJobs])

  const todayFinancials = useMemo(() => {
    let revenue = 0
    let profit = 0
    let hasUnknownProfit = false

    for (const deal of todayDeals) {
      const fin = getDealFinancials(deal)
      const sale = toFiniteNumberOrNull(fin?.sale)
      const p = toFiniteNumberOrNull(fin?.profit)

      if (sale != null) revenue += sale
      if (sale != null && p == null) hasUnknownProfit = true
      if (p != null) profit += p
    }

    return {
      revenue: Number.isFinite(revenue) ? revenue : 0,
      profit: hasUnknownProfit ? null : Number.isFinite(profit) ? profit : 0,
      hasUnknownProfit,
    }
  }, [todayDeals])

  const mtdFinancials = useMemo(() => {
    let revenue = 0
    let profit = 0
    let hasUnknownProfit = false

    for (const deal of mtdDeals) {
      const fin = getDealFinancials(deal)
      const sale = toFiniteNumberOrNull(fin?.sale)
      const p = toFiniteNumberOrNull(fin?.profit)

      if (sale != null) revenue += sale
      if (sale != null && p == null) hasUnknownProfit = true
      if (p != null) profit += p
    }

    return {
      revenue: Number.isFinite(revenue) ? revenue : 0,
      profit: hasUnknownProfit ? null : Number.isFinite(profit) ? profit : 0,
      hasUnknownProfit,
    }
  }, [mtdDeals])

  const scheduledToday = todayJobs.length
  const scheduledTodayTomorrow = jobsThroughTomorrow.length

  const handleComplete = useCallback(
    async (jobId) => {
      if (!jobId) return
      try {
        await jobService.updateStatus(jobId, 'completed', {
          completed_at: new Date().toISOString(),
        })
        await refresh()
      } catch (e) {
        console.error('[dashboard] complete failed', e)
        setError(e?.message || 'Failed to complete job')
      }
    },
    [refresh]
  )

  const topPriority = useMemo(() => {
    const todayOverdue = todayJobs
      .filter((j) => isOverdueJob(j))
      .sort((a, b) => {
        const ap = Date.parse(getPromiseIso(a) || '') || 0
        const bp = Date.parse(getPromiseIso(b) || '') || 0
        return ap - bp
      })
    if (todayOverdue.length > 0) {
      const job = todayOverdue[0]
      const deal = todayDeals.find((d) => d?.id === job?.id) || null
      return { kind: 'overdue', job, deal, count: todayOverdue.length }
    }
    // Branch 2: no overdue jobs on today's schedule, but there are overdue jobs from prior days
    if (todayJobs.length === 0 && crossDayOverdueCount > 0) {
      return { kind: 'cross-day', count: crossDayOverdueCount }
    }
    return null
  }, [todayJobs, todayDeals, crossDayOverdueCount])

  const money0 = useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }),
    []
  )

  const money0OrDash = (value) => {
    if (value == null) return '—'
    const num = toFiniteNumberOrNull(value)
    if (num == null) return '—'
    return money0.format(num)
  }

  const kpiValue = {
    scheduledTodayTomorrow: String(scheduledTodayTomorrow),
    revenueToday: money0OrDash(todayFinancials.revenue),
    profitToday: todayFinancials.hasUnknownProfit ? '—' : money0OrDash(todayFinancials.profit),
    revenueMtd: money0OrDash(mtdFinancials.revenue),
    profitMtd: mtdFinancials.hasUnknownProfit ? '—' : money0OrDash(mtdFinancials.profit),
    openOpp: money0OrDash(openOppSummary?.open_amount),
    openClaims: openClaims == null ? '—' : String(openClaims),
  }

  const openOppSublabel = openOppSummary
    ? `${Number(openOppSummary.open_deals_count) || 0} deals • ${Number(openOppSummary.open_count) || 0} ${Number(openOppSummary.open_count) === 1 ? 'open item' : 'open items'}`
    : '—'

  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <div className="mt-1 text-sm text-gray-600">Today at a glance</div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={refresh}
              className="px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
              disabled={loading}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={() => {
                openCalendar({
                  navigate,
                  target: SIMPLE_AGENDA_ENABLED ? 'agenda' : 'calendar',
                  source: 'Dashboard.OpenCalendar',
                  context: { from: `${location?.pathname || ''}${location?.search || ''}` },
                })
              }}
              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
            >
              Open Calendar
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        {/* Wave XXX-P: redesigned KPI strip. Priority order:
            1) Overdue (action) — was buried in conditional cards
            2) Needs Schedule (action) — kept, best tile
            3) Today (operational) — was "Today & Tomorrow", flipped so today is prime
            4) MTD Revenue (trending) — was "Today", flipped so MTD is prime
            5) MTD Profit (trending) — same flip
            Cut: Open Claims (1 row total in prod; future guest-submission module
            lives on the Claims page where it belongs). */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Overdue"
            value={String(overdueData.count)}
            sublabel={
              overdueData.count > 0
                ? `Oldest ${overdueData.oldestDays}d${overdueData.oldestDays >= 30 ? ' — investigate' : ''}`
                : 'All clear'
            }
            href={overdueData.count > 0 ? '/overdue' : null}
            ariaLabel={
              overdueData.count > 0
                ? `${overdueData.count} overdue jobs — open list`
                : undefined
            }
          />
          <KpiCard
            label="Needs Schedule"
            value={String(needsSchedule.total)}
            sublabel={
              needsSchedule.total > 0
                ? `${needsSchedule.vendor} vendor · ${needsSchedule.inhouse} in-house`
                : 'All set'
            }
            href={needsSchedule.total > 0 ? '/deals?presetView=Needs%20Schedule' : null}
            ariaLabel={
              needsSchedule.total > 0
                ? `${needsSchedule.total} jobs need scheduling — open list`
                : undefined
            }
          />
          <KpiCard
            label="Today"
            value={String(scheduledToday)}
            sublabel={`Tomorrow: ${Math.max(0, Number(kpiValue.scheduledTodayTomorrow || 0) - Number(scheduledToday || 0))}`}
          />
          <KpiCard
            label="MTD Revenue"
            value={kpiValue.revenueMtd}
            sublabel={`Today: ${kpiValue.revenueToday}`}
          />
          <KpiCard
            label="MTD Profit"
            value={kpiValue.profitMtd}
            sublabel={`Today: ${kpiValue.profitToday}`}
          />
        </div>

        {/* Wave XXX-P: Cost-Missing warning promoted from sublabel-tiny-text
            to a visible pill above the body. Tells Rob explicitly which deals
            need attention. */}
        {todayFinancials.hasUnknownProfit ? (
          <div className="mt-3 inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-900">
            <span aria-hidden="true">⚠</span>
            Cost missing on one or more of today's deals — profit estimates may be incomplete.
          </div>
        ) : null}

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
          <div className="min-w-0">
            {topPriority?.kind === 'overdue' ? (() => {
              const { job, count } = topPriority
              const rawDate = getPromiseIso(job)
              const promisedDate = rawDate ? new Date(rawDate) : null
              const promisedLabel =
                promisedDate && !Number.isNaN(promisedDate.getTime())
                  ? promisedDate.toLocaleDateString('en-US', {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    }) +
                    (promisedDate.getHours() !== 0 || promisedDate.getMinutes() !== 0
                      ? ' ' +
                        promisedDate.toLocaleTimeString('en-US', {
                          hour: 'numeric',
                          minute: '2-digit',
                        })
                      : '')
                  : null
              return (
                <div className="mb-6 rounded-xl border border-rose-300 bg-rose-50 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-rose-100 p-2 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-rose-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-wide text-rose-700">
                        Most urgent ·{' '}
                        {count > 1 ? `${count} overdue today` : '1 overdue today'}
                      </div>
                      <h2 className="mt-0.5 text-lg font-semibold text-rose-900 truncate">
                        {job?.customer_name || job?.vehicle?.owner_name || job?.title || 'Overdue job'}
                      </h2>
                      <div className="mt-0.5 text-sm text-rose-800 truncate">
                        {job?.vehicle_info || '—'}
                        {promisedLabel ? ` · Promised ${promisedLabel}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/deals/${job?.id}/edit`)}
                        className="px-3 py-2 rounded bg-rose-600 text-white hover:bg-rose-700 text-sm font-medium transition-colors"
                      >
                        Open Deal
                      </button>
                    </div>
                  </div>
                </div>
              )
            })() : topPriority?.kind === 'cross-day' ? (() => {
              const { count } = topPriority
              return (
                <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-sm">
                  <div className="flex items-start gap-3">
                    <div className="rounded-full bg-amber-100 p-2 shrink-0">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5 text-amber-600"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <polyline points="12 6 12 12 16 14" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-mono uppercase tracking-wide text-amber-700">
                        Catch up
                      </div>
                      <h2 className="mt-0.5 text-lg font-semibold text-amber-900 truncate">
                        {count} {count === 1 ? 'job' : 'jobs'} overdue from prior days
                      </h2>
                      <div className="mt-0.5 text-sm text-amber-800 truncate">
                        Today&apos;s board is clear — work the Overdue Inbox.
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => navigate('/overdue')}
                        className="px-3 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 text-sm font-medium transition-colors"
                      >
                        Open Overdue Inbox
                      </button>
                    </div>
                  </div>
                </div>
              )
            })() : null}
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 p-4 border-b">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Today’s Schedule</div>
                  <div className="text-xs text-gray-600">
                    Jobs on the board for today
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    openCalendar({
                      navigate,
                      target: SIMPLE_AGENDA_ENABLED ? 'agenda' : 'calendar',
                      source: 'Dashboard.QuickActions.OpenAgenda',
                      context: { from: `${location?.pathname || ''}${location?.search || ''}` },
                    })
                  }}
                  className="px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                >
                  Open Agenda
                </button>
              </div>

              {loading ? (
                <div className="p-4 text-sm text-gray-600">Loading today’s schedule…</div>
              ) : todayJobs.length === 0 ? (
                <div className="p-4">
                  <div className="text-sm text-gray-600">No appointments scheduled for today.</div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        openCalendar({
                          navigate,
                          target: SIMPLE_AGENDA_ENABLED ? 'agenda' : 'flow',
                          source: SIMPLE_AGENDA_ENABLED
                            ? 'Dashboard.QuickActions.OpenAgenda'
                            : 'Dashboard.QuickActions.OpenSchedulingBoard',
                          context: { from: `${location?.pathname || ''}${location?.search || ''}` },
                        })
                      }}
                      className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      {SIMPLE_AGENDA_ENABLED ? 'Open Agenda' : 'Open Scheduling Board'}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/deals')}
                      className="px-4 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                    >
                      Open Deals
                    </button>
                  </div>
                </div>
              ) : (
                <div className="divide-y">
                  {todayJobs
                    .slice()
                    .sort((a, b) => {
                      // Scheduled jobs first (by time), then promise-only at the end.
                      const am = Date.parse(a?.scheduled_start_time || '')
                      const bm = Date.parse(b?.scheduled_start_time || '')
                      const aHas = Number.isFinite(am)
                      const bHas = Number.isFinite(bm)
                      if (aHas && !bHas) return -1
                      if (!aHas && bHas) return 1
                      if (!aHas && !bHas) return 0
                      return am - bm
                    })
                    .map((job) => {
                      const deal = todayDeals.find((d) => d?.id === job?.id) || null
                      const fin = deal ? getDealFinancials(deal) : null
                      const hasMissingCost = deal ? fin?.sale != null && fin?.cost == null : false
                      const profit = toFiniteNumberOrNull(fin?.profit)

                      const start = job?.scheduled_start_time
                        ? new Date(job.scheduled_start_time)
                        : null
                      const timeLabel =
                        start && !Number.isNaN(start.getTime())
                          ? start.toLocaleTimeString('en-US', {
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'Time TBD'

                      // Wave XXX-M: show promise context when meaningful.
                      // - Promise-only-today (no scheduled time) → "Promised today"
                      // - Scheduled today but promised LATER → "Promised Wed" (multi-day)
                      // - Scheduled today and promised today → nothing extra (the common case)
                      const promiseDateRaw = job?.promised_date
                      let promiseLabel = null
                      if (promiseDateRaw) {
                        const promise = new Date(promiseDateRaw)
                        if (!Number.isNaN(promise.getTime())) {
                          const today = new Date()
                          const sameDay = promise.toDateString() === today.toDateString()
                          if (job?._promiseOnly) {
                            promiseLabel = sameDay ? 'Promised today' : `Promised ${promise.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                          } else if (start && promise.toDateString() !== start.toDateString()) {
                            promiseLabel = `Promised ${promise.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}`
                          }
                        }
                      }

                      const loaner = deal?.loaner_number || deal?.loaner_id || deal?.loaner_assigned

                      return (
                        <div
                          key={job?.calendar_key || job?.id}
                          className="p-4 flex flex-col sm:flex-row sm:items-center gap-3"
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-semibold text-gray-900 truncate">
                                  {job?.title || 'Open deal'}
                                </div>
                                <div className="mt-0.5 text-xs text-gray-600 truncate">
                                  {timeLabel}
                                  {promiseLabel ? (
                                    <span className="text-amber-700 font-medium"> · {promiseLabel}</span>
                                  ) : null}
                                  {' • '}
                                  {job?.customer_name || job?.vehicle?.owner_name || '—'} •{' '}
                                  {job?.vehicle_info || ''}
                                  {job?.vehicle?.stock_number ? ` · #${job.vehicle.stock_number}` : ''}
                                </div>
                                <div className="mt-0.5 text-[11px] text-gray-500 truncate">
                                  Location: {job?.vendor_name || (job?.vendor_id ? 'Vendor' : 'In-House')}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 justify-end">
                                {isOverdueJob(job) ? (
                                  <Pill className="border-rose-300 bg-rose-50 text-rose-900">
                                    Overdue
                                  </Pill>
                                ) : null}
                                {loaner ? (
                                  <Pill className="border-slate-200 bg-slate-50 text-slate-800">
                                    Loaner
                                  </Pill>
                                ) : null}
                                {openOppByJobId[job?.id] > 0 ? (
                                  <Pill className="border-violet-200 bg-violet-50 text-violet-900">
                                    {openOppByJobId[job?.id]} {openOppByJobId[job?.id] === 1 ? 'Pending Approval' : 'Pending Approvals'}
                                  </Pill>
                                ) : null}
                                {hasMissingCost ? (
                                  <Pill className="border-amber-200 bg-amber-50 text-amber-900">
                                    Cost missing
                                  </Pill>
                                ) : profit != null ? (
                                  <Pill
                                    title="Estimated gross profit"
                                    className={
                                      profit >= 0
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                        : 'border-rose-200 bg-rose-50 text-rose-900'
                                    }
                                  >
                                    Profit {money0OrDash(profit)}
                                  </Pill>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/deals/${job?.id}/edit`)}
                              className="px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                            >
                              View
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openCalendar({
                                  navigate,
                                  target: SIMPLE_AGENDA_ENABLED ? 'agenda' : 'flow',
                                  source: SIMPLE_AGENDA_ENABLED
                                    ? 'Dashboard.Reschedule.ToAgenda'
                                    : 'Dashboard.Reschedule.ToSchedulingBoard',
                                  context: {
                                    from: `${location?.pathname || ''}${location?.search || ''}`,
                                    jobId: job?.id,
                                    focusId: job?.id,
                                  },
                                })
                              }}
                              className="px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                            >
                              Reschedule
                            </button>
                            <button
                              type="button"
                              onClick={() => handleComplete(job?.id)}
                              className="px-3 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                            >
                              Complete
                            </button>
                          </div>
                        </div>
                      )
                    })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Quick Links</div>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/deals')}
                  className="w-full px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors text-left"
                >
                  Deals
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/advanced-business-intelligence-analytics')}
                  className="w-full px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors text-left"
                >
                  Analytics
                </button>
                <button
                  type="button"
                  onClick={() => {
                    openCalendar({
                      navigate,
                      target: 'flow',
                      source: 'Dashboard.QuickLinks.SchedulingBoard',
                      context: { from: `${location?.pathname || ''}${location?.search || ''}` },
                    })
                  }}
                  className="w-full px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors text-left"
                >
                  Scheduling Board
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/claims-management-center')}
                  className="w-full px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors text-left"
                >
                  Claims
                </button>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default DashboardPage
