import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { appointmentsService } from '@/services/appointmentsService'

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
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(appointmentsService.listActiveAppointments).mockResolvedValue({ data: [], error: null })
  })
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

    expect(
      await screen.findByRole('heading', { name: /currently active appointments/i })
    ).toBeInTheDocument()

    const EMPTY_STATE_RE =
      /(no\s+(currently\s+)?active\s+appointments|no\s+active\s+appointments|no\s+appointments|no\s+jobs)/i

        await waitFor(() => {
      expect(screen.getAllByText(EMPTY_STATE_RE).length).toBeGreaterThan(0)
        })

    const legacyBanner = ['Needs', 'assignment'].join(' ')
    const legacyCta = ['Assign', 'Jobs'].join(' ')

    expect(screen.queryByText(legacyBanner)).not.toBeInTheDocument()
    expect(screen.queryByText(legacyCta)).not.toBeInTheDocument()
  }, 20_000)

  it('shows a retryable error instead of a false empty state when loading fails', async () => {
    appointmentsService.listActiveAppointments.mockResolvedValueOnce({
      data: [],
      error: new Error('database unavailable'),
    })
    const { default: CurrentlyActiveAppointments } = await import('@/pages/currently-active-appointments')
    render(<MemoryRouter><CurrentlyActiveAppointments /></MemoryRouter>)
    expect(await screen.findByRole('alert')).toHaveTextContent('Appointments could not be loaded')
    expect(screen.getByRole('button', { name: /retry loading appointments/i })).toBeInTheDocument()
    expect(screen.queryByText('No Active Appointments')).not.toBeInTheDocument()
  })
})
