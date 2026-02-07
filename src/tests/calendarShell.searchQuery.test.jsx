import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
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

describe('CalendarShell search query', () => {
  it('syncs search input to the q param', async () => {
    render(
      <MemoryRouter initialEntries={['/calendar?view=board&range=week&date=2026-02-01']}>
        <LocationProbe />
        <CalendarShell />
      </MemoryRouter>
    )

    const input = screen.getByLabelText('Search calendar')
    fireEvent.change(input, { target: { value: 'smith' } })
    await waitFor(() => {
      expect(input).toHaveValue('smith')
      expect(screen.getByTestId('location-search').textContent).toContain('q=smith')
    })
  })

  it('hydrates input from the q param', () => {
    render(
      <MemoryRouter initialEntries={['/calendar?view=board&range=week&date=2026-02-01&q=grace']}>
        <CalendarShell />
      </MemoryRouter>
    )

    const input = screen.getByLabelText('Search calendar')
    expect(input).toHaveValue('grace')
  })
})
