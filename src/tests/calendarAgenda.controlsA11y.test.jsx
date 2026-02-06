import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CalendarAgenda from '@/pages/calendar-agenda'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', name: 'Test User' },
    orgId: 'test-org-id',
    loading: false,
  }),
}))

vi.mock('@/components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
}))

vi.mock('@/services/scheduleItemsService', () => ({
  getScheduleItems: vi.fn(() => Promise.resolve({ items: [] })),
  getNeedsSchedulingPromiseItems: vi.fn(() => Promise.resolve({ items: [] })),
}))

vi.mock('@/services/calendarService', () => ({
  calendarService: {
    checkSchedulingConflict: vi.fn(() => Promise.resolve({ hasConflict: false })),
  },
}))

vi.mock('@/services/jobService', () => ({
  jobService: {
    updateLineItemSchedules: vi.fn(),
    updateStatus: vi.fn(),
  },
}))

vi.mock('@/components/ui/Navbar', () => ({
  default: () => null,
}))

vi.mock('@/components/calendar/CalendarViewTabs', () => ({
  default: () => null,
}))

describe('CalendarAgenda controls a11y', () => {
  it('associates labels with search and filters', async () => {
    render(
      <MemoryRouter>
        <CalendarAgenda embedded />
      </MemoryRouter>
    )

    const search = await screen.findByLabelText('Search appointments')
    expect(search).toHaveAttribute('id', 'agenda-search')
    expect(search).toHaveAttribute('name', 'agenda-search')

    const dateRange = screen.getByLabelText('Filter by date range')
    expect(dateRange).toHaveAttribute('id', 'agenda-date-range')
    expect(dateRange).toHaveAttribute('name', 'agenda-date-range')

    const filtersButton = screen.getByLabelText('Show filters')
    fireEvent.click(filtersButton)

    const status = await screen.findByLabelText('Filter by status')
    expect(status).toHaveAttribute('id', 'agenda-status')
    expect(status).toHaveAttribute('name', 'agenda-status')
  })
})
