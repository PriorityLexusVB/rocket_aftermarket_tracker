// Centralized calendar navigation helpers.
// Phase-1: preserve existing routes (no behavior change).

import { isFeatureEnabled, isCalendarUnifiedShellEnabled } from '@/config/featureFlags'
import { logCalendarNavigation } from '@/lib/navigation/logNavigation'

const buildFocusQuery = (focusId) => {
  if (!focusId) return ''
  const qs = new URLSearchParams({ focus: String(focusId) })
  return `?${qs.toString()}`
}

const LEGACY_DESTINATIONS = {
  agenda: '/calendar/agenda',
  list: '/calendar/agenda',
  grid: '/calendar/grid',
  flow: '/calendar-flow-management-center',
  board: '/calendar-flow-management-center',
  active: '/currently-active-appointments',
  calendar: '/calendar',
}

const CANONICAL_VIEW_BY_TARGET = {
  board: 'board',
  calendar: 'calendar',
  list: 'list',
  agenda: 'list',
  grid: 'calendar',
  flow: 'board',
}

const VALID_CANONICAL_VIEWS = new Set(['board', 'calendar', 'list'])
const VALID_CANONICAL_RANGES = new Set(['day', 'week', 'month', 'next7', 'next30'])

function formatCalendarDateParam(date) {
  if (!date || typeof date.getTime !== 'function') return ''
  const t = date.getTime()
  if (Number.isNaN(t)) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseCalendarDateParam(value) {
  if (!value) return null
  const str = String(value).trim()
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  if (!y || !mo || !d) return null
  const dt = new Date(y, mo - 1, d, 12, 0, 0, 0)
  return Number.isNaN(dt.getTime()) ? null : dt
}

export function normalizeCalendarView(view) {
  if (!view) return 'board'
  const v = String(view).trim().toLowerCase()
  return VALID_CANONICAL_VIEWS.has(v) ? v : 'board'
}

export function normalizeCalendarRange(range) {
  if (!range) return 'day'
  const r = String(range).trim().toLowerCase()
  return VALID_CANONICAL_RANGES.has(r) ? r : 'day'
}

export function buildCalendarSearchParams({ view, range, date } = {}) {
  const normalizedView = normalizeCalendarView(view)
  const normalizedRange = normalizeCalendarRange(range)
  const dateValue = date instanceof Date ? date : parseCalendarDateParam(date)
  const dateParam = formatCalendarDateParam(dateValue || new Date())

  const params = new URLSearchParams()
  params.set('view', normalizedView)
  params.set('range', normalizedRange)
  if (dateParam) params.set('date', dateParam)
  return params
}

export function buildCalendarUrl({ view, range, date } = {}) {
  const params = buildCalendarSearchParams({ view, range, date })
  return `/calendar?${params.toString()}`
}

export function parseCalendarQuery(input) {
  const params =
    input instanceof URLSearchParams
      ? input
      : new URLSearchParams(typeof input === 'string' ? input : '')

  const view = normalizeCalendarView(params.get('view'))
  const range = normalizeCalendarRange(params.get('range'))
  const parsedDate = parseCalendarDateParam(params.get('date')) || new Date()
  const normalizedParams = buildCalendarSearchParams({ view, range, date: parsedDate })

  return {
    view,
    range,
    date: parsedDate,
    normalizedParams,
  }
}

function buildLegacyDestination(target, context = {}) {
  const base = LEGACY_DESTINATIONS[target] || '/calendar'
  if (['agenda', 'list', 'flow', 'board'].includes(target)) {
    return `${base}${buildFocusQuery(context?.focusId)}`
  }
  return base
}

export function getCalendarDestination(targetOrOptions, context = {}) {
  const options =
    targetOrOptions && typeof targetOrOptions === 'object'
      ? targetOrOptions
      : { target: targetOrOptions, context }

  const { target, view, range, date } = options || {}
  const ctx = options?.context || context
  const normalizedTarget = String(target || '').toLowerCase()

  if (!normalizedTarget) {
    return isCalendarUnifiedShellEnabled()
      ? buildCalendarUrl({ view, range, date })
      : LEGACY_DESTINATIONS.calendar
  }

  if (normalizedTarget === 'active') return LEGACY_DESTINATIONS.active

  if (isCalendarUnifiedShellEnabled()) {
    const nextView = view || CANONICAL_VIEW_BY_TARGET[normalizedTarget] || 'board'
    return buildCalendarUrl({ view: nextView, range, date })
  }

  return buildLegacyDestination(normalizedTarget, ctx)
}

export function trackCalendarNavigation({
  source,
  destination,
  target,
  view,
  range,
  date,
  context,
} = {}) {
  const resolvedDestination =
    destination || getCalendarDestination({ target, view, range, date, context })
  const calendarUnifiedShell = isCalendarUnifiedShellEnabled()

  logCalendarNavigation({
    source,
    destination: resolvedDestination,
    context,
    flags: { calendar_unified_shell: calendarUnifiedShell },
  })

  return resolvedDestination
}

export function openCalendar({ navigate, target, source, context, view, range, date } = {}) {
  const destination = getCalendarDestination({ target, view, range, date, context })

  trackCalendarNavigation({
    source,
    destination,
    context,
  })

  if (typeof navigate === 'function') {
    navigate(destination)
  }
}
