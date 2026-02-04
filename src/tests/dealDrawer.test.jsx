import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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
    expect(screen.getByRole('heading', { name: /Detail Service/i })).toBeInTheDocument()
  })

  it('wires aria-labelledby to the title', () => {
    render(<DealDrawer open deal={sampleDeal} onClose={() => {}} />)
    const dialog = screen.getByRole('dialog')
    const labelledBy = dialog.getAttribute('aria-labelledby')
    expect(labelledBy).toBeTruthy()
    const title = screen.getByRole('heading', { name: /Detail Service/i })
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
    const openDealLink = screen.getByRole('link', { name: /Open deal/i })
    const primaryAction = screen.getByRole('button', { name: /Mark In Progress/i })

    // Shift+Tab from first element should wrap to last
    openDealLink.focus()
    fireEvent.keyDown(document, { key: 'Tab', shiftKey: true })
    expect(primaryAction).toHaveFocus()

    // Tab from last element should wrap to first
    primaryAction.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(openDealLink).toHaveFocus()

    // Tab between elements should keep focus within drawer
    openDealLink.focus()
    fireEvent.keyDown(document, { key: 'Tab' })
    expect(document.activeElement).not.toBe(document.body)
  })

  it('returns focus to the trigger on close', async () => {
    function Wrapper() {
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

    render(<Wrapper />)
    const trigger = screen.getByRole('button', { name: /Open drawer/i })
    trigger.focus()
    fireEvent.click(trigger)

    await screen.findByLabelText('Close deal drawer')
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(trigger).toHaveFocus()
  })

  it('does not render when closed', () => {
    render(<DealDrawer open={false} deal={sampleDeal} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
