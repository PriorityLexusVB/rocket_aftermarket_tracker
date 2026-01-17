import { describe, it, expect, vi, beforeEach } from 'vitest'
import { supabase } from '@/lib/supabase'
import * as safeSelectModule from '@/lib/supabase/safeSelect'
import { jobService } from '@/services/jobService'
import * as dealServiceModule from '@/services/dealService'
import { getNeedsSchedulingPromiseItems } from '../../src/services/scheduleItemsService.js'

const makeChain = () => {
  const chain: any = {}
  const methods = ['select', 'eq', 'not', 'gte', 'lt', 'is', 'in', 'limit', 'lte', 'order', 'neq']
  for (const m of methods) chain[m] = () => chain
  return chain
}

describe('getNeedsSchedulingPromiseItems (multi-date)', () => {
  const safeSelectSpy = vi.spyOn(safeSelectModule, 'safeSelect')
  const getJobsByIdsSpy = vi.spyOn(jobService, 'getJobsByIds')
  const getCapabilitiesSpy = vi.spyOn(dealServiceModule, 'getCapabilities')
  const fromSpy = vi.spyOn(supabase as any, 'from')

  beforeEach(() => {
    safeSelectSpy.mockReset()
    getJobsByIdsSpy.mockReset()
    getCapabilitiesSpy.mockReset()
    fromSpy.mockReset()

    getCapabilitiesSpy.mockReturnValue({ jobPartsHasTimes: true } as any)
    fromSpy.mockImplementation(() => makeChain())

    safeSelectSpy.mockImplementation(async (_q: unknown, trace: string) => {
      if (trace === 'scheduleItems:needsScheduling:partIds:dealer_id') {
        return [
          { job_id: 'job-1', promised_date: '2026-01-19' },
          { job_id: 'job-1', promised_date: '2026-01-20' },
        ]
      }
      if (trace === 'scheduleItems:loaners') {
        return []
      }
      if (trace === 'scheduleItems:needsScheduling:candidates:jobsJoin') {
        return []
      }
      return []
    })

    getJobsByIdsSpy.mockResolvedValue([
      {
        id: 'job-1',
        job_status: 'pending',
        job_number: 'JOB-80158',
        title: 'Test Deal',
        vendor_id: null,
        job_parts: [
          {
            id: 'jp-1',
            requires_scheduling: true,
            promised_date: '2026-01-19',
            scheduled_start_time: null,
            scheduled_end_time: null,
          },
          {
            id: 'jp-2',
            requires_scheduling: true,
            promised_date: '2026-01-20',
            scheduled_start_time: null,
            scheduled_end_time: null,
          },
        ],
      },
    ])
  })

  it('returns one promise-only item per distinct promised_date', async () => {
    const res = await getNeedsSchedulingPromiseItems({
      orgId: 'org-1',
      rangeStart: new Date('2026-01-19T00:00:00Z'),
      rangeEnd: new Date('2026-01-21T00:00:00Z'),
    })

    expect(Array.isArray(res.items)).toBe(true)
    expect(res.items).toHaveLength(2)

    const keys = res.items
      .map((it: any) => new Date(it.promisedAt).toISOString().slice(0, 10))
      .sort()

    expect(keys).toEqual(['2026-01-19', '2026-01-20'])

    const calendarKeys = res.items.map((it: any) => it.calendarKey)
    expect(new Set(calendarKeys).size).toBe(2)
  })
})
