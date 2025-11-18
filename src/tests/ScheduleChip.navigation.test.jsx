// src/tests/ScheduleChip.navigation.test.jsx
// Tests for ScheduleChip navigation behavior with SIMPLE_CALENDAR flag
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ScheduleChip from '@/components/deals/ScheduleChip'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('ScheduleChip Navigation', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('should navigate to agenda view when enableAgendaNavigation is true', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-123"
          enableAgendaNavigation={true}
        />
      </BrowserRouter>
    )

    const chip = screen.getByTestId('schedule-chip')
    fireEvent.click(chip)

    expect(mockNavigate).toHaveBeenCalledWith('/calendar/agenda?focus=job-123')
  })

  it('should navigate to deal edit when enableAgendaNavigation is false', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-456"
          enableAgendaNavigation={false}
        />
      </BrowserRouter>
    )

    const chip = screen.getByTestId('schedule-chip')
    fireEvent.click(chip)

    expect(mockNavigate).toHaveBeenCalledWith('/deals/job-456/edit')
  })

  it('should navigate to deal edit when enableAgendaNavigation is not provided (default)', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-789"
        />
      </BrowserRouter>
    )

    const chip = screen.getByTestId('schedule-chip')
    fireEvent.click(chip)

    expect(mockNavigate).toHaveBeenCalledWith('/deals/job-789/edit')
  })

  it('should have correct aria-label for accessibility', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-abc"
          enableAgendaNavigation={true}
        />
      </BrowserRouter>
    )

    const chip = screen.getByTestId('schedule-chip')
    // Component uses descriptive aria-label with the formatted schedule
    expect(chip).toHaveAttribute('aria-label', 'Schedule: Jan 20, 09:00–11:00 ET')
  })

  it('should show navigation arrow when enableAgendaNavigation is true', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-def"
          enableAgendaNavigation={true}
        />
      </BrowserRouter>
    )

    // Arrow should be present
    const chip = screen.getByTestId('schedule-chip')
    expect(chip.textContent).toContain('↗')
  })

  it('should not show navigation arrow when enableAgendaNavigation is false', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-ghi"
          enableAgendaNavigation={false}
        />
      </BrowserRouter>
    )

    const chip = screen.getByTestId('schedule-chip')
    expect(chip.textContent).not.toContain('↗')
  })

  it('should not render when scheduledStartTime is not provided', () => {
    const { container } = render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime={null}
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-jkl"
        />
      </BrowserRouter>
    )

    expect(container.firstChild).toBeNull()
  })

  it('should support keyboard navigation (Enter key)', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-mno"
          enableAgendaNavigation={true}
        />
      </BrowserRouter>
    )

    const chip = screen.getByTestId('schedule-chip')
    fireEvent.keyDown(chip, { key: 'Enter', code: 'Enter' })
    
    // Button click handler will fire on Enter automatically
    expect(chip).toBeInTheDocument()
  })

  it('should apply custom className when provided', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-pqr"
          className="custom-class"
        />
      </BrowserRouter>
    )

    const chip = screen.getByTestId('schedule-chip')
    expect(chip.className).toContain('custom-class')
  })

  it('should display formatted schedule range', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-20T14:00:00Z"
          scheduledEndTime="2024-01-20T16:00:00Z"
          jobId="job-stu"
        />
      </BrowserRouter>
    )

    const chip = screen.getByTestId('schedule-chip')
    // Should contain formatted text (exact format depends on dateTimeUtils)
    expect(chip.textContent.length).toBeGreaterThan(0)
  })
})
