import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDealForm } from '../pages/deals/useDealForm'

const updateDeal = vi.fn(async (id, payload) => ({ id, ...payload }))
const createDeal = vi.fn(async (payload) => ({ id: 'new-deal', ...payload }))
const getDeal = vi.fn(async () => ({}))

vi.mock('../services/dealService', () => ({
  dealService: {
    getDeal: (...args) => getDeal(...args),
    updateDeal: (...args) => updateDeal(...args),
    createDeal: (...args) => createDeal(...args),
  },
  mapDbDealToForm: (deal) => deal,
}))

describe('useDealForm submission guard', () => {
  beforeEach(() => {
    updateDeal.mockClear()
    createDeal.mockClear()
    getDeal.mockClear()
  })

  it('ignores duplicate submissions while a save is in progress', async () => {
    const { result } = renderHook(() => useDealForm({ mode: 'edit', id: 'job-1' }))

    await act(async () => {
      const first = result.current.handleSubmit({ title: 'Deal A' })
      await result.current.handleSubmit({ title: 'Deal B' })
      await first
    })

    expect(updateDeal).toHaveBeenCalledTimes(1)
  })
})
