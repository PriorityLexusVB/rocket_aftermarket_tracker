import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase module before importing dealService
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

// Import after mocking
import { getAllDeals } from '@/services/dealService'
import { supabase } from '@/lib/supabase'

describe('dealService - relationship error handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('detects missing relationship error and provides actionable guidance', async () => {
    // Mock a missing relationship error from PostgREST
    const mockError = new Error(
      "Could not find a relationship between 'job_parts' and 'vendors' in the schema cache"
    )

    // Setup mock to return error with proper chaining including .limit()
    const mockLimit = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    const mockSelect = vi.fn().mockReturnValue({
      limit: mockLimit,
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          data: null,
          error: mockError,
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    })

    // Verify error handling - new implementation uses classifier for remediation guidance
    await expect(getAllDeals()).rejects.toThrow(/Could not find a relationship/)
    await expect(getAllDeals()).rejects.toThrow(/job_parts.*vendors/)
  })

  it('passes through other errors without modification', async () => {
    // Mock a generic error (not relationship-related)
    const mockError = new Error('Network timeout')

    // Setup mock to return error with proper chaining including .limit()
    const mockLimit = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    const mockSelect = vi.fn().mockReturnValue({
      limit: mockLimit,
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          data: null,
          error: mockError,
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    })

    // Verify error passes through
    await expect(getAllDeals()).rejects.toThrow('Failed to load deals: Network timeout')
    await expect(getAllDeals()).rejects.not.toThrow(/Missing database relationship/)
  })

  it('handles missing column errors distinctly from relationship errors', async () => {
    // Mock a missing column error
    const mockError = new Error('column "nonexistent_field" does not exist')

    // Setup mock to return error with proper chaining including .limit()
    const mockLimit = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    })

    const mockSelect = vi.fn().mockReturnValue({
      limit: mockLimit,
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          data: null,
          error: mockError,
        }),
      }),
    })

    vi.mocked(supabase.from).mockReturnValue({
      select: mockSelect,
    })

    // Verify column error doesn't trigger relationship guidance
    await expect(getAllDeals()).rejects.toThrow('column "nonexistent_field" does not exist')
    await expect(getAllDeals()).rejects.not.toThrow(/Missing database relationship/)
  })
})
