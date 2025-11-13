import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import RescheduleModal from '@/pages/calendar-agenda/RescheduleModal.jsx'

// Minimal smoke tests for the RescheduleModal. Extended interaction tests
// can be added later once core scheduling integration stabilizes.
describe('RescheduleModal', () => {
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
})
