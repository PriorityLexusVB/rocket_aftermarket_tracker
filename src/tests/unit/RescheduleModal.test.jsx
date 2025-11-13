// src/tests/unit/RescheduleModal.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import RescheduleModal from '../../pages/calendar-agenda/RescheduleModal'

describe('RescheduleModal', () => {
  const mockEvent = {
    id: 'job-123',
    title: 'Test Job',
    customer_name: 'John Doe',
    scheduled_start_time: '2024-01-15T14:00:00Z',
    scheduled_end_time: '2024-01-15T16:00:00Z',
    location: 'Bay 1',
    scheduling_notes: 'Test notes',
  }

  it('should not render when open is false', () => {
    render(<RescheduleModal open={false} onClose={vi.fn()} onSubmit={vi.fn()} event={mockEvent} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('should render modal when open is true', () => {
    render(<RescheduleModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} event={mockEvent} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText('Reschedule Appointment')).toBeInTheDocument()
  })

  it('should display event title and customer name', () => {
    render(<RescheduleModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} event={mockEvent} />)
    expect(screen.getByText('Test Job')).toBeInTheDocument()
    expect(screen.getByText('John Doe')).toBeInTheDocument()
  })

  it('should populate form fields with event data', () => {
    render(<RescheduleModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} event={mockEvent} />)
    
    const locationInput = screen.getByLabelText(/Location/i)
    const notesInput = screen.getByLabelText(/Notes/i)
    
    expect(locationInput).toHaveValue('Bay 1')
    expect(notesInput).toHaveValue('Test notes')
  })

  it('should show validation error when start time is missing', async () => {
    render(<RescheduleModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} event={{}} />)
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Start time is required')).toBeInTheDocument()
    })
  })

  it('should show validation error when end time is before start time', async () => {
    render(<RescheduleModal open={true} onClose={vi.fn()} onSubmit={vi.fn()} event={{}} />)
    
    const startInput = screen.getByLabelText(/Start Time/i)
    const endInput = screen.getByLabelText(/End Time/i)
    
    fireEvent.change(startInput, { target: { value: '2024-01-15T16:00' } })
    fireEvent.change(endInput, { target: { value: '2024-01-15T14:00' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('End time must be after start time')).toBeInTheDocument()
    })
  })

  it('should call onSubmit with correct data when valid', async () => {
    const mockOnSubmit = vi.fn().mockResolvedValue(undefined)
    render(<RescheduleModal open={true} onClose={vi.fn()} onSubmit={mockOnSubmit} event={{}} />)
    
    const startInput = screen.getByLabelText(/Start Time/i)
    const endInput = screen.getByLabelText(/End Time/i)
    const locationInput = screen.getByLabelText(/Location/i)
    
    fireEvent.change(startInput, { target: { value: '2024-01-15T14:00' } })
    fireEvent.change(endInput, { target: { value: '2024-01-15T16:00' } })
    fireEvent.change(locationInput, { target: { value: 'Bay 3' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          location: 'Bay 3',
        })
      )
    })
  })

  it('should call onClose when cancel button is clicked', () => {
    const mockOnClose = vi.fn()
    render(<RescheduleModal open={true} onClose={mockOnClose} onSubmit={vi.fn()} event={mockEvent} />)
    
    const cancelButton = screen.getByText('Cancel')
    fireEvent.click(cancelButton)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should call onClose when clicking outside modal', () => {
    const mockOnClose = vi.fn()
    render(<RescheduleModal open={true} onClose={mockOnClose} onSubmit={vi.fn()} event={mockEvent} />)
    
    const backdrop = screen.getByRole('dialog')
    fireEvent.click(backdrop)
    
    expect(mockOnClose).toHaveBeenCalled()
  })

  it('should disable inputs and show loading state when submitting', async () => {
    const mockOnSubmit = vi.fn().mockImplementation(() => new Promise(() => {})) // Never resolves
    render(<RescheduleModal open={true} onClose={vi.fn()} onSubmit={mockOnSubmit} event={{}} />)
    
    const startInput = screen.getByLabelText(/Start Time/i)
    const endInput = screen.getByLabelText(/End Time/i)
    
    fireEvent.change(startInput, { target: { value: '2024-01-15T14:00' } })
    fireEvent.change(endInput, { target: { value: '2024-01-15T16:00' } })
    
    const saveButton = screen.getByText('Save Changes')
    fireEvent.click(saveButton)
    
    await waitFor(() => {
      expect(screen.getByText('Saving...')).toBeInTheDocument()
      expect(startInput).toBeDisabled()
      expect(endInput).toBeDisabled()
    })
  })
})
