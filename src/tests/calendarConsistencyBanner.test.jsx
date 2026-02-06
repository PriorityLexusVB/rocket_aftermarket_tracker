import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CalendarSchedulingCenter from '@/pages/calendar'
import { getNeedsSchedulingPromiseItems, getScheduledJobsByDateRange } from '@/services/scheduleItemsService'

vi.mock('@/services/scheduleItemsService', () => ({
  getNeedsSchedulingPromiseItems: vi.fn(),
  getScheduledJobsByDateRange: vi.fn(),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { id: 'user-1' }, orgId: 'org-1' }),
}))

vi.mock('@/components/ui/ToastProvider', () => ({
  useToast: () => ({
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  }),
}))

afterEach(() => {
  vi.clearAllMocks()
  if (vi.unstubAllEnvs) vi.unstubAllEnvs()
})

describe('CalendarSchedulingCenter consistency banners', () => {
  it('shows mismatch banner when unified shell is enabled', async () => {
    vi.stubEnv('VITE_FF_CALENDAR_UNIFIED_SHELL', 'true')
    getScheduledJobsByDateRange.mockResolvedValue({
      jobs: [],
      debug: { rpcCount: 2, jobCount: 0, missingCount: 2 },
    })
    getNeedsSchedulingPromiseItems.mockResolvedValue({ items: [] })

    render(
      <MemoryRouter initialEntries={['/calendar?view=calendar']}>
        <CalendarSchedulingCenter embedded shellState={{ range: 'month', date: new Date() }} />
      </MemoryRouter>
    )

    expect(
      await screen.findByText(/Calendar items found, but Deals are empty/i)
    ).toBeInTheDocument()
  })

  it('hides mismatch banner when unified shell is disabled', async () => {
    vi.stubEnv('VITE_FF_CALENDAR_UNIFIED_SHELL', 'false')
    getScheduledJobsByDateRange.mockResolvedValue({
      jobs: [],
      debug: { rpcCount: 2, jobCount: 0, missingCount: 2 },
    })
    getNeedsSchedulingPromiseItems.mockResolvedValue({ items: [] })

    render(
      <MemoryRouter initialEntries={['/calendar?view=calendar']}>
        <CalendarSchedulingCenter embedded shellState={{ range: 'month', date: new Date() }} />
      </MemoryRouter>
    )

    await waitFor(() => expect(getScheduledJobsByDateRange).toHaveBeenCalled())
    expect(screen.queryByText(/Calendar items found, but Deals are empty/i)).toBeNull()
  })
})
