import { describe, it, expect, vi, beforeEach } from 'vitest'

const inCallSizes = []

vi.mock('@/lib/supabase', () => {
  const makeQuery = () => {
    const q = {
      _inValues: [],
      select: vi.fn(() => q),
      in: vi.fn((_col, values) => {
        const arr = Array.isArray(values) ? values : []
        inCallSizes.push(arr.length)
        q._inValues = arr
        return q
      }),
      is: vi.fn(() => q),
      eq: vi.fn(() => q),
    }
    return q
  }

  return {
    supabase: {
      from: vi.fn(() => makeQuery()),
    },
  }
})

vi.mock('@/lib/supabase/safeSelect', () => ({
  safeSelect: vi.fn(async (q) => {
    const ids = Array.isArray(q?._inValues) ? q._inValues : []
    // Return a single row per chunk so we can verify mapping.
    const first = ids[0]
    return first ? [{ id: `la-${first}`, job_id: first }] : []
  }),
}))

vi.mock('@/services/calendarService', () => ({
  calendarService: {
    getJobsByDateRange: vi.fn(async () => ({ data: [], error: null })),
  },
}))

vi.mock('@/services/jobService', () => ({
  jobService: {
    getJobsByIds: vi.fn(async (ids) => ids.map((id) => ({ id }))),
  },
}))

vi.mock('@/services/dealService', () => ({
  getCapabilities: vi.fn(async () => ({ data: {}, error: null })),
}))

describe('scheduleItemsService - loaner_assignments chunking', () => {
  beforeEach(() => {
    inCallSizes.length = 0
    vi.clearAllMocks()
  })

  it('chunks loaner_assignments job_id filters to avoid huge URL queries', async () => {
    const { calendarService } = await import('@/services/calendarService')

    const ids = Array.from({ length: 120 }).map((_, i) => `job-${i + 1}`)
    calendarService.getJobsByDateRange.mockResolvedValue({
      data: ids.map((id) => ({
        id,
        scheduled_start_time: '2026-01-01T12:00:00Z',
        scheduled_end_time: '2026-01-01T13:00:00Z',
      })),
      error: null,
    })

    const { getScheduledJobsByDateRange } = await import('@/services/scheduleItemsService')

    const result = await getScheduledJobsByDateRange({
      rangeStart: '2026-01-01T00:00:00Z',
      rangeEnd: '2026-01-02T00:00:00Z',
      orgId: 'dealer-test',
    })

    expect(result.jobs).toHaveLength(120)

    // Default chunk size is 20 => 120 ids => 6 calls: 20 x 6
    expect(inCallSizes).toEqual([20, 20, 20, 20, 20, 20])
    expect(Math.max(...inCallSizes)).toBeLessThanOrEqual(20)

    // Each chunk returns one active loaner row for the first id in that chunk.
    const flagged = result.jobs.filter((j) => j.has_active_loaner)
    expect(flagged.map((j) => j.id)).toEqual([
      'job-1',
      'job-21',
      'job-41',
      'job-61',
      'job-81',
      'job-101',
    ])
  })
})
