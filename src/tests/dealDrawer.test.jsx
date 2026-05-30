import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import DealDrawer from '@/components/calendar/DealDrawer'

const sampleDeal = {
  id: 'jobs-123',
  job_number: 'JOB-123',
  title: 'Detail Service',
  job_status: 'scheduled',
  customer_name: 'Test Customer',
}

afterEach(() => {
  cleanup()
})

describe('DealDrawer', () => {
  it('renders when open and shows title', () => {
    render(<DealDrawer open deal={sampleDeal} onClose={() => {}} />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    // Wave XXV-D: hero now leads with customer name (the human identity).
    // Job number "Deal · Job # JOB-123" is rendered as a small label above.
    expect(screen.getByRole('heading', { name: /Test Customer/i })).toBeInTheDocument()
    expect(screen.getByText(/Deal · Job # JOB-123/i)).toBeInTheDocument()
  })

  it('wires aria-labelledby to the title', () => {
    render(<DealDrawer open deal={sampleDeal} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const title = screen.getByRole('heading', { name: /Test Customer/i })
    expect(title).toHaveAttribute('id', labelledBy)
  })

  it('closes on escape', () => {
    const onClose = vi.fn()
    render(<DealDrawer open deal={sampleDeal} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on backdrop click', () => {
    const onClose = vi.fn()
    render(<DealDrawer open deal={sampleDeal} onClose={onClose} />)
    fireEvent.click(screen.getByRole('presentation', { hidden: true }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus within drawer', () => {
    render(<DealDrawer open deal={sampleDeal} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const openDealLink = screen.getByRole('link', { name: /Open deal/i })

    // Wave XXX-M: the drawer's focus trap is order-aware but the focusable
    // element count changes whenever buttons are added/removed (Copy Job #,
    // No-Show, Reschedule, etc.). The invariant the trap actually guarantees
    // is "focus never escapes the drawer." Test the invariant, not the order.

    // Compute the trap's view of first/last directly so this test survives
    // future button additions without being a maintenance trap.
    const focusables = dialog.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    const first = focusables[0]
    const last = focusables[focusables.length - 1]

    // Shift+Tab from FIRST wraps to LAST
    first.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(last).toHaveFocus()

    // Tab from LAST wraps to FIRST
    last.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(first).toHaveFocus()

    // Tab from a middle element keeps focus within drawer
    openDealLink.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).not.toBe(document.body)
    expect(dialog.contains(document.activeElement)).toBe(true)
  })

  it('renders section scaffolding headings', () => {
    render(<DealDrawer open deal={sampleDeal} onClose={() => {}} />)
    expect(screen.getByRole('heading', { name: /Summary/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Line Items/i })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: /Schedule/i })).toBeInTheDocument()
  })

  it('shows enabled primary action when status is available', () => {
    render(<DealDrawer open deal={sampleDeal} onClose={() => {}} />)
    const action = screen.getByRole('button', { name: /Mark In Progress/i })
    expect(action).toBeEnabled()
  })

  it('shows disabled primary action when status is missing', () => {
    render(<DealDrawer open deal={{ ...sampleDeal, job_status: undefined }} onClose={() => {}} />)
    const action = screen.getByRole('button', { name: /Select action/i })
    expect(action).toBeDisabled()
  })

  it('returns focus to the trigger after close button click', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open drawer
          </button>
          {open ? <DealDrawer open deal={sampleDeal} onClose={() => setOpen(false)} /> : null}
        </div>
      )
    }

    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: /Open drawer/i })
    trigger.focus()
    await user.click(trigger)

    const closeButton = await screen.findByRole('button', { name: /close/i })
    await user.click(closeButton)
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger after escape key close', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open drawer
          </button>
          {open ? <DealDrawer open deal={sampleDeal} onClose={() => setOpen(false)} /> : null}
        </div>
      )
    }

    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: /Open drawer/i })
    trigger.focus()
    await user.click(trigger)

    await screen.findByRole('dialog')
    await user.keyboard('{Escape}')
    expect(trigger).toHaveFocus()
  })

  it('returns focus to the trigger after backdrop click', async () => {
    function Harness() {
      const [open, setOpen] = React.useState(false)
      return (
        <div>
          <button type="button" onClick={() => setOpen(true)}>
            Open drawer
          </button>
          {open ? <DealDrawer open deal={sampleDeal} onClose={() => setOpen(false)} /> : null}
        </div>
      )
    }

    const user = userEvent.setup()
    render(<Harness />)
    const trigger = screen.getByRole('button', { name: /Open drawer/i })
    trigger.focus()
    await user.click(trigger)

    const backdrop = await screen.findByTestId('deal-drawer-backdrop')
    await user.click(backdrop)
    expect(trigger).toHaveFocus()
  })

  it('does not render when closed', () => {
    render(<DealDrawer open={false} deal={sampleDeal} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
