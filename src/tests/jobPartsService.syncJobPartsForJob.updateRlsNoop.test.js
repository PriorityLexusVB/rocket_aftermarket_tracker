import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { syncJobPartsForJob } from '@/services/jobPartsService'
import { supabase } from '@/lib/supabase'

describe('jobPartsService.syncJobPartsForJob - RLS/no-op update verification', () => {
  let fromSpy

  beforeEach(() => {
    fromSpy = vi.spyOn(supabase, 'from')
  })

  afterEach(() => {
    fromSpy?.mockRestore?.()
  })

  it('throws a clear error when UPDATE is blocked by RLS (0 rows affected)', async () => {
    const jobId = 'job-123'
    const partId = 'job_part-1'

    // Step 1 select existing parts by job_id
    const selectEq = vi.fn((col, val) => {
      if (col === 'job_id') {
        return Promise.resolve({ data: [{ id: partId }], error: null })
      }
      if (col === 'id') {
        // Existence check: row still exists
        return {
          limit: vi.fn().mockResolvedValue({ data: [{ id: partId }], error: null }),
        }
      }
      return Promise.resolve({ data: [], error: null })
    })
    const select = vi.fn(() => ({ eq: selectEq }))

    // Step 4 update -> returns 0 rows, no error
    const updateSelect = vi.fn().mockResolvedValue({ data: [], error: null })
    const updateEq = vi.fn(() => ({ select: updateSelect }))
    const update = vi.fn(() => ({ eq: updateEq }))

    fromSpy.mockImplementation((table) => {
      if (table === 'job_parts') {
        return {
          select,
          update,
          delete: vi.fn(() => ({ in: vi.fn() })),
          insert: vi.fn(() => ({ select: vi.fn() })),
        }
      }
      return {}
    })

    const lineItems = [
      {
        id: partId,
        product_id: 'prod-1',
        unit_price: 100,
        quantity_used: 1,
        requires_scheduling: false,
        is_off_site: false,
        promised_date: null,
        no_schedule_reason: 'n/a',
      },
    ]

    await expect(
      syncJobPartsForJob(jobId, lineItems, { includeTimes: false, includeVendor: false })
    ).rejects.toThrow('Update was blocked by permissions (RLS) while updating job parts.')

    expect(fromSpy).toHaveBeenCalledWith('job_parts')
    expect(update).toHaveBeenCalledTimes(1)
    expect(updateSelect).toHaveBeenCalledTimes(1)
  })
})
