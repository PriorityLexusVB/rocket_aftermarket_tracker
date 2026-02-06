import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import CalendarShell from '@/pages/calendar/CalendarShell'

vi.mock('@/pages/calendar', () => ({
  default: (props) => (
    <div data-testid="calendar-view" data-location={props.locationFilter || ''} />
  ),
}))

vi.mock('@/pages/calendar-flow-management-center', () => ({
  default: (props) => <div data-testid="board-view" data-location={props.locationFilter || ''} />,
}))

vi.mock('@/pages/calendar-agenda', () => ({
  default: (props) => <div data-testid="list-view" data-location={props.locationFilter || ''} />,
}))

describe('CalendarShell location filter', () => {
  it('passes location filter to embedded views', async () => {
    const user = userEvent.setup()
    render(
      <MemoryRouter
        initialEntries={['/calendar?view=calendar&range=month&date=2026-02-01&location=Off-Site']}
      >
        <CalendarShell />
      </MemoryRouter>
    )

    await user.click(screen.getByText('Filters'))
    const select = screen.getByLabelText('Location')
    expect(select).toHaveValue('Off-Site')
    expect(screen.getByTestId('calendar-view')).toHaveAttribute('data-location', 'Off-Site')

    await user.selectOptions(select, 'In-House')
    expect(screen.getByTestId('calendar-view')).toHaveAttribute('data-location', 'In-House')

    await user.click(screen.getByRole('button', { name: 'Board' }))
    expect(screen.getByTestId('board-view')).toHaveAttribute('data-location', 'In-House')
  })
})
