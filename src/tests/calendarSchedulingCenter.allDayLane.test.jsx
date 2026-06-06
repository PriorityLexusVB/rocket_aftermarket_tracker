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
  // Wave XXX-C canonical helpers — mocks must declare them.
  getPromiseIso: (job) => job?.next_promised_iso || job?.promised_date || job?.promisedAt || null,
  isOverdueJob: () => false,
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

    const promiseCustomer = await screen.findByText('Promise Customer')
    const promiseCard = promiseCustomer.closest('[role="button"]')
    expect(promiseCard).toBeTruthy()

    // Wave XXX-V: PROMISE / BOOKED text badges removed. Promise-only items use
    // amber tint (border-amber + text-amber + bg-white); timed items use blue
    // tint (bg-blue-200 + text-blue-900). The green LEFT border is the onsite
    // service-type indicator and is present on BOTH — not a promise discriminator.
    expect(within(promiseCard).getByText('Promise Customer')).toBeInTheDocument()
    expect(promiseCard.className).toMatch(/border-amber|text-amber/)
    expect(screen.getByText('Timed Customer')).toBeInTheDocument()
    // Timed (BOOKED) items should NOT have amber promise tint
    const timedCard = screen.getByText('Timed Customer').closest('[role="button"]')
    expect(timedCard.className).not.toMatch(/border-amber|text-amber/)
    expect(timedCard.className).toMatch(/bg-blue|text-blue/)

    expect(screen.getAllByText('Promise Customer')).toHaveLength(1)
  })
})
