import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import CalendarViewTabs from '@/components/calendar/CalendarViewTabs'

describe('CalendarViewTabs navigation', () => {
  it('renders Grid tab link to /calendar', () => {
    render(
      <MemoryRouter initialEntries={['/calendar/agenda']}>
        <CalendarViewTabs />
      </MemoryRouter>
    )

    const gridLink = screen.getByRole('link', { name: 'Grid' })
    expect(gridLink.getAttribute('href')).toBe('/calendar')
  })
})
