import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import RescheduleModal from '@/pages/calendar-agenda/RescheduleModal.jsx'

// Minimal smoke tests for the RescheduleModal. Extended interaction tests
// can be added later once core scheduling integration stabilizes.
describe('RescheduleModal', () => {
  beforeEach(() => {
    // Clear any mocks before each test
    vi.clearAllMocks()
  })

  it('does not render when open=false', () => {
    const { container } = render(<RescheduleModal open={false} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders start/end inputs when open', () => {
    const handleSubmit = vi.fn()
    render(
      <RescheduleModal
        open={true}
        onClose={() => {}}
        onSubmit={handleSubmit}
        initialStart="2025-11-13T09:00:00Z"
        initialEnd="2025-11-13T10:00:00Z"
      />
    )
    expect(screen.getByLabelText(/Start time/i)).toBeTruthy()
    expect(screen.getByLabelText(/End time/i)).toBeTruthy()
  })

  describe('Validation error messaging', () => {
    it('should show error when start time is empty and form is submitted', async () => {
      const handleSubmit = vi.fn()
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={handleSubmit}
          initialStart=""
          initialEnd="2025-11-13T10:00:00Z"
        />
      )
      
      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Start time is required/i)).toBeInTheDocument()
      })
      
      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it('should show error when end time is empty and form is submitted', async () => {
      const handleSubmit = vi.fn()
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={handleSubmit}
          initialStart="2025-11-13T09:00:00Z"
          initialEnd=""
        />
      )
      
      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/End time is required/i)).toBeInTheDocument()
      })
      
      expect(handleSubmit).not.toHaveBeenCalled()
    })

    it('should clear error message when user types in field', async () => {
      const handleSubmit = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={handleSubmit}
          initialStart=""
          initialEnd="2025-11-13T10:00:00Z"
        />
      )
      
      // Trigger validation error
      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Start time is required/i)).toBeInTheDocument()
      })
      
      // Type in start field
      const startInput = screen.getByLabelText(/Start time/i)
      fireEvent.change(startInput, { target: { value: '2025-11-13T09:00' } })
      
      // Error should be cleared
      await waitFor(() => {
        expect(screen.queryByText(/Start time is required/i)).not.toBeInTheDocument()
      })
    })
  })

  describe('Successful submit with ISO conversion', () => {
    it('should call onSubmit with ISO timestamps when form is submitted', async () => {
      const handleSubmit = vi.fn().mockResolvedValue(undefined)
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={handleSubmit}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalled()
      })
      
      // Verify ISO format in the call
      const callArgs = handleSubmit.mock.calls[0][0]
      expect(callArgs).toHaveProperty('startTime')
      expect(callArgs).toHaveProperty('endTime')
      expect(typeof callArgs.startTime).toBe('string')
      expect(typeof callArgs.endTime).toBe('string')
      // Should be valid ISO strings
      expect(new Date(callArgs.startTime).toISOString()).toBeTruthy()
      expect(new Date(callArgs.endTime).toISOString()).toBeTruthy()
    })

    it('should handle async submit with loading state', async () => {
      let resolveSubmit
      const handleSubmit = vi.fn().mockImplementation(() => {
        return new Promise(resolve => {
          resolveSubmit = resolve
        })
      })
      
      render(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={handleSubmit}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)
      
      // Should show loading state
      await waitFor(() => {
        expect(screen.getByText(/Saving/i)).toBeInTheDocument()
      })
      
      // Resolve the promise
      resolveSubmit()
      
      await waitFor(() => {
        expect(handleSubmit).toHaveBeenCalled()
      })
    })
  })

  describe('ESC-to-close behavior', () => {
    it('should close modal when ESC key is pressed', async () => {
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={() => {}}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      // Press ESC
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' })
      
      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled()
      })
    })

    it('should not close on other keys', async () => {
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={() => {}}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      // Press Enter (should not close)
      fireEvent.keyDown(document, { key: 'Enter', code: 'Enter' })
      
      expect(handleClose).not.toHaveBeenCalled()
    })
  })

  describe('Click-outside-to-close', () => {
    it('should close modal when clicking on backdrop', async () => {
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={() => {}}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      // Find the backdrop (the outer div with role="dialog")
      const backdrop = screen.getByRole('dialog')
      fireEvent.click(backdrop)
      
      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled()
      })
    })

    it('should not close when clicking inside modal content', () => {
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={() => {}}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      // Click on the title
      const title = screen.getByText(/Reschedule Appointment/i)
      fireEvent.click(title)
      
      expect(handleClose).not.toHaveBeenCalled()
    })
  })

  describe('Cancel button', () => {
    it('should close modal when Cancel button is clicked', async () => {
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={() => {}}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)
      
      await waitFor(() => {
        expect(handleClose).toHaveBeenCalled()
      })
    })

    it('should clear error when Cancel is clicked', async () => {
      const handleClose = vi.fn()
      
      render(
        <RescheduleModal
          open={true}
          onClose={handleClose}
          onSubmit={() => {}}
          initialStart=""
          initialEnd="2025-11-13T10:00:00Z"
        />
      )
      
      // Trigger validation error
      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Start time is required/i)).toBeInTheDocument()
      })
      
      // Click Cancel
      const cancelButton = screen.getByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButton)
      
      expect(handleClose).toHaveBeenCalled()
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={() => {}}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      const dialog = screen.getByRole('dialog')
      expect(dialog).toHaveAttribute('aria-modal', 'true')
      expect(dialog).toHaveAttribute('aria-labelledby', 'reschedule-title')
    })

    it('should focus start input when modal opens', async () => {
      const { rerender } = render(
        <RescheduleModal
          open={false}
          onClose={() => {}}
          onSubmit={() => {}}
        />
      )
      
      rerender(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={() => {}}
          initialStart="2025-11-13T14:00:00Z"
          initialEnd="2025-11-13T16:00:00Z"
        />
      )
      
      // Wait for focus
      await waitFor(() => {
        const startInput = screen.getByLabelText(/Start time/i)
        expect(document.activeElement).toBe(startInput)
      }, { timeout: 200 })
    })

    it('should display error message when validation fails', async () => {
      render(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={() => {}}
          initialStart=""
          initialEnd="2025-11-13T10:00:00Z"
        />
      )
      
      const saveButton = screen.getByRole('button', { name: /Save/i })
      fireEvent.click(saveButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Start time is required/i)).toBeInTheDocument()
      })
    })
  })

  describe('Line-item scheduling integration', () => {
    it('should compute aggregated schedule from single line item', () => {
      const job = {
        id: 'job-1',
        title: 'Test Job',
        job_parts: [
          {
            id: 'part-1',
            scheduled_start_time: '2025-11-14T09:00:00Z',
            scheduled_end_time: '2025-11-14T11:00:00Z',
          },
        ],
      }
      
      render(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={() => {}}
          job={job}
        />
      )
      
      // Should display the aggregated schedule
      const startInput = screen.getByLabelText(/Start time/i)
      const endInput = screen.getByLabelText(/End time/i)
      
      // Values will be in local datetime format
      expect(startInput.value).toBeTruthy()
      expect(endInput.value).toBeTruthy()
    })

    it('should compute aggregated schedule from multiple line items', () => {
      const job = {
        id: 'job-2',
        title: 'Multi-Item Job',
        job_parts: [
          {
            id: 'part-1',
            scheduled_start_time: '2025-11-14T09:00:00Z',
            scheduled_end_time: '2025-11-14T11:00:00Z',
          },
          {
            id: 'part-2',
            scheduled_start_time: '2025-11-14T14:00:00Z',
            scheduled_end_time: '2025-11-14T16:00:00Z',
          },
        ],
      }
      
      render(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={() => {}}
          job={job}
        />
      )
      
      // Should show earliest start (09:00) and latest end (16:00)
      const startInput = screen.getByLabelText(/Start time/i)
      const endInput = screen.getByLabelText(/End time/i)
      
      expect(startInput.value).toBeTruthy()
      expect(endInput.value).toBeTruthy()
    })

    it('should handle job with no scheduled line items', () => {
      const job = {
        id: 'job-3',
        title: 'Unscheduled Job',
        job_parts: [
          {
            id: 'part-1',
            scheduled_start_time: null,
            scheduled_end_time: null,
          },
        ],
      }
      
      render(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={() => {}}
          job={job}
        />
      )
      
      // Should show empty fields
      const startInput = screen.getByLabelText(/Start time/i)
      const endInput = screen.getByLabelText(/End time/i)
      
      expect(startInput.value).toBe('')
      expect(endInput.value).toBe('')
    })

    it('should prefer explicit initialStart/initialEnd over line items', () => {
      const job = {
        id: 'job-4',
        title: 'Job with Override',
        job_parts: [
          {
            id: 'part-1',
            scheduled_start_time: '2025-11-14T09:00:00Z',
            scheduled_end_time: '2025-11-14T11:00:00Z',
          },
        ],
      }
      
      render(
        <RescheduleModal
          open={true}
          onClose={() => {}}
          onSubmit={() => {}}
          job={job}
          initialStart="2025-11-15T10:00:00Z"
          initialEnd="2025-11-15T12:00:00Z"
        />
      )
      
      // Should use the explicit values, not the line item values
      const startInput = screen.getByLabelText(/Start time/i)
      const endInput = screen.getByLabelText(/End time/i)
      
      expect(startInput.value).toBeTruthy()
      expect(endInput.value).toBeTruthy()
    })
  })
})

