import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, Info, MoreVertical, Plus, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppLayout from '@/components/layouts/AppLayout'
import CalendarSchedulingCenter from '@/pages/calendar'
import CalendarFlowManagementCenter from '@/pages/calendar-flow-management-center'
import CalendarAgenda from '@/pages/calendar-agenda'
import DealDrawer from '@/components/calendar/DealDrawer'
import {
  buildCalendarSearchParams,
  parseCalendarQuery,
  parseCalendarDateParam,
} from '@/lib/navigation/calendarNavigation'
import { isCalendarDealDrawerEnabled, isCalendarUnifiedShellEnabled } from '@/config/featureFlags'
import { LOCATION_FILTER_OPTIONS } from '@/utils/locationType'

const SIMPLE_AGENDA_ENABLED =
  String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

const RANGE_OPTIONS = [
  { value: 'day', label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'next7', label: 'Next 7' },
  { value: 'next30', label: 'Next 30' },
]

const RANGE_OPTIONS_BY_VIEW = {
  calendar: new Set(['day', 'week', 'month']),
  board: new Set(['day', 'week', 'next7', 'next30']),
  list: new Set(['day', 'week', 'next7', 'next30']),
}

const getAllowedRangesForView = (view) =>
  RANGE_OPTIONS_BY_VIEW?.[view] || RANGE_OPTIONS_BY_VIEW.board

function formatDateLabel(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function shiftDate(baseDate, range, direction) {
  const date = baseDate instanceof Date ? new Date(baseDate) : new Date()
  if (Number.isNaN(date.getTime())) return new Date()

  switch (range) {
    case 'week':
      date.setDate(date.getDate() + 7 * direction)
      break
    case 'month':
      date.setMonth(date.getMonth() + direction)
      break
    case 'next7':
      date.setDate(date.getDate() + 7 * direction)
      break
    case 'next30':
      date.setDate(date.getDate() + 30 * direction)
      break
    case 'day':
    default:
      date.setDate(date.getDate() + 1 * direction)
      break
  }

  return date
}

export default function CalendarShell() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [searchValue, setSearchValue] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDeal, setDrawerDeal] = useState(null)

  const {
    view,
    range,
    date,
    location: locationFilter,
    normalizedParams,
  } = useMemo(() => parseCalendarQuery(searchParams), [searchParams])

  const agendaEnabled = SIMPLE_AGENDA_ENABLED || isCalendarUnifiedShellEnabled()
  const dealDrawerEnabled = isCalendarDealDrawerEnabled()
  const resolvedView = view === 'list' && !agendaEnabled ? 'board' : view
  const allowedRanges = useMemo(() => getAllowedRangesForView(resolvedView), [resolvedView])
  const clampedRange = useMemo(
    () => (allowedRanges.has(range) ? range : 'week'),
    [allowedRanges, range]
  )
  const rangeOptions = useMemo(
    () => RANGE_OPTIONS.filter((option) => allowedRanges.has(option.value)),
    [allowedRanges]
  )

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.title = 'Calendar'
    }
  }, [])

  useEffect(() => {
    const normalized = normalizedParams?.toString?.() || ''
    const current = searchParams?.toString?.() || ''
    if (normalized && normalized !== current) {
      setSearchParams(normalizedParams, { replace: true })
    }
  }, [normalizedParams, searchParams, setSearchParams])

  useEffect(() => {
    if (resolvedView !== view) {
      const currentQuery = searchParams.get('q') || ''
      const nextParams = buildCalendarSearchParams({
        view: resolvedView,
        range: clampedRange,
        date,
        q: currentQuery,
        location: locationFilter,
      })
      setSearchParams(nextParams, { replace: true })
    }
  }, [resolvedView, view, clampedRange, date, searchParams, setSearchParams, locationFilter])

  const updateParams = useCallback(
    (next) => {
      const currentQuery = searchParams.get('q') || ''
      const nextParams = buildCalendarSearchParams({
        view: next?.view ?? resolvedView,
        range: next?.range ?? clampedRange,
        date: next?.date ?? date,
        q: currentQuery,
        location: next?.location ?? locationFilter,
      })
      setSearchParams(nextParams)
    },
    [resolvedView, clampedRange, date, searchParams, setSearchParams, locationFilter]
  )

  useEffect(() => {
    if (!allowedRanges.has(range)) {
      updateParams({ range: clampedRange })
    }
  }, [allowedRanges, range, clampedRange, updateParams])

  const handleViewChange = (nextView) => {
    updateParams({ view: nextView })
  }

  const handleRangeChange = (event) => {
    const nextRange = event?.target?.value
    const resolvedRange = allowedRanges.has(nextRange) ? nextRange : 'week'
    updateParams({ range: resolvedRange })
  }

  const handleDateInput = (event) => {
    const nextDate = parseCalendarDateParam(event?.target?.value) || new Date()
    updateParams({ date: nextDate })
  }

  const handleLocationChange = (event) => {
    const nextLocation = event?.target?.value || 'All'
    updateParams({ location: nextLocation })
  }

  const handlePrev = () => updateParams({ date: shiftDate(date, clampedRange, -1) })
  const handleNext = () => updateParams({ date: shiftDate(date, clampedRange, 1) })
  const handleToday = () => updateParams({ date: new Date() })

  const dateLabel = formatDateLabel(date)
  const dateValue = parseCalendarDateParam(searchParams.get('date'))
  const dateInputValue = dateValue ? searchParams.get('date') : ''

  const shellState = useMemo(() => ({ range: clampedRange, date }), [clampedRange, date])
  const handleOpenDealDrawer = useCallback(
    (deal) => {
      if (!dealDrawerEnabled) return
      setDrawerDeal(deal || null)
      setDrawerOpen(true)
    },
    [dealDrawerEnabled]
  )

  const handleCloseDealDrawer = useCallback(() => {
    setDrawerOpen(false)
  }, [])

  const viewContent = useMemo(() => {
    if (resolvedView === 'calendar') {
      return (
        <CalendarSchedulingCenter
          embedded
          shellState={shellState}
          locationFilter={locationFilter}
          onOpenDealDrawer={dealDrawerEnabled ? handleOpenDealDrawer : undefined}
        />
      )
    }

    if (resolvedView === 'list') {
      return agendaEnabled ? (
        <CalendarAgenda
          embedded
          shellState={shellState}
          locationFilter={locationFilter}
          onOpenDealDrawer={dealDrawerEnabled ? handleOpenDealDrawer : undefined}
        />
      ) : (
        <div className="rounded-lg border border-slate-200 bg-white p-6 text-sm text-slate-600">
          List view is unavailable in this environment.
        </div>
      )
    }

    return (
      <CalendarFlowManagementCenter
        embedded
        shellState={shellState}
        locationFilter={locationFilter}
        onOpenDealDrawer={dealDrawerEnabled ? handleOpenDealDrawer : undefined}
      />
    )
  }, [
    resolvedView,
    agendaEnabled,
    shellState,
    dealDrawerEnabled,
    handleOpenDealDrawer,
    locationFilter,
  ])

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 p-4">
        <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-slate-900">Calendar</h1>
              <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
                {[
                  { key: 'board', label: 'Board' },
                  { key: 'calendar', label: 'Calendar' },
                  { key: 'list', label: 'List', disabled: !agendaEnabled },
                ].map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleViewChange(item.key)}
                    disabled={item.disabled}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      resolvedView === item.key
                        ? 'bg-slate-900 text-white'
                        : 'bg-white text-slate-600 hover:bg-slate-100'
                    } ${item.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="rounded-md px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-md p-1 text-slate-600 hover:bg-slate-100"
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium text-slate-700">{dateLabel}</span>
                <input
                  type="date"
                  value={dateInputValue}
                  onChange={handleDateInput}
                  className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                  aria-label="Pick a date"
                />
              </div>

              <select
                value={clampedRange}
                onChange={handleRangeChange}
                className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                aria-label="Select date range"
              >
                {rangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="relative">
                <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search stock/customer/phone"
                  className="h-8 w-56 rounded-md border border-slate-200 bg-white pl-8 pr-2 text-xs text-slate-700"
                  aria-label="Search calendar"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
              </div>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700">
                  <Filter className="h-4 w-4" /> Filters
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
                  <label
                    className="block text-[11px] font-semibold text-slate-500"
                    htmlFor="calendar-location-filter"
                  >
                    Location
                  </label>
                  <select
                    id="calendar-location-filter"
                    className="mt-2 h-8 w-full rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700"
                    value={locationFilter || 'All'}
                    onChange={handleLocationChange}
                  >
                    {LOCATION_FILTER_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
              </details>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center rounded-md border border-slate-200 bg-white p-2 text-slate-600">
                  <Info className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-600 shadow-lg">
                  Legend coming soon.
                </div>
              </details>

              <button
                type="button"
                onClick={() => navigate('/deals/new')}
                className="inline-flex items-center gap-2 rounded-md bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
              >
                <Plus className="h-4 w-4" /> New Deal
              </button>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center rounded-md border border-slate-200 bg-white p-2 text-slate-600">
                  <MoreVertical className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-44 rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-700 shadow-lg">
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
                  >
                    Round-Up
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-slate-100"
                  >
                    Settings
                  </button>
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="min-h-[60vh]">{viewContent}</section>
        {dealDrawerEnabled && (
          <DealDrawer open={drawerOpen} deal={drawerDeal} onClose={handleCloseDealDrawer} />
        )}
      </div>
    </AppLayout>
  )
}
