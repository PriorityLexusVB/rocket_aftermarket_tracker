import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import ScheduleChip from '@/components/deals/ScheduleChip'
import { MemoryRouter } from 'react-router-dom'

describe('ScheduleChip', () => {
  it('renders nothing without start time', () => {
    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScheduleChip scheduledStartTime={null} scheduledEndTime={null} jobId="1" />
      </MemoryRouter>
    )
    expect(container.querySelector('[data-testid="schedule-chip"]')).toBeNull()
  })

  it('renders with start time only', () => {
    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScheduleChip scheduledStartTime="2025-11-13T09:00:00Z" jobId="deal-1" />
      </MemoryRouter>
    )
    const chip = container.querySelector('[data-testid="schedule-chip"]')
    expect(chip).toBeTruthy()
  })

  it('extracts schedule from deal object with job-level times', () => {
    const deal = {
      id: 'deal-1',
      scheduled_start_time: '2025-11-13T09:00:00Z',
      scheduled_end_time: '2025-11-13T17:00:00Z',
    }
    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScheduleChip deal={deal} />
      </MemoryRouter>
    )
    const chip = container.querySelector('[data-testid="schedule-chip"]')
    expect(chip).toBeTruthy()
  })

  it('extracts schedule from deal with line item times fallback', () => {
    const deal = {
      id: 'deal-2',
      job_parts: [
        {
          scheduled_start_time: '2025-11-13T10:00:00Z',
          scheduled_end_time: '2025-11-13T12:00:00Z',
        },
        {
          scheduled_start_time: '2025-11-13T09:00:00Z',
          scheduled_end_time: '2025-11-13T11:00:00Z',
        },
      ],
    }
    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScheduleChip deal={deal} />
      </MemoryRouter>
    )
    // Should render the earliest scheduled part (09:00)
    const chip = container.querySelector('[data-testid="schedule-chip"]')
    expect(chip).toBeTruthy()
  })

  it('extracts schedule from legacy appt fields', () => {
    const deal = {
      id: 'deal-3',
      appt_start: '2025-11-13T14:00:00Z',
      appt_end: '2025-11-13T15:00:00Z',
    }
    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScheduleChip deal={deal} />
      </MemoryRouter>
    )
    const chip = container.querySelector('[data-testid="schedule-chip"]')
    expect(chip).toBeTruthy()
  })

  it('renders nothing when deal has no scheduling info', () => {
    const deal = { id: 'deal-4' }
    const { container } = render(
      <MemoryRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <ScheduleChip deal={deal} />
      </MemoryRouter>
    )
    expect(container.querySelector('[data-testid="schedule-chip"]')).toBeNull()
  })
})
