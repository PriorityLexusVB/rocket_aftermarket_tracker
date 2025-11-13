// src/tests/RescheduleModal.test.jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RescheduleModal from '../pages/calendar-agenda/RescheduleModal'

describe('RescheduleModal', () => {
  const mockOnClose = vi.fn()
  const mockOnSubmit = vi.fn()
  const mockJob = {
    id: '123',
    title: 'Test Job',
    job_number: 'JOB-001',
    scheduled_start_time: '2024-06-15T10:00:00Z',
    scheduled_end_time: '2024-06-15T11:00:00Z',
  }

  beforeEach(() => {
    mockOnClose.mockClear()
    mockOnSubmit.mockClear()
  })

  it('should not render when closed', () => {
    const { container } = render(
      <RescheduleModal
        open={false}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    expect(container.firstChild).toBeNull()
  })

  it('should render when open', () => {
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Reschedule Appointment')).toBeInTheDocument()
  })

  it('should display job title', () => {
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    expect(screen.getByText('Test Job')).toBeInTheDocument()
  })

  it('should populate fields with initial values', () => {
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    const startInput = screen.getByLabelText(/Start Time/i)
    const endInput = screen.getByLabelText(/End Time/i)
    
    // Should have values (format may vary by timezone)
    expect(startInput.value).toBeTruthy()
    expect(endInput.value).toBeTruthy()
  })

  it('should show error when end time is before start time', async () => {
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    const startInput = screen.getByLabelText(/Start Time/i)
    const endInput = screen.getByLabelText(/End Time/i)
    
    // Set end time before start time
    fireEvent.change(startInput, { target: { value: '2024-06-15T10:00' } })
    fireEvent.change(endInput, { target: { value: '2024-06-15T09:00' } })
    
    const saveButton = screen.getByRole('button', { name: /Save/i })
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument()
      expect(screen.getByText(/End time must be after start time/i)).toBeInTheDocument()
    })
    
    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('should call onClose when cancel is clicked', () => {
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    const cancelButton = screen.getByRole('button', { name: /Cancel/i })
    fireEvent.click(cancelButton)
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should call onClose when ESC is pressed', () => {
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    fireEvent.keyDown(document, { key: 'Escape' })
    
    expect(mockOnClose).toHaveBeenCalledTimes(1)
  })

  it('should submit with valid times', async () => {
    mockOnSubmit.mockResolvedValue(true)
    
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    const startInput = screen.getByLabelText(/Start Time/i)
    const endInput = screen.getByLabelText(/End Time/i)
    
    // Set valid times
    fireEvent.change(startInput, { target: { value: '2024-06-15T10:00' } })
    fireEvent.change(endInput, { target: { value: '2024-06-15T12:00' } })
    
    const saveButton = screen.getByRole('button', { name: /Save/i })
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledTimes(1)
    })
    
    // Check that ISO timestamps were passed
    const callArgs = mockOnSubmit.mock.calls[0][0]
    expect(callArgs.startTime).toBeTruthy()
    expect(callArgs.endTime).toBeTruthy()
  })

  it('should disable save button when form is invalid', () => {
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    const startInput = screen.getByLabelText(/Start Time/i)
    
    // Clear start time
    fireEvent.change(startInput, { target: { value: '' } })
    
    const saveButton = screen.getByRole('button', { name: /Save/i })
    expect(saveButton).toBeDisabled()
  })

  it('should show timezone note', () => {
    render(
      <RescheduleModal
        open={true}
        onClose={mockOnClose}
        onSubmit={mockOnSubmit}
        job={mockJob}
      />
    )
    
    expect(screen.getByText(/America\/New_York timezone/i)).toBeInTheDocument()
  })
})
