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

    const title = await screen.findByText('Promise Only Job')
    const card = title.closest('[title="Promise Only Job"]')
    expect(card).toBeTruthy()

    await waitFor(() => {
      expect(within(card).getByText('PROMISE')).toBeTruthy()
    })

    expect(within(card).queryByText('BOOKED')).toBeNull()
    expect(within(card).getByText(/Promise:/i)).toBeTruthy()
  })

  it('reopens completed jobs to quality_check', async () => {
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

    const card = document.querySelector('[title="Completed Job"]')
    expect(card).toBeTruthy()

    const reopenButton = within(card).getByRole('button', { name: /reopen/i })
    fireEvent.click(reopenButton)

    await waitFor(() => {
      expect(mockUpdateStatus).toHaveBeenCalledWith('job-2', 'quality_check', {
        completed_at: null,
      })
    })
  })
})
