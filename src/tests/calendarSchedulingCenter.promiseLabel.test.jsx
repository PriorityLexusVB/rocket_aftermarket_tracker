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

const mockGetJobsByDateRange = vi.fn()
const mockUpdateStatus = vi.fn()

vi.mock('@/services/calendarService', () => ({
  calendarService: {
    getJobsByDateRange: (...args) => mockGetJobsByDateRange(...args),
  },
}))

vi.mock('@/services/jobService', () => ({
  jobService: {
    updateStatus: (...args) => mockUpdateStatus(...args),
  },
}))

vi.mock('@/services/scheduleItemsService', () => ({
  getNeedsSchedulingPromiseItems: vi.fn(() => Promise.resolve({ items: [], debug: {} })),
}))

vi.mock('@/components/layouts/AppLayout', () => ({
  default: ({ children }) => <>{children}</>,
}))

import CalendarSchedulingCenter from '@/pages/calendar/index.jsx'

describe('CalendarSchedulingCenter promise-only label', () => {
  beforeEach(() => {
    mockGetJobsByDateRange.mockReset()
    mockUpdateStatus.mockReset()
  })

  it('renders PROMISE for time_tbd scheduled items (never BOOKED)', async () => {
    mockGetJobsByDateRange.mockResolvedValue({
      data: [
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
      error: null,
    })

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
    mockGetJobsByDateRange.mockResolvedValue({
      data: [
        {
          id: 'job-2',
          title: 'Completed Job',
          job_status: 'completed',
          time_tbd: false,
          schedule_state: 'scheduled',
          scheduled_start_time: '2026-02-05T18:00:00Z',
          scheduled_end_time: null,
          service_type: 'onsite',
          vendor_id: null,
        },
      ],
      error: null,
    })

    render(
      <MemoryRouter>
        <CalendarSchedulingCenter />
      </MemoryRouter>
    )

    const title = await screen.findByText('Completed Job')
    const card = title.closest('[title="Completed Job"]')
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
