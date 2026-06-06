import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', name: 'Test User' },
    orgId: 'test-org-id',
  }),
}))

const todayIso = new Date().toISOString()

const mockGetScheduledJobsByDateRange = vi.fn()
const mockGetNeedsSchedulingPromiseItems = vi.fn()
const mockUpdateStatus = vi.fn()

vi.mock('@/services/jobService', () => ({
  jobService: {
    updateStatus: (...args) => mockUpdateStatus(...args),
  },
}))

vi.mock('@/services/scheduleItemsService', () => ({
  getScheduledJobsByDateRange: (...args) => mockGetScheduledJobsByDateRange(...args),
  getNeedsSchedulingPromiseItems: (...args) => mockGetNeedsSchedulingPromiseItems(...args),
  // Wave XXX-C added these canonical helpers — mocks must declare them.
  getPromiseIso: (job) => job?.next_promised_iso || job?.promised_date || job?.promisedAt || null,
  isOverdueJob: () => false,
}))

vi.mock('@/components/layouts/AppLayout', () => ({
  default: ({ children }) => <>{children}</>,
}))

import CalendarSchedulingCenter from '@/pages/calendar/index.jsx'

describe('CalendarSchedulingCenter promise-only label', () => {
  beforeEach(() => {
    mockGetScheduledJobsByDateRange.mockReset()
    mockGetNeedsSchedulingPromiseItems.mockReset()
    mockUpdateStatus.mockReset()
  })

  it('renders PROMISE for time_tbd scheduled items (never BOOKED)', async () => {
    mockGetScheduledJobsByDateRange.mockResolvedValue({
      jobs: [
        {
          id: 'job-1',
          title: 'Promise Only Job',
          job_status: 'scheduled',
          time_tbd: true,
          schedule_state: 'scheduled_no_time',
          scheduled_start_time: todayIso,
          scheduled_end_time: null,
          service_type: 'onsite',
          vendor_id: null,
          customer_name: 'Jane Customer',
        },
      ],
      debug: {},
    })
    mockGetNeedsSchedulingPromiseItems.mockResolvedValue({ items: [], debug: {} })

    render(
      <MemoryRouter>
        <CalendarSchedulingCenter />
      </MemoryRouter>
    )

    const customer = await screen.findByText('Jane Customer')
    const card = customer.closest('[role="button"]')
    expect(card).toBeTruthy()

    // Wave XXX-V: the "PROMISE" / "BOOKED" text badges were removed; promise-only
    // items are now visually distinguished by left border + amber tint.
    expect(within(card).getByText('Jane Customer')).toBeTruthy()
    expect(within(card).queryByText('BOOKED')).toBeNull()
    expect(within(card).queryByText('PROMISE')).toBeNull()
    // Visual marker: green left border + amber color denote promise-only state.
    expect(card.className).toMatch(/border-l-green-500/)
    expect(card.className).toMatch(/(amber|text-amber)/)
  })

  it('reopens completed jobs to in_progress (Wave XXX-V — quality_check collapsed)', async () => {
    mockGetScheduledJobsByDateRange.mockResolvedValue({
      jobs: [
        {
          id: 'job-2',
          title: 'Completed Job',
          job_status: 'completed',
          time_tbd: false,
          schedule_state: 'scheduled',
          scheduled_start_time: todayIso,
          scheduled_end_time: null,
          service_type: 'onsite',
          vendor_id: null,
          customer_name: 'Jane Customer',
        },
      ],
      debug: {},
    })
    mockGetNeedsSchedulingPromiseItems.mockResolvedValue({ items: [], debug: {} })

    render(
      <MemoryRouter>
        <CalendarSchedulingCenter />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetScheduledJobsByDateRange).toHaveBeenCalled()
    })

    const customer = await screen.findByText('Jane Customer')
    const card = customer.closest('[role="button"]')
    expect(card).toBeTruthy()

    const reopenButton = within(card).getByRole('button', { name: /reopen/i })
    fireEvent.click(reopenButton)

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith('job-2', 'in_progress', {
        completed_at: null,
      })
    })
  })
})
