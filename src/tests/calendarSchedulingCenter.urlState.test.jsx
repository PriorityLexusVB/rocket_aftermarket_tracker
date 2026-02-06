import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'

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

vi.mock('@/services/scheduleItemsService', () => ({
  getScheduledJobsByDateRange: vi.fn(() => Promise.resolve({ jobs: [], debug: {} })),
  getNeedsSchedulingPromiseItems: vi.fn(() => Promise.resolve({ items: [], debug: {} })),
}))

vi.mock('@/components/layouts/AppLayout', () => ({
  default: ({ children }) => <>{children}</>,
}))

let CalendarSchedulingCenter

beforeEach(async () => {
  vi.useRealTimers()
  // This test can be sensitive to cross-file import ordering; force a fresh module graph
  // so the vi.mocks above are always applied.
  vi.resetModules()
  CalendarSchedulingCenter = (await import('@/pages/calendar/index.jsx')).default
})

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

describe('CalendarSchedulingCenter URL state', () => {
  it('hydrates from URL params and updates params when drilling into a day', async () => {
    render(
      <MemoryRouter initialEntries={['/calendar?view=month&date=2026-01-15']}>
        <LocationProbe />
        <CalendarSchedulingCenter />
      </MemoryRouter>
    )

    const dayCell = await screen.findByLabelText(
      /Open 2026-01-15 in (day|board) view/
    )

    const initialSearch = screen.getByTestId('location-search').textContent || ''
    expect(initialSearch).toContain('view=month')
    expect(initialSearch).toContain('date=2026-01-15')

    fireEvent.click(dayCell)

    await waitFor(() => {
      const nextSearch = screen.getByTestId('location-search').textContent || ''
      expect(nextSearch).toMatch(/view=(day|board)/)
      expect(nextSearch).toContain('date=2026-01-15')
    })
  })
})
