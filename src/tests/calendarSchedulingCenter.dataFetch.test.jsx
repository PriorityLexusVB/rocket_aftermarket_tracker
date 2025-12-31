import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, waitFor } from '@testing-library/react'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'test-user-id', name: 'Test User' },
    orgId: 'test-org-id',
  }),
}))

vi.mock('@/services/calendarService', () => ({
  calendarService: {
    getJobsByDateRange: vi.fn(() => Promise.resolve({ data: [], error: null })),
  },
}))

import CalendarSchedulingCenter from '@/pages/calendar/index.jsx'
import { calendarService } from '@/services/calendarService'

describe('CalendarSchedulingCenter data fetch', () => {
  it('loads jobs via calendarService.getJobsByDateRange (org-scoped)', async () => {
    render(<CalendarSchedulingCenter />)

    await waitFor(() => {
      expect(calendarService.getJobsByDateRange).toHaveBeenCalled()
    })

    expect(calendarService.getJobsByDateRange).toHaveBeenCalledWith(
      expect.any(Date),
      expect.any(Date),
      { orgId: 'test-org-id' }
    )
  })
})
