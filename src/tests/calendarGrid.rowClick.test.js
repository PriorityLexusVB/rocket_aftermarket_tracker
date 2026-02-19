import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { getCalendarGridClickHandler, handleCalendarCardKeyDown } from '@/pages/calendar'

describe('getCalendarGridClickHandler', () => {
  it('opens the deal drawer when enabled', () => {
    const onOpenDealDrawer = vi.fn()
    const navigate = vi.fn()
    const deal = { id: 'job-101' }

    const handler = getCalendarGridClickHandler({
      dealDrawerEnabled: true,
      onOpenDealDrawer,
      navigate,
      deal,
    })

    handler()

    expect(onOpenDealDrawer).toHaveBeenCalledWith(deal)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('navigates to the deal when drawer is disabled', () => {
    const onOpenDealDrawer = vi.fn()
    const navigate = vi.fn()
    const deal = { id: 'job-202' }

    const handler = getCalendarGridClickHandler({
      dealDrawerEnabled: false,
      onOpenDealDrawer,
      navigate,
      deal,
    })

    handler()

    expect(onOpenDealDrawer).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/deals/job-202/edit')
  })

  it('does nothing when no deal id is available', () => {
    const onOpenDealDrawer = vi.fn()
    const navigate = vi.fn()

    const handler = getCalendarGridClickHandler({
      dealDrawerEnabled: false,
      onOpenDealDrawer,
      navigate,
      deal: null,
    })

    handler()

    expect(onOpenDealDrawer).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('activates a focusable card with keyboard Enter after tabbing', async () => {
    const user = userEvent.setup()
    const onActivate = vi.fn()

    render(
      <div>
        <button type="button">Before</button>
        <div
          role="button"
          tabIndex={0}
          aria-label="Open deal"
          onKeyDown={(event) => handleCalendarCardKeyDown(event, onActivate)}
        >
          Calendar card
        </div>
      </div>
    )

    await user.tab()
    await user.tab()

    const card = screen.getByRole('button', { name: 'Open deal' })
    expect(card).toHaveFocus()

    fireEvent.keyDown(card, { key: 'Enter', code: 'Enter' })
    expect(onActivate).toHaveBeenCalledTimes(1)
  })
})
