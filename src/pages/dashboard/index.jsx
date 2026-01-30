import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AppLayout from '@/components/layouts/AppLayout'
import { calendarService } from '@/services/calendarService'
import { jobService } from '@/services/jobService'
import { claimsService } from '@/services/claimsService'
import { getAllDeals } from '@/services/dealService'
import { getOpenOpportunitySummary } from '@/services/opportunitiesService'
import { getDealFinancials } from '@/utils/dealKpis'
import { useAuth } from '@/contexts/AuthContext'

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

const KpiCard = ({ label, value, sublabel }) => (
  <div className="rounded-xl border bg-white p-4 shadow-sm">
    <div className="text-xs font-semibold tracking-wide text-gray-500 uppercase">{label}</div>
    <div className="mt-1 text-2xl font-bold text-gray-900 tabular-nums">{value}</div>
    {sublabel ? <div className="mt-1 text-xs text-gray-500">{sublabel}</div> : null}
  </div>
)

const DashboardPage = () => {
  const navigate = useNavigate()
  const { orgId } = useAuth()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [todayJobs, setTodayJobs] = useState([])
  const [jobsThroughTomorrow, setJobsThroughTomorrow] = useState([])
  const [mtdDeals, setMtdDeals] = useState([])
  const [todayDeals, setTodayDeals] = useState([])
  const [openClaims, setOpenClaims] = useState(null)
  const [openOppSummary, setOpenOppSummary] = useState(null)

  const refresh = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const [jobsTodayRes, jobsThroughTomorrowRes, jobsMtdRes, deals, claimsStats, oppSummary] =
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
        ])

      const jobsToday = Array.isArray(jobsTodayRes?.data) ? jobsTodayRes.data : []
      const jobsTT = Array.isArray(jobsThroughTomorrowRes?.data) ? jobsThroughTomorrowRes.data : []
      const jobsMtd = Array.isArray(jobsMtdRes?.data) ? jobsMtdRes.data : []
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

      setTodayJobs(jobsToday)
      setJobsThroughTomorrow(jobsTT)
      setTodayDeals(mappedTodayDeals)
      setMtdDeals(mappedMtdDeals)
      setOpenClaims(Number.isFinite(openClaimsCount) ? openClaimsCount : null)
      setOpenOppSummary(oppSummary && typeof oppSummary === 'object' ? oppSummary : null)
    } catch (e) {
      console.error('[dashboard] load failed', e)
      setError(e?.message || 'Failed to load dashboard')
      setTodayJobs([])
      setJobsThroughTomorrow([])
      setTodayDeals([])
      setMtdDeals([])
      setOpenClaims(null)
      setOpenOppSummary(null)
    } finally {
      setLoading(false)
    }
  }, [orgId])

  useEffect(() => {
    refresh()
  }, [refresh])

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
    openOpp:
      openOppSummary?.open_count == null ? '—' : String(Number(openOppSummary.open_count) || 0),
    openClaims: openClaims == null ? '—' : String(openClaims),
  }

  const openOppSublabel = openOppSummary
    ? `${Number(openOppSummary.open_deals_count) || 0} deals • ${money0OrDash(openOppSummary.open_amount)} pipeline`
    : 'Not available'

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
              onClick={() => navigate(SIMPLE_AGENDA_ENABLED ? '/calendar/agenda' : '/calendar')}
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

        <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard
            label="Scheduled (Today+Tomorrow)"
            value={kpiValue.scheduledTodayTomorrow}
            sublabel={`Today: ${scheduledToday}`}
          />
          <KpiCard
            label="Rev Today"
            value={kpiValue.revenueToday}
            sublabel={`MTD: ${kpiValue.revenueMtd}`}
          />
          <KpiCard
            label="Profit Today"
            value={kpiValue.profitToday}
            sublabel={
              todayFinancials.hasUnknownProfit
                ? 'Missing cost on at least one deal'
                : `MTD: ${kpiValue.profitMtd}`
            }
          />
          <KpiCard label="Open Opp" value={kpiValue.openOpp} sublabel={openOppSublabel} />
          <KpiCard label="Open Claims" value={kpiValue.openClaims} />
        </div>

        <div className="mt-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
          <div className="min-w-0">
            <div className="rounded-xl border bg-white shadow-sm">
              <div className="flex items-center justify-between gap-4 p-4 border-b">
                <div>
                  <div className="text-sm font-semibold text-gray-900">Today’s Schedule</div>
                  <div className="text-xs text-gray-600">
                    Agenda-style queue for jobs scheduled today
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(SIMPLE_AGENDA_ENABLED ? '/calendar/agenda' : '/calendar')}
                  className="px-3 py-2 rounded bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                >
                  Open Agenda
                </button>
              </div>

              {loading ? (
                <div className="p-4 text-sm text-gray-600">Loading…</div>
              ) : todayJobs.length === 0 ? (
                <div className="p-10 text-center">
                  <div className="text-sm font-medium text-gray-900">No jobs scheduled today</div>
                  <div className="mt-1 text-sm text-gray-600">
                    Use the Scheduling Board to book work.
                  </div>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => navigate('/calendar-flow-management-center')}
                      className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                    >
                      Open Scheduling Board
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
                      const am = Date.parse(a?.scheduled_start_time || '')
                      const bm = Date.parse(b?.scheduled_start_time || '')
                      return (Number.isFinite(am) ? am : 0) - (Number.isFinite(bm) ? bm : 0)
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
                                  {timeLabel} •{' '}
                                  {job?.vendor_name || (job?.vendor_id ? 'Vendor' : 'On-site')} •{' '}
                                  {job?.vehicle_info || ''}
                                </div>
                              </div>
                              <div className="flex flex-wrap items-center gap-1 justify-end">
                                {loaner ? (
                                  <Pill className="border-slate-200 bg-slate-50 text-slate-800">
                                    Loaner
                                  </Pill>
                                ) : null}
                                {hasMissingCost ? (
                                  <Pill className="border-amber-200 bg-amber-50 text-amber-900">
                                    Cost missing
                                  </Pill>
                                ) : profit != null ? (
                                  <Pill
                                    className={
                                      profit >= 0
                                        ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                                        : 'border-rose-200 bg-rose-50 text-rose-900'
                                    }
                                  >
                                    {profit >= 0 ? 'Profit' : 'Loss'}
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
                              onClick={() => navigate('/calendar-flow-management-center')}
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
                  onClick={() => navigate('/calendar-flow-management-center')}
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

            <div className="rounded-xl border bg-white p-4 shadow-sm">
              <div className="text-sm font-semibold text-gray-900">Notes</div>
              <div className="mt-2 text-xs text-gray-600">
                Rev/Profit Today are computed from today’s scheduled jobs matched against the Deals
                dataset.
              </div>
              <div className="mt-1 text-xs text-gray-600">
                Open Opp reflects open opportunities across all jobs. Pipeline is computed as the
                sum of quantity × unit price where unit price is present.
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default DashboardPage
