import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getVendors, prefetchDropdowns, clearDropdownCache } from '../services/dropdownService'

const { mockQuery, fromSpy, getSession, getUser } = vi.hoisted(() => {
  const mockQuery = {
    select: vi.fn(() => mockQuery),
    order: vi.fn(() => mockQuery),
    eq: vi.fn(() => mockQuery),
    or: vi.fn(() => mockQuery),
    in: vi.fn(() => mockQuery),
    throwOnError: vi.fn(async () => ({ data: [] })),
  }

  return {
    mockQuery,
    fromSpy: vi.fn(() => mockQuery),
    getSession: vi.fn(async () => ({ data: { session: null }, error: null })),
    getUser: vi.fn(async () => ({ data: { user: null }, error: null })),
  }
})

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession,
      getUser,
    },
    from: fromSpy,
  },
}))

describe('dropdownService auth guard', () => {
  beforeEach(() => {
    fromSpy.mockClear()
    mockQuery.throwOnError.mockClear()
    getSession.mockClear()
    clearDropdownCache()
  })

  it('returns empty vendors without calling supabase when unauthenticated', async () => {
    const vendors = await getVendors()
    expect(vendors).toEqual([])
    expect(fromSpy).not.toHaveBeenCalled()
  })

  it('prefetchDropdowns is a no-op without a session', async () => {
    await prefetchDropdowns()
    expect(fromSpy).not.toHaveBeenCalled()
  })
})
