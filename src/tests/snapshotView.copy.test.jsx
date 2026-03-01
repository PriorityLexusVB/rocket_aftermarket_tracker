import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

const mockGetScheduleItems = vi.fn(() => Promise.resolve({ items: [], debug: {} }))
const mockGetUnscheduledInProgressInHouseItems = vi.fn(() => Promise.resolve({ items: [] }))
const mockGetNeedsSchedulingPromiseItems = vi.fn(() => Promise.resolve({ items: [], debug: {} }))

vi.mock('@/hooks/useTenant', () => ({
  default: () => ({ orgId: 'test-org-id', loading: false }),
}))

vi.mock('@/components/ui/ToastProvider', () => ({
  useToast: () => ({ info: vi.fn(), success: vi.fn(), error: vi.fn() }),
}))

vi.mock('@/components/ui/SupabaseConfigNotice', () => ({
  default: () => null,
}))

vi.mock('@/services/scheduleItemsService', () => ({
  getScheduleItems: (...args) => mockGetScheduleItems(...args),
  classifyScheduleState: vi.fn(() => 'scheduled_no_time'),
  getUnscheduledInProgressInHouseItems: (...args) =>
    mockGetUnscheduledInProgressInHouseItems(...args),
  getNeedsSchedulingPromiseItems: (...args) => mockGetNeedsSchedulingPromiseItems(...args),
}))

import SnapshotView from '@/pages/currently-active-appointments/components/SnapshotView'

describe('SnapshotView copy', () => {
  it('renders promised all-day label and empty-state copy', async () => {
    render(
      <MemoryRouter initialEntries={['/currently-active-appointments?window=all_day']}>
        <SnapshotView />
      </MemoryRouter>
    )

    await waitFor(() => {
      expect(screen.getByText('Promised (All-day)')).toBeTruthy()
    })

    expect(screen.getByText('No promised all-day items in this range.')).toBeTruthy()
    expect(
      screen.getByText(
        'All-day promised items have a date but no time window yet. Completed jobs are hidden in this view.'
      )
    ).toBeTruthy()

    expect(screen.getByText('Window: Promised (All-day, last 30 days)')).toBeTruthy()

    await waitFor(() => {
      expect(mockGetNeedsSchedulingPromiseItems).toHaveBeenCalled()
    })

    const firstCall = mockGetNeedsSchedulingPromiseItems.mock.calls[0]?.[0] || {}
    expect(firstCall.orgId).toBe('test-org-id')
    expect(firstCall.rangeStart).toBeInstanceOf(Date)
    expect(firstCall.rangeEnd).toBeInstanceOf(Date)

    const msPerDay = 24 * 60 * 60 * 1000
    const lookbackDays = Math.round((Date.now() - firstCall.rangeStart.getTime()) / msPerDay)
    expect(lookbackDays).toBeGreaterThanOrEqual(29)
    expect(lookbackDays).toBeLessThanOrEqual(31)
  })
})
