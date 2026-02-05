// Centralized calendar navigation helpers.
// Phase-1: preserve existing routes (no behavior change).

import { isFeatureEnabled } from '@/config/featureFlags'
import { logCalendarNavigation } from '@/lib/navigation/logNavigation'

const buildFocusQuery = (focusId) => {
  if (!focusId) return ''
  const qs = new URLSearchParams({ focus: String(focusId) })
  return `?${qs.toString()}`
}

export function getCalendarDestination(target, context = {}) {
  const normalized = String(target || '').toLowerCase()
  const focusId = context?.focusId

  switch (normalized) {
    case 'agenda':
      return `/calendar/agenda${buildFocusQuery(focusId)}`
    case 'grid':
      return '/calendar/grid'
    case 'flow':
      return `/calendar-flow-management-center${buildFocusQuery(focusId)}`
    case 'active':
      return '/currently-active-appointments'
    case 'calendar':
      return '/calendar'
    default:
      return '/calendar'
  }
}

export function openCalendar({ navigate, target, source, context } = {}) {
  const destination = getCalendarDestination(target, context)
  const calendarUnifiedShell = isFeatureEnabled('calendar_unified_shell')

  logCalendarNavigation({
    source,
    destination,
    context,
    flags: { calendar_unified_shell: calendarUnifiedShell },
  })

  if (typeof navigate === 'function') {
    navigate(destination)
  }
}
