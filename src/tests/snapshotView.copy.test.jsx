import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

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
  getScheduleItems: vi.fn(() => Promise.resolve({ items: [], debug: {} })),
  classifyScheduleState: vi.fn(() => 'scheduled_no_time'),
  getUnscheduledInProgressInHouseItems: vi.fn(() => Promise.resolve({ items: [] })),
  getNeedsSchedulingPromiseItems: vi.fn(() => Promise.resolve({ items: [], debug: {} })),
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
  })
})
