// src/tests/ScheduleChip.test.jsx
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import ScheduleChip from '../components/deals/ScheduleChip'

// Wrapper for router context
const RouterWrapper = ({ children }) => <BrowserRouter>{children}</BrowserRouter>

describe('ScheduleChip', () => {
  afterEach(() => {
    cleanup()
  })

  it('should not render when no scheduled start time', () => {
    const { container } = render(
      <RouterWrapper>
        <ScheduleChip scheduledStartTime={null} scheduledEndTime={null} />
      </RouterWrapper>
    )
    expect(container.firstChild).toBeNull()
  })

  it('should render formatted schedule range', () => {
    const start = '2024-06-15T10:00:00Z'
    const end = '2024-06-15T12:00:00Z'
    
    render(
      <RouterWrapper>
        <ScheduleChip 
          scheduledStartTime={start} 
          scheduledEndTime={end} 
        />
      </RouterWrapper>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    expect(chip).toBeInTheDocument()
    expect(chip.textContent).toBeTruthy()
  })

  it('should handle missing end time gracefully', () => {
    const start = '2024-06-15T10:00:00Z'
    
    render(
      <RouterWrapper>
        <ScheduleChip 
          scheduledStartTime={start} 
          scheduledEndTime={null} 
        />
      </RouterWrapper>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    expect(chip).toBeInTheDocument()
  })

  it('should call onClick when clicked and navigation disabled', () => {
    const mockOnClick = vi.fn()
    const start = '2024-06-15T10:00:00Z'
    const end = '2024-06-15T12:00:00Z'
    
    render(
      <RouterWrapper>
        <ScheduleChip 
          scheduledStartTime={start} 
          scheduledEndTime={end}
          onClick={mockOnClick}
          enableAgendaNavigation={false}
        />
      </RouterWrapper>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    fireEvent.click(chip)
    
    expect(mockOnClick).toHaveBeenCalledTimes(1)
  })

  it('should be clickable when enableAgendaNavigation is true', () => {
    const start = '2024-06-15T10:00:00Z'
    const end = '2024-06-15T12:00:00Z'
    
    render(
      <RouterWrapper>
        <ScheduleChip 
          scheduledStartTime={start} 
          scheduledEndTime={end}
          jobId="job-123"
          enableAgendaNavigation={true}
        />
      </RouterWrapper>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    expect(chip).not.toBeDisabled()
    
    // Click should work (would navigate in real app)
    fireEvent.click(chip)
  })

  it('should not be clickable when no navigation or onClick provided', () => {
    const start = '2024-06-15T10:00:00Z'
    const end = '2024-06-15T12:00:00Z'
    
    render(
      <RouterWrapper>
        <ScheduleChip 
          scheduledStartTime={start} 
          scheduledEndTime={end}
          enableAgendaNavigation={false}
        />
      </RouterWrapper>
    )
    
    const chip = screen.getByTestId('schedule-chip')
    expect(chip).toBeDisabled()
  })

  it('should render placeholder for invalid schedule', () => {
    render(
      <RouterWrapper>
        <ScheduleChip 
          scheduledStartTime="invalid-date" 
          scheduledEndTime="invalid-date" 
        />
      </RouterWrapper>
    )
    
    // Should show "Not Scheduled" for invalid dates
    expect(screen.getByText('Not Scheduled')).toBeInTheDocument()
  })
})
