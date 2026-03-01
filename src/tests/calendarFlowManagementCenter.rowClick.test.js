import { describe, expect, it, vi } from 'vitest'
import { getFlowDealClickHandler } from '@/pages/calendar-flow-management-center'

describe('getFlowDealClickHandler', () => {
  it('opens the deal drawer when enabled', () => {
    const onOpenDealDrawer = vi.fn()
    const navigate = vi.fn()
    const deal = { id: 'job-701' }

    const handler = getFlowDealClickHandler({
      dealDrawerEnabled: true,
      onOpenDealDrawer,
      navigate,
      deal,
    })

    handler()

    expect(onOpenDealDrawer).toHaveBeenCalledWith(deal)
    expect(navigate).not.toHaveBeenCalled()
  })

  it('navigates to deal edit when drawer is disabled', () => {
    const onOpenDealDrawer = vi.fn()
    const navigate = vi.fn()
    const deal = { id: 'job-702' }

    const handler = getFlowDealClickHandler({
      dealDrawerEnabled: false,
      onOpenDealDrawer,
      navigate,
      deal,
    })

    handler()

    expect(onOpenDealDrawer).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/deals/job-702/edit')
  })

  it('does nothing when deal id is missing', () => {
    const onOpenDealDrawer = vi.fn()
    const navigate = vi.fn()

    const handler = getFlowDealClickHandler({
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
