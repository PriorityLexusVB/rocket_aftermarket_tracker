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

  it('closes on escape', () => {
    const onClose = vi.fn()
    render(<DealDrawer open deal={sampleDeal} onClose={onClose} />)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('traps focus within drawer', () => {
    render(<DealDrawer open deal={sampleDeal} onClose={() => {}} />)
    const closeButton = screen.getByLabelText('Close deal drawer')
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

  it('does not render when closed', () => {
    render(<DealDrawer open={false} deal={sampleDeal} onClose={() => {}} />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
