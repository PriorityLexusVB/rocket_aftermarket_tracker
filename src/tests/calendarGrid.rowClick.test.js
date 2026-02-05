import { describe, expect, it, vi } from 'vitest'
import { getCalendarGridClickHandler } from '@/pages/calendar'

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
})
