import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', name: 'Test User' },
    orgId: 'test-org-id',
  }),
}))

const mockGetScheduledJobsByDateRange = vi.fn()
const mockGetNeedsSchedulingPromiseItems = vi.fn()

vi.mock('@/services/scheduleItemsService', () => ({
  getScheduledJobsByDateRange: (...args) => mockGetScheduledJobsByDateRange(...args),
  getNeedsSchedulingPromiseItems: (...args) => mockGetNeedsSchedulingPromiseItems(...args),
}))

vi.mock('@/components/layouts/AppLayout', () => ({
  default: ({ children }) => <>{children}</>,
}))

import CalendarSchedulingCenter from '@/pages/calendar/index.jsx'

describe('CalendarSchedulingCenter all-day promise lane', () => {
  beforeEach(() => {
    mockGetScheduledJobsByDateRange.mockReset()
    mockGetNeedsSchedulingPromiseItems.mockReset()
  })

  it('renders promise-only items in All-day lane and timed items below without duplicates', async () => {
    const start = new Date()
    start.setHours(10, 0, 0, 0)
    const end = new Date(start)
    end.setHours(11, 0, 0, 0)

    const promiseDate = new Date()
    promiseDate.setHours(12, 0, 0, 0)

    mockGetScheduledJobsByDateRange.mockResolvedValue({
      jobs: [
        {
          id: 'job-timed-1',
          calendar_key: 'job-timed-1',
          title: 'Timed Scheduled Job',
          customer_name: 'Timed Customer',
          job_status: 'scheduled',
          scheduled_start_time: start.toISOString(),
          scheduled_end_time: end.toISOString(),
          service_type: 'onsite',
          vendor_id: null,
        },
      ],
      debug: {},
    })

    mockGetNeedsSchedulingPromiseItems.mockResolvedValue({
      items: [
        {
          id: 'job-promise-1',
          promisedAt: promiseDate.toISOString(),
          raw: {
            id: 'job-promise-1',
            title: 'Promise Only Job',
            customer_name: 'Promise Customer',
            job_status: 'pending',
            service_type: 'onsite',
            vendor_id: null,
          },
        },
      ],
      debug: {},
    })

    render(
      <MemoryRouter>
        <CalendarSchedulingCenter />
      </MemoryRouter>
    )

    const laneHeader = await screen.findByText('All-day (Promises)')
    const laneContainer = laneHeader.closest('div')?.parentElement
    expect(laneContainer).toBeTruthy()

    expect(within(laneContainer).getByText('Promise Customer')).toBeInTheDocument()
    expect(within(laneContainer).getByText('PROMISE')).toBeInTheDocument()
    expect(screen.getByText('Timed Customer')).toBeInTheDocument()
    expect(screen.getByText('BOOKED')).toBeInTheDocument()

    expect(screen.getAllByText('Promise Customer')).toHaveLength(1)
  })
})
