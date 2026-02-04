import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildCalendarSearchParams,
  getCalendarDestination,
  parseCalendarQuery,
} from '@/lib/navigation/calendarNavigation'

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
    originalFlag =
      (import.meta && import.meta.env && import.meta.env.VITE_FF_CALENDAR_UNIFIED_SHELL) ||
      undefined
  })

  afterEach(() => {
    setFlag(originalFlag)
    if (typeof vi.unstubAllEnvs === 'function') {
      vi.unstubAllEnvs()
    }
  })

  it('builds canonical destinations when unified shell is enabled', () => {
    if (typeof vi.stubEnv === 'function') {
      vi.stubEnv('VITE_FF_CALENDAR_UNIFIED_SHELL', 'true')
    } else {
      setFlag('true')
    }

    const destination = getCalendarDestination({ target: 'list' })
    expect(destination.startsWith('/calendar?')).toBe(true)
    const params = new URLSearchParams(destination.split('?')[1])
    expect(params.get('view')).toBe('list')
    expect(params.get('range')).toBe('day')
    expect(params.get('date')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('parses canonical query params and normalizes defaults', () => {
    const parsed = parseCalendarQuery('view=calendar&range=week&date=2025-01-20')
    expect(parsed.view).toBe('calendar')
    expect(parsed.range).toBe('week')
    expect(parsed.date).toBeInstanceOf(Date)
  })

  it('normalizes invalid query params to defaults', () => {
    const parsed = parseCalendarQuery('view=unknown&range=bad&date=bad')
    expect(parsed.view).toBe('board')
    expect(parsed.range).toBe('day')
    expect(parsed.date).toBeInstanceOf(Date)
  })

  it('builds calendar search params consistently', () => {
    const params = buildCalendarSearchParams({ view: 'list', range: 'next7', date: '2025-02-03' })
    expect(params.get('view')).toBe('list')
    expect(params.get('range')).toBe('next7')
    expect(params.get('date')).toBe('2025-02-03')
  })
})
