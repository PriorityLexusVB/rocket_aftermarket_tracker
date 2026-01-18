import { describe, expect, it, vi } from 'vitest'

function makeChainableQuery() {
  const q = {
    select: () => q,
    eq: () => q,
    not: () => q,
    gte: () => q,
    lt: () => q,
    is: () => q,
    in: () => q,
  }
  return q
}

describe('scheduleItemsService.getNeedsSchedulingPromiseItems', () => {
  it('returns empty items even if jobsJoin candidate query fails', async () => {
    vi.resetModules()

    const safeSelect = vi.fn(async (_query, label) => {
      if (String(label).includes('scheduleItems:needsScheduling:candidates:jobsJoin')) {
        throw new Error('relationship missing')
      }
      return []
    })

    vi.doMock('@/lib/supabase', () => ({
      supabase: {
        from: () => makeChainableQuery(),
      },
    }))

    vi.doMock('@/lib/supabase/safeSelect', () => ({
      safeSelect,
    }))

    vi.doMock('@/services/dealService', () => ({
      getCapabilities: () => ({}),
    }))

    // Avoid accidentally calling into these in this test.
    vi.doMock('@/services/jobService', () => ({
      jobService: { getJobsByIds: vi.fn() },
    }))

    vi.doMock('@/services/calendarService', () => ({
      calendarService: {},
    }))

    const { getNeedsSchedulingPromiseItems } = await import('@/services/scheduleItemsService')

    const out = await getNeedsSchedulingPromiseItems({
      orgId: 'org-test',
      rangeStart: new Date('2026-01-01T00:00:00Z'),
      rangeEnd: new Date('2026-02-01T00:00:00Z'),
    })

    expect(out).toMatchObject({
      items: [],
      debug: { candidateJobs: 0, hydrated: 0, kept: 0 },
    })

    expect(safeSelect).toHaveBeenCalled()
  })
})
