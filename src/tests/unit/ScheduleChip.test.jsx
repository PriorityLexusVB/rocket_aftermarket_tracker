// src/tests/unit/ScheduleChip.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ScheduleChip from '../../components/deals/ScheduleChip'

// Mock useNavigate
const mockNavigate = vi.fn()
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

describe('ScheduleChip', () => {
  beforeEach(() => {
    mockNavigate.mockClear()
  })

  it('should render em dash when no schedule time provided', () => {
    render(
      <BrowserRouter>
        <ScheduleChip scheduledStartTime={null} scheduledEndTime={null} jobId="123" />
      </BrowserRouter>
    )
    expect(screen.getByText('—')).toBeInTheDocument()
  })

  it('should render formatted schedule time', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-15T14:00:00Z"
          scheduledEndTime="2024-01-15T16:00:00Z"
          jobId="123"
        />
      </BrowserRouter>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    expect(chip).toBeInTheDocument()
    expect(chip.textContent).toMatch(/Jan 15/)
  })

  it('should navigate to edit deal when clicked and enableAgendaNavigation is false', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-15T14:00:00Z"
          scheduledEndTime="2024-01-15T16:00:00Z"
          jobId="job-123"
          enableAgendaNavigation={false}
        />
      </BrowserRouter>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    fireEvent.click(chip)
    
    expect(mockNavigate).toHaveBeenCalledWith('/deals?edit=job-123')
  })

  it('should navigate to agenda when clicked and enableAgendaNavigation is true', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-15T14:00:00Z"
          scheduledEndTime="2024-01-15T16:00:00Z"
          jobId="job-456"
          enableAgendaNavigation={true}
        />
      </BrowserRouter>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    fireEvent.click(chip)
    
    expect(mockNavigate).toHaveBeenCalledWith('/calendar/agenda?job=job-456')
  })

  it('should stop event propagation when clicked', () => {
    const mockRowClick = vi.fn()
    
    render(
      <BrowserRouter>
        <div onClick={mockRowClick}>
          <ScheduleChip
            scheduledStartTime="2024-01-15T14:00:00Z"
            scheduledEndTime="2024-01-15T16:00:00Z"
            jobId="job-789"
          />
        </div>
      </BrowserRouter>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    fireEvent.click(chip)
    
    // Row click should not be triggered due to stopPropagation
    expect(mockRowClick).not.toHaveBeenCalled()
  })

  it('should have hover and focus styles', () => {
    render(
      <BrowserRouter>
        <ScheduleChip
          scheduledStartTime="2024-01-15T14:00:00Z"
          scheduledEndTime="2024-01-15T16:00:00Z"
          jobId="123"
        />
      </BrowserRouter>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    expect(chip).toHaveClass('hover:bg-blue-100')
  })
})
