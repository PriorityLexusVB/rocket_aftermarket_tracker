import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/hooks/useTenant', () => ({
  default: () => ({ orgId: 'test-org-id', loading: false }),
}))

vi.mock('@/services/appointmentsService', () => ({
  appointmentsService: {
    listActiveAppointments: vi.fn(() => Promise.resolve({ data: [], error: null })),
    listVendors: vi.fn(() => Promise.resolve({ data: [], error: null })),
    getPerformanceMetrics: vi.fn(() => Promise.resolve({ data: {}, error: null })),
    subscribeJobUpdates: vi.fn(() => ({ unsubscribe: vi.fn() })),
  },
}))

describe('CurrentlyActiveAppointments smoke', () => {
  it('renders without crashing', async () => {
    const mod = await import('@/pages/currently-active-appointments')
    const CurrentlyActiveAppointments = mod.default

    render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <CurrentlyActiveAppointments />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('No Active Appointments')).toBeInTheDocument()
    })

    const legacyBanner = ['Needs', 'assignment'].join(' ')
    const legacyCta = ['Assign', 'Jobs'].join(' ')

    expect(screen.queryByText(legacyBanner)).not.toBeInTheDocument()
    expect(screen.queryByText(legacyCta)).not.toBeInTheDocument()
  }, 20_000)
})
