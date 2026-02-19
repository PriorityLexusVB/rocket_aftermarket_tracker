import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, useLocation } from 'react-router-dom'
import CalendarShell from '@/pages/calendar/CalendarShell'

vi.mock('@/pages/calendar', () => ({
  default: () => <div data-testid="calendar-view" />,
}))

vi.mock('@/pages/calendar-flow-management-center', () => ({
  default: () => <div data-testid="board-view" />,
}))

vi.mock('@/pages/calendar-agenda', () => ({
  default: () => <div data-testid="list-view" />,
}))

function LocationProbe() {
  const location = useLocation()
  return <div data-testid="location-search">{location.search}</div>
}

describe('CalendarShell view/range restoration', () => {
  it('restores last calendar range when switching board -> calendar', async () => {
    const user = userEvent.setup()

    render(
      <MemoryRouter initialEntries={['/calendar?view=calendar&range=month&date=2026-02-19']}>
        <LocationProbe />
        <CalendarShell />
      </MemoryRouter>
    )

    await user.click(screen.getByRole('button', { name: 'Board' }))
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('view=board')
      expect(screen.getByTestId('location-search').textContent).toContain('range=week')
    })

    await user.selectOptions(screen.getByLabelText('Select date range'), 'next30')
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('view=board')
      expect(screen.getByTestId('location-search').textContent).toContain('range=next30')
    })

    await user.click(screen.getByRole('button', { name: 'Calendar' }))
    await waitFor(() => {
      expect(screen.getByTestId('location-search').textContent).toContain('view=calendar')
      expect(screen.getByTestId('location-search').textContent).toContain('range=month')
    })
  })
})
