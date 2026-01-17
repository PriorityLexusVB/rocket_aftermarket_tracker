import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockGetScheduledJobsByDateRange = vi.fn()
const mockGetNeedsSchedulingPromiseItems = vi.fn()

vi.mock('@/hooks/useTenant', () => ({
  default: () => ({ orgId: 'dealer-test', loading: false }),
}))

vi.mock('@/services/scheduleItemsService', () => ({
  getScheduledJobsByDateRange: (...args) => mockGetScheduledJobsByDateRange(...args),
  getNeedsSchedulingPromiseItems: (...args) => mockGetNeedsSchedulingPromiseItems(...args),
}))

vi.mock('@/services/vendorService', () => ({
  vendorService: {
    getAllVendors: vi.fn(async () => []),
  },
}))

describe('CalendarFlowManagementCenter all-day grid', () => {
  beforeEach(() => {
    const now = new Date()
    const dayOfWeek = now.getDay()
    const monday = new Date(now)
    // Match the component's week logic: Monday start (Mon–Sun), stable even on Sundays.
    const diffToMonday = (dayOfWeek + 6) % 7
    monday.setDate(now.getDate() - diffToMonday)
    monday.setHours(12, 0, 0, 0)
    const promisedAtIso = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`

    mockGetScheduledJobsByDateRange.mockResolvedValue({ jobs: [] })
    mockGetNeedsSchedulingPromiseItems.mockResolvedValue({
      items: [
        {
          promisedAt: promisedAtIso,
          raw: {
            id: 80158,
            job_number: 'JOB-80158',
            title: '2025 RX 350',
            vehicle_info: '2025 RX 350',
            job_status: 'pending',
            vendor_id: null,
            location: 'on_site',
            scheduled_start_time: null,
            scheduled_end_time: null,
          },
        },
      ],
    })
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it('does not show empty-state when all-day items exist in view', async () => {
    const mod = await import('@/pages/calendar-flow-management-center')
    const CalendarFlowManagementCenter = mod.default

    await act(async () => {
      render(
        <MemoryRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <CalendarFlowManagementCenter />
        </MemoryRouter>
      )
    })

    await waitFor(() => {
      expect(mockGetScheduledJobsByDateRange).toHaveBeenCalled()
      expect(mockGetNeedsSchedulingPromiseItems).toHaveBeenCalled()
    })

    // Renders the All-day queue item (title + vehicle info may duplicate the label).
    await screen.findAllByText('2025 RX 350')

    expect(screen.queryByText(/No jobs this week\./i)).not.toBeInTheDocument()

    // Promise date should be derived (not blank dash).
    expect(screen.queryByText('Promise: —')).not.toBeInTheDocument()
  })
})
