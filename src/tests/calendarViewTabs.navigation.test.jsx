import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CalendarViewTabs from '@/components/calendar/CalendarViewTabs'
import { getCalendarDestination } from '@/lib/navigation/calendarNavigation'

describe('CalendarViewTabs navigation', () => {
  const setFlag = (value) => {
    try {
      Object.assign((import.meta && import.meta.env) || {}, {
        VITE_FF_CALENDAR_UNIFIED_SHELL: value,
      })
    } catch {}
  }

  beforeEach(() => {
    if (typeof vi.stubEnv === 'function') {
      vi.stubEnv('VITE_FF_CALENDAR_UNIFIED_SHELL', 'true')
    } else {
      setFlag('true')
    }
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-02-06T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
    if (typeof vi.unstubAllEnvs === 'function') {
      vi.unstubAllEnvs()
    }
  })

  it('renders Calendar tab link to canonical calendar route', () => {
    render(
      <MemoryRouter initialEntries={['/calendar/agenda']}>
        <CalendarViewTabs />
      </MemoryRouter>
    )

    const calendarLink = screen.getByRole('link', { name: 'Calendar' })
    const expected = getCalendarDestination({ target: 'calendar' })
    expect(calendarLink.getAttribute('href')).toBe(expected)
  })
})
