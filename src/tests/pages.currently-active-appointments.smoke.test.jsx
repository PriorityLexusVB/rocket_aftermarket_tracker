import React from 'react'
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

describe('CurrentlyActiveAppointments smoke', () => {
  it('renders without crashing', async () => {
    const mod = await import('@/pages/currently-active-appointments')
    const CurrentlyActiveAppointments = mod.default

    expect(() => {
      render(
        <MemoryRouter>
          <CurrentlyActiveAppointments />
        </MemoryRouter>
      )
    }).not.toThrow()
  })
})
