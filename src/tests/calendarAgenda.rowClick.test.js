import { describe, expect, it, vi } from 'vitest'
import { getAgendaRowClickHandler, handleAgendaRowKeyDown } from '@/pages/calendar-agenda'

describe('getAgendaRowClickHandler', () => {
  it('opens the deal drawer when enabled', () => {
    const onOpenDealDrawer = vi.fn()
    const navigate = vi.fn()
    const deal = { id: 'job-123' }

    const handler = getAgendaRowClickHandler({
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
    const deal = { id: 'job-456' }

    const handler = getAgendaRowClickHandler({
      dealDrawerEnabled: false,
      onOpenDealDrawer,
      navigate,
      deal,
    })

    handler()

    expect(onOpenDealDrawer).not.toHaveBeenCalled()
    expect(navigate).toHaveBeenCalledWith('/deals/job-456/edit')
  })

  it('does nothing when no deal id is available', () => {
    const onOpenDealDrawer = vi.fn()
    const navigate = vi.fn()

    const handler = getAgendaRowClickHandler({
      dealDrawerEnabled: false,
      onOpenDealDrawer,
      navigate,
      deal: null,
    })

    handler()

    expect(onOpenDealDrawer).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()
  })

  it('triggers row activation on Enter and Space keys', () => {
    const onActivate = vi.fn()
    const preventDefault = vi.fn()

    handleAgendaRowKeyDown({ key: 'Enter', preventDefault }, onActivate)
    handleAgendaRowKeyDown({ key: ' ', preventDefault }, onActivate)

    expect(preventDefault).toHaveBeenCalledTimes(2)
    expect(onActivate).toHaveBeenCalledTimes(2)
  })
})
