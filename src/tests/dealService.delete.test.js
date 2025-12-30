import { describe, it, expect, vi, beforeEach } from 'vitest'

// Override the global test setup mock with a minimal, controllable supabase.
// These unit tests need to simulate `.from(...).select().eq().maybeSingle()` and
// `.from(...).delete().eq().select()` chains, so `from` must be a mock function.
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('dealService.deleteDeal', () => {
  let deleteDeal
  let supabase

  beforeEach(async () => {
    // Reset module cache so `dealService` re-imports with this file's mock.
    vi.resetModules()

    ;({ supabase } = await import('@/lib/supabase'))
    ;({ deleteDeal } = await import('@/services/dealService'))

    vi.clearAllMocks()
  })

  const makeReadChain = (returnValue) => {
    const chain = {
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(() => Promise.resolve(returnValue)),
    }
    return chain
  }

  const makeDeleteSelectChain = (
    deleteReturnValue,
    verifyReturnValue = { data: [], error: null }
  ) => {
    let didCallDelete = false
    const chain = {
      delete: vi.fn(() => {
        didCallDelete = true
        return chain
      }),
      select: vi.fn(() => {
        // Used in two ways by deleteDeal():
        // 1) delete().eq().select() -> returns Promise<{data,error}>
        // 2) select().eq().limit()   -> returns chain for further calls
        if (didCallDelete) return Promise.resolve(deleteReturnValue)
        return chain
      }),
      eq: vi.fn(() => chain),
      limit: vi.fn(() => Promise.resolve(verifyReturnValue)),
    }
    return chain
  }

  it('throws error when deal id is missing', async () => {
    await expect(deleteDeal(null)).rejects.toThrow('missing deal id')
    await expect(deleteDeal('')).rejects.toThrow('missing deal id')
    await expect(deleteDeal(undefined)).rejects.toThrow('missing deal id')
  })

  it('throws error when deal does not exist', async () => {
    const chain = makeReadChain({ data: null, error: null })
    supabase.from.mockReturnValue(chain)

    await expect(deleteDeal('non-existent-id')).rejects.toThrow(
      'Deal not found or you do not have access to it.'
    )

    expect(supabase.from).toHaveBeenCalledWith('jobs')
    expect(chain.select).toHaveBeenCalledWith('id, org_id')
    expect(chain.eq).toHaveBeenCalledWith('id', 'non-existent-id')
  })

  it('throws error when read fails', async () => {
    const chain = makeReadChain({
      data: null,
      error: { message: 'Database connection error' },
    })
    supabase.from.mockReturnValue(chain)

    await expect(deleteDeal('test-id')).rejects.toThrow('Failed to verify deal')
  })

  it('throws permission error when delete returns permission denied error', async () => {
    // Mock successful read and subsequent deletes with explicit chains
    let callCount = 0

    supabase.from.mockImplementation((table) => {
      callCount++
      if (callCount === 1 && table === 'jobs') {
        // First call: read to verify deal exists
        return makeReadChain({ data: { id: 'test-id', org_id: 'org-1' }, error: null })
      }
      if (table === 'loaner_assignments') {
        // Loaner assignments delete (optional table)
        // Return 1 deleted row to avoid triggering the follow-up verification query.
        return makeDeleteSelectChain({ data: [{ job_id: 'test-id' }], error: null })
      }
      if (table === 'job_parts') {
        // Job parts delete fails with permission error
        return makeDeleteSelectChain({
          data: null,
          error: { code: '42501', message: 'permission denied for table job_parts' },
        })
      }
      // Default chain for other tables
      return makeDeleteSelectChain({ data: [{ job_id: 'test-id' }], error: null })
    })

    await expect(deleteDeal('test-id')).rejects.toThrow(
      'You do not have permission to delete deals.'
    )
  })

  it('successfully deletes deal and child records', async () => {
    let callCount = 0
    supabase.from.mockImplementation((table) => {
      callCount++
      if (callCount === 1) {
        // First call: read to verify deal exists
        return makeReadChain({ data: { id: 'test-id', org_id: 'org-1' }, error: null })
      } else if (table === 'jobs' && callCount > 1) {
        // Final jobs delete with select to return deleted record
        return makeDeleteSelectChain({ data: [{ id: 'test-id' }], error: null })
      } else {
        // All other child table deletes
        return makeDeleteSelectChain({ data: [{ job_id: 'test-id' }], error: null })
      }
    })

    const result = await deleteDeal('test-id')
    expect(result).toBe(true)

    // Verify supabase.from was called for all expected tables
    const fromCalls = supabase.from.mock.calls.map((call) => call[0])
    expect(fromCalls).toContain('jobs')
    expect(fromCalls).toContain('job_parts')
    expect(fromCalls).toContain('transactions')
    expect(fromCalls).toContain('loaner_assignments')
    expect(fromCalls).toContain('communications')
  })

  it('handles missing optional tables gracefully', async () => {
    let callCount = 0
    supabase.from.mockImplementation((table) => {
      callCount++
      if (callCount === 1) {
        // First call: read to verify deal exists
        return makeReadChain({ data: { id: 'test-id', org_id: 'org-1' }, error: null })
      } else if (table === 'loaner_assignments' || table === 'communications') {
        // Optional tables that might not exist
        return makeDeleteSelectChain({
          data: null,
          error: { code: '42P01', message: 'relation does not exist' },
        })
      } else if (table === 'jobs' && callCount > 1) {
        // Final jobs delete
        return makeDeleteSelectChain({ data: [{ id: 'test-id' }], error: null })
      } else {
        // Other tables
        return makeDeleteSelectChain({ data: [{ job_id: 'test-id' }], error: null })
      }
    })

    const result = await deleteDeal('test-id')
    expect(result).toBe(true)
  })

  it('does not pre-block deletes for legacy NULL org_id when delete succeeds', async () => {
    let jobsCallCount = 0
    supabase.from.mockImplementation((table) => {
      if (table === 'jobs') {
        jobsCallCount++

        if (jobsCallCount === 1) {
          // Read to verify deal exists (legacy row with NULL org_id)
          return makeReadChain({ data: { id: 'test-id', org_id: null }, error: null })
        }

        // Final jobs delete succeeds
        return makeDeleteSelectChain({ data: [{ id: 'test-id' }], error: null })
      }

      // Child deletes (may be empty or present; returning one row avoids triggering verification)
      return makeDeleteSelectChain({ data: [{ job_id: 'test-id' }], error: null })
    })

    await expect(deleteDeal('test-id')).resolves.toBe(true)
  })

  it('throws a helpful org_id message when delete is blocked and remaining job has NULL org_id', async () => {
    let jobsCallCount = 0
    supabase.from.mockImplementation((table) => {
      if (table === 'jobs') {
        jobsCallCount++

        if (jobsCallCount === 1) {
          // Deal exists (legacy row)
          return makeReadChain({ data: { id: 'test-id', org_id: null }, error: null })
        }

        if (jobsCallCount === 2) {
          // Jobs delete returns 0 rows with no error (RLS/no-op)
          return makeDeleteSelectChain({ data: [], error: null })
        }

        // Verification read shows job still exists and has NULL org_id
        return makeReadChain({ data: { id: 'test-id', org_id: null }, error: null })
      }

      // Child deletes: return empty so we don't fail early; also ensure verify query returns empty.
      return makeDeleteSelectChain({ data: [], error: null }, { data: [], error: null })
    })

    await expect(deleteDeal('test-id')).rejects.toThrow(/missing org_id/i)
  })

  it('throws specific error for non-permission delete failures', async () => {
    let callCount = 0
    supabase.from.mockImplementation((table) => {
      callCount++
      if (callCount === 1) {
        // First call: read to verify deal exists
        return makeReadChain({ data: { id: 'test-id', org_id: 'org-1' }, error: null })
      } else if (table === 'loaner_assignments') {
        // Loaner assignments delete succeeds
        return makeDeleteSelectChain({ data: [{ job_id: 'test-id' }], error: null })
      } else if (table === 'job_parts') {
        // Job parts delete fails with non-permission error
        return makeDeleteSelectChain({
          data: null,
          error: { message: 'Foreign key constraint violation' },
        })
      }
      // Should not reach other tables
      return makeDeleteSelectChain({ data: [{ job_id: 'test-id' }], error: null })
    })

    await expect(deleteDeal('test-id')).rejects.toThrow('Foreign key constraint violation')
  })
})
