import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', name: 'Test User' },
    orgId: 'test-org-id',
  }),
}))

const mockGetScheduledJobsByDateRange = vi.fn(() => Promise.resolve({ jobs: [], debug: {} }))

vi.mock('@/services/scheduleItemsService', () => ({
  getScheduledJobsByDateRange: (...args) => mockGetScheduledJobsByDateRange(...args),
  getNeedsSchedulingPromiseItems: vi.fn(() => Promise.resolve({ items: [], debug: {} })),
}))

vi.mock('@/components/layouts/AppLayout', () => ({
  default: ({ children }) => <>{children}</>,
}))

import CalendarSchedulingCenter from '@/pages/calendar/index.jsx'

describe('CalendarSchedulingCenter data fetch', () => {
  it('loads jobs via getScheduledJobsByDateRange (org-scoped)', async () => {
    render(
      <MemoryRouter>
        <CalendarSchedulingCenter />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(mockGetScheduledJobsByDateRange).toHaveBeenCalled()
    })

    const call = mockGetScheduledJobsByDateRange.mock.calls[0]?.[0] || {}
    expect(call).toMatchObject({ orgId: 'test-org-id' })
    expect(call.rangeStart).toBeInstanceOf(Date)
    expect(call.rangeEnd).toBeInstanceOf(Date)
  })
})
