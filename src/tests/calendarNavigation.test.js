import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { getCalendarDestination } from '@/lib/navigation/calendarNavigation'

const setFlag = (value) => {
  try {
    // @ts-ignore
    Object.assign((import.meta && import.meta.env) || {}, {
      VITE_FF_CALENDAR_UNIFIED_SHELL: value,
    })
  } catch {
    // no-op
  }
}

describe('calendarNavigation', () => {
  let originalFlag

  beforeEach(() => {
    // @ts-ignore
    originalFlag = (import.meta && import.meta.env && import.meta.env.VITE_FF_CALENDAR_UNIFIED_SHELL) || undefined
  })

  afterEach(() => {
    setFlag(originalFlag)
  })

  it('maps targets to existing routes when flag is OFF', () => {
    setFlag('false')
    expect(getCalendarDestination('agenda')).toBe('/calendar/agenda')
    expect(getCalendarDestination('grid')).toBe('/calendar/grid')
    expect(getCalendarDestination('flow')).toBe('/calendar-flow-management-center')
    expect(getCalendarDestination('active')).toBe('/currently-active-appointments')
    expect(getCalendarDestination('calendar')).toBe('/calendar')
    expect(getCalendarDestination('agenda', { focusId: 'job-1' })).toBe('/calendar/agenda?focus=job-1')
    expect(getCalendarDestination('flow', { focusId: 'job-2' })).toBe(
      '/calendar-flow-management-center?focus=job-2'
    )
  })

  it('maps targets to existing routes when flag is ON (Phase-1 guard)', () => {
    setFlag('true')
    expect(getCalendarDestination('agenda')).toBe('/calendar/agenda')
    expect(getCalendarDestination('grid')).toBe('/calendar/grid')
    expect(getCalendarDestination('flow')).toBe('/calendar-flow-management-center')
    expect(getCalendarDestination('active')).toBe('/currently-active-appointments')
    expect(getCalendarDestination('calendar')).toBe('/calendar')
  })
})
