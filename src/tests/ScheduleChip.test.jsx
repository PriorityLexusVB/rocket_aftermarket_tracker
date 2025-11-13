import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import ScheduleChip from '@/components/deals/ScheduleChip'
import { MemoryRouter } from 'react-router-dom'

describe('ScheduleChip', () => {
  it('renders nothing without start time', () => {
    const { container } = render(
      <MemoryRouter>
        <ScheduleChip scheduledStartTime={null} scheduledEndTime={null} jobId="1" />
      </MemoryRouter>
    )
    expect(container.querySelector('[data-testid="schedule-chip"]')).toBeNull()
  })

  it('renders with start time only', () => {
    render(
      <MemoryRouter>
        <ScheduleChip scheduledStartTime="2025-11-13T09:00:00Z" jobId="deal-1" />
      </MemoryRouter>
    )
    expect(screen.getByTestId('schedule-chip')).toBeTruthy()
  })
})
