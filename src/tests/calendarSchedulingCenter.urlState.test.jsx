import React from 'react'
import { describe, it, expect, vi } from 'vitest'
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
  getNeedsSchedulingPromiseItems: vi.fn(() => Promise.resolve({ items: [], debug: {} })),
}))

vi.mock('@/components/layouts/AppLayout', () => ({
  default: ({ children }) => <>{children}</>,
}))

import CalendarSchedulingCenter from '@/pages/calendar/index.jsx'

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

describe('CalendarSchedulingCenter URL state', () => {
  it('hydrates from URL params and updates params when drilling into a day', async () => {
    render(
      <MemoryRouter initialEntries={['/calendar/grid?view=month&date=2026-01-15']}>
        <LocationProbe />
        <CalendarSchedulingCenter />
      </MemoryRouter>
    )

    expect(await screen.findByText('Monthly Schedule')).toBeTruthy()

    const initialSearch = screen.getByTestId('location-search').textContent || ''
    expect(initialSearch).toContain('view=month')
    expect(initialSearch).toContain('date=2026-01-15')

    const dayCell = screen.getByLabelText('Open 2026-01-15 in day view')
    fireEvent.click(dayCell)

    expect(await screen.findByText('Daily Schedule')).toBeTruthy()

    await waitFor(() => {
      const nextSearch = screen.getByTestId('location-search').textContent || ''
      expect(nextSearch).toContain('view=day')
      expect(nextSearch).toContain('date=2026-01-15')
    })
  })
})
