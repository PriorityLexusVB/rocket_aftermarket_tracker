import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Filter, Info, MoreVertical, Plus, Search } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import AppLayout from '@/components/layouts/AppLayout'
import CalendarSchedulingCenter from '@/pages/calendar'
import CalendarFlowManagementCenter from '@/pages/calendar-flow-management-center'
import CalendarAgenda from '@/pages/calendar-agenda'
import DealDrawer from '@/components/calendar/DealDrawer'
import CalendarLegend from '@/components/calendar/CalendarLegend'
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
  const [searchValue, setSearchValue] = useState(() => searchParams.get('q') || '')
  const [debouncedSearch, setDebouncedSearch] = useState(searchValue)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [drawerDeal, setDrawerDeal] = useState(null)

  const {
    view,
    range,
    date,
    location: locationFilter,
    banner,
    normalizedParams,
  } = useMemo(() => parseCalendarQuery(searchParams), [searchParams])
  const urlQuery = useMemo(() => searchParams.get('q') || '', [searchParams])

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
  const lastCalendarRangeRef = useRef(
    range === 'day' || range === 'week' || range === 'month' ? range : 'month'
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
        banner,
      })
      setSearchParams(nextParams, { replace: true })
    }
  }, [resolvedView, view, clampedRange, date, searchParams, setSearchParams, locationFilter, banner])

  useEffect(() => {
    setSearchValue((prev) => (prev === urlQuery ? prev : urlQuery))
  }, [urlQuery])

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(searchValue), 300)
    return () => clearTimeout(handle)
  }, [searchValue])

  const updateParams = useCallback(
    (next) => {
      const currentQuery = searchParams.get('q') || ''
      const nextParams = buildCalendarSearchParams({
        view: next?.view ?? resolvedView,
        range: next?.range ?? clampedRange,
        date: next?.date ?? date,
        q: currentQuery,
        location: next?.location ?? locationFilter,
        banner,
      })
      setSearchParams(nextParams)
    },
    [resolvedView, clampedRange, date, searchParams, setSearchParams, locationFilter, banner]
  )

  useEffect(() => {
    const nextQuery = debouncedSearch.trim()
    const currentQuery = searchParams.get('q') || ''
    if (nextQuery === currentQuery) return

    const nextParams = buildCalendarSearchParams({
      view: resolvedView,
      range: clampedRange,
      date,
      q: nextQuery,
      location: locationFilter,
      banner,
    })
    setSearchParams(nextParams, { replace: true })
  }, [
    debouncedSearch,
    resolvedView,
    clampedRange,
    date,
    locationFilter,
    banner,
    searchParams,
    setSearchParams,
  ])

  useEffect(() => {
    if (!allowedRanges.has(range)) {
      updateParams({ range: clampedRange })
    }
  }, [allowedRanges, range, clampedRange, updateParams])

  useEffect(() => {
    if (resolvedView === 'calendar' && (clampedRange === 'day' || clampedRange === 'week' || clampedRange === 'month')) {
      lastCalendarRangeRef.current = clampedRange
    }
  }, [resolvedView, clampedRange])

  const handleViewChange = (nextView) => {
    const nextAllowedRanges = getAllowedRangesForView(nextView)
    let nextRange = clampedRange

    if (nextView === 'calendar') {
      const remembered = lastCalendarRangeRef.current
      if (resolvedView !== 'calendar' && nextAllowedRanges.has(remembered)) {
        nextRange = remembered
      } else {
        nextRange = clampedRange === 'week' || clampedRange === 'month' ? clampedRange : 'month'
      }
    }

    if (!nextAllowedRanges.has(nextRange)) {
      nextRange = nextView === 'calendar' ? 'month' : 'week'
    }

    updateParams({ view: nextView, range: nextRange })
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

  const shellState = useMemo(
    () => ({ range: clampedRange, date, q: searchValue }),
    [clampedRange, date, searchValue]
  )
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
          hideEmbeddedControls
          onOpenDealDrawer={dealDrawerEnabled ? handleOpenDealDrawer : undefined}
        />
      ) : (
        <div className="rounded-lg border border-border bg-card p-6 text-sm text-muted-foreground">
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
      <div className="mx-auto flex w-full max-w-7xl min-h-[calc(100vh-120px)] flex-col gap-4 p-4 md:px-6">
        <section className="rounded-xl border border-border bg-card p-4 shadow-sm">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-xl font-semibold text-foreground">Calendar</h1>
              {banner === 'overdue' ? (
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                  Overdue filter active
                </span>
              ) : null}
              <div className="inline-flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
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
                        ? 'border border-primary bg-primary text-primary-foreground'
                        : 'border border-transparent bg-transparent text-muted-foreground hover:bg-muted'
                    } ${item.disabled ? 'cursor-not-allowed opacity-50' : ''}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 sm:gap-3 xl:justify-end">
              <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-2 py-1">
                <button
                  type="button"
                  onClick={handlePrev}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Previous"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleToday}
                  className="rounded-md px-2 py-1 text-xs font-medium text-foreground hover:bg-muted"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={handleNext}
                  className="rounded-md p-1 text-muted-foreground hover:bg-muted"
                  aria-label="Next"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
                <span className="text-sm font-medium text-foreground">{dateLabel}</span>
                <input
                  type="date"
                  value={dateInputValue}
                  onChange={handleDateInput}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                  aria-label="Pick a date"
                />
              </div>

              <select
                value={clampedRange}
                onChange={handleRangeChange}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
                aria-label="Select date range"
              >
                {rangeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>

              <div className="relative min-w-[220px]">
                <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search stock/customer/phone"
                  className="h-8 w-56 max-w-full rounded-md border border-input bg-background pl-8 pr-2 text-xs text-foreground placeholder:text-muted-foreground"
                  aria-label="Search calendar"
                  value={searchValue}
                  onChange={(event) => setSearchValue(event.target.value)}
                />
              </div>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
                  Help
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-64 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
                  <div className="font-semibold text-foreground">Search tips</div>
                  <div className="mt-2 space-y-1">
                    <div>Matches job number, customer, phone, vehicle, and notes.</div>
                    <div>Search applies across Board, Calendar, and List views.</div>
                  </div>
                </div>
              </details>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center gap-1 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground">
                  <Filter className="h-4 w-4" /> Filters
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
                  <label
                    className="block text-[11px] font-semibold text-muted-foreground"
                    htmlFor="calendar-location-filter"
                  >
                    Location
                  </label>
                  <select
                    id="calendar-location-filter"
                    className="mt-2 h-8 w-full rounded-md border border-input bg-background px-2 text-xs text-foreground"
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
                <summary className="flex cursor-pointer list-none items-center rounded-md border border-border bg-background p-2 text-muted-foreground">
                  <Info className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-52 rounded-lg border border-border bg-popover p-3 text-xs text-popover-foreground shadow-lg">
                  <CalendarLegend compact showStatuses />
                </div>
              </details>

              <button
                type="button"
                onClick={() => navigate('/deals/new')}
                className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                <Plus className="h-4 w-4" /> New Deal
              </button>

              <details className="group relative">
                <summary className="flex cursor-pointer list-none items-center rounded-md border border-border bg-background p-2 text-muted-foreground">
                  <MoreVertical className="h-4 w-4" />
                </summary>
                <div className="absolute right-0 z-30 mt-2 w-44 rounded-lg border border-border bg-popover p-2 text-xs text-popover-foreground shadow-lg">
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                  >
                    Refresh
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                  >
                    Export
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                  >
                    Round-Up
                  </button>
                  <button
                    type="button"
                    className="w-full rounded px-2 py-1 text-left hover:bg-muted"
                  >
                    Settings
                  </button>
                </div>
              </details>
            </div>
          </div>
        </section>

        <section className="flex-1 min-h-0 overflow-hidden">
          <div className="h-full overflow-auto rounded-xl">{viewContent}</div>
        </section>
        {dealDrawerEnabled && (
          <DealDrawer open={drawerOpen} deal={drawerDeal} onClose={handleCloseDealDrawer} />
        )}
      </div>
    </AppLayout>
  )
}
