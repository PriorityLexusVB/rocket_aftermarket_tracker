import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CalendarAgenda from '@/pages/calendar-agenda'

const mockGetScheduleItems = vi.fn(() => Promise.resolve({ items: [] }))
const mockGetNeedsSchedulingPromiseItems = vi.fn(() => Promise.resolve({ items: [] }))

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
  getScheduleItems: (...args) => mockGetScheduleItems(...args),
  getNeedsSchedulingPromiseItems: (...args) => mockGetNeedsSchedulingPromiseItems(...args),
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
  beforeEach(() => {
    mockGetScheduleItems.mockResolvedValue({ items: [] })
    mockGetNeedsSchedulingPromiseItems.mockResolvedValue({ items: [] })
  })

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

  it('uses top-0 sticky day headers when embedded controls are hidden', async () => {
    mockGetNeedsSchedulingPromiseItems.mockResolvedValue({
      items: [
        {
          id: 'job-200',
          title: 'Promise row',
          promisedAt: '2026-02-18',
          raw: {
            id: 'job-200',
            title: 'Promise row',
            promised_date: '2026-02-18',
            job_status: 'pending',
          },
        },
      ],
    })

    render(
      <MemoryRouter>
        <CalendarAgenda embedded hideEmbeddedControls />
      </MemoryRouter>
    )

    await screen.findByRole('list')
    const stickyHeader = document.querySelector('section div.sticky')
    expect(stickyHeader).toBeInTheDocument()
    expect(stickyHeader?.className).toContain('top-0')
  })
})
