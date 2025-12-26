import { describe, it, expect, vi, beforeEach } from 'vitest'
import { deleteDeal } from '@/services/dealService'
import { supabase } from '@/lib/supabase'

// Mock the supabase client
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('dealService.deleteDeal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const mockSupabaseChain = (returnValue) => {
    const chain = {
      delete: vi.fn(() => chain),
      select: vi.fn(() => chain),
      eq: vi.fn(() => chain),
      maybeSingle: vi.fn(() => returnValue),
      ...returnValue,
    }
    supabase.from.mockReturnValue(chain)
    return chain
  }

  it('throws error when deal id is missing', async () => {
    await expect(deleteDeal(null)).rejects.toThrow('missing deal id')
    await expect(deleteDeal('')).rejects.toThrow('missing deal id')
    await expect(deleteDeal(undefined)).rejects.toThrow('missing deal id')
  })

  it('throws error when deal does not exist', async () => {
    const chain = mockSupabaseChain({ data: null, error: null })

    await expect(deleteDeal('non-existent-id')).rejects.toThrow(
      'Deal not found or you do not have access to it.'
    )

    expect(supabase.from).toHaveBeenCalledWith('jobs')
    expect(chain.select).toHaveBeenCalledWith('id')
    expect(chain.eq).toHaveBeenCalledWith('id', 'non-existent-id')
  })

  it('throws error when read fails', async () => {
    mockSupabaseChain({
      data: null,
      error: { message: 'Database connection error' },
    })

    await expect(deleteDeal('test-id')).rejects.toThrow('Failed to verify deal')
  })

  it('throws permission error when delete returns permission denied error', async () => {
    // Mock successful read
    let callCount = 0
    supabase.from.mockImplementation((table) => {
      callCount++
      if (callCount === 1) {
        // First call: read to verify deal exists
        return mockSupabaseChain({ data: { id: 'test-id' }, error: null })
      } else if (table === 'loaner_assignments') {
        // Loaner assignments delete (optional table)
        return mockSupabaseChain({ data: [], error: null })
      } else if (table === 'job_parts') {
        // Job parts delete fails with permission error
        return mockSupabaseChain({
          data: null,
          error: { code: '42501', message: 'permission denied for table job_parts' },
        })
      }
      return mockSupabaseChain({ data: [], error: null })
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
        const readChain = {
          select: vi.fn(() => readChain),
          eq: vi.fn(() => readChain),
          maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        }
        return readChain
      } else if (table === 'jobs' && callCount > 1) {
        // Final jobs delete with select to return deleted record
        const deleteChain = {
          delete: vi.fn(() => deleteChain),
          eq: vi.fn(() => deleteChain),
          select: vi.fn(() => Promise.resolve({ data: [{ id: 'test-id' }], error: null })),
        }
        return deleteChain
      } else {
        // All other child table deletes
        const chain = {
          delete: vi.fn(() => chain),
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        }
        return chain
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
        const readChain = {
          select: vi.fn(() => readChain),
          eq: vi.fn(() => readChain),
          maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        }
        return readChain
      } else if (table === 'loaner_assignments' || table === 'communications') {
        // Optional tables that might not exist
        const chain = {
          delete: vi.fn(() => chain),
          eq: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { code: '42P01', message: 'relation does not exist' },
            })
          ),
        }
        return chain
      } else if (table === 'jobs' && callCount > 1) {
        // Final jobs delete
        const deleteChain = {
          delete: vi.fn(() => deleteChain),
          eq: vi.fn(() => deleteChain),
          select: vi.fn(() => Promise.resolve({ data: [{ id: 'test-id' }], error: null })),
        }
        return deleteChain
      } else {
        // Other tables
        const chain = {
          delete: vi.fn(() => chain),
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        }
        return chain
      }
    })

    const result = await deleteDeal('test-id')
    expect(result).toBe(true)
  })

  it('throws specific error for non-permission delete failures', async () => {
    let callCount = 0
    supabase.from.mockImplementation((table) => {
      callCount++
      if (callCount === 1) {
        // First call: read to verify deal exists
        const readChain = {
          select: vi.fn(() => readChain),
          eq: vi.fn(() => readChain),
          maybeSingle: vi.fn(() => Promise.resolve({ data: { id: 'test-id' }, error: null })),
        }
        return readChain
      } else if (table === 'loaner_assignments') {
        // Loaner assignments delete succeeds
        const chain = {
          delete: vi.fn(() => chain),
          eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
        }
        return chain
      } else if (table === 'job_parts') {
        // Job parts delete fails with non-permission error
        const chain = {
          delete: vi.fn(() => chain),
          eq: vi.fn(() =>
            Promise.resolve({
              data: null,
              error: { message: 'Foreign key constraint violation' },
            })
          ),
        }
        return chain
      }
      // Should not reach other tables
      const chain = {
        delete: vi.fn(() => chain),
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      }
      return chain
    })

    await expect(deleteDeal('test-id')).rejects.toThrow('Foreign key constraint violation')
  })
})
