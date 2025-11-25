// src/tests/dealService.loanerRlsDegradation.test.js
// Tests for graceful degradation when loaner_assignments RLS blocks queries

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

global.sessionStorage = sessionStorageMock

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user' } } }),
    },
  },
}))

describe('dealService - loaner_assignments RLS degradation', () => {
  let mockSupabase

  beforeEach(async () => {
    sessionStorageMock.clear()
    vi.resetModules()

    const module = await import('@/lib/supabase')
    mockSupabase = module.supabase
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should gracefully handle 403 RLS errors on loaner_assignments query in getAllDeals', async () => {
    const { getAllDeals } = await import('@/services/dealService')
    
    const mockRlsError = {
      message: 'permission denied for table loaner_assignments',
      code: '42501',
    }

    // Mock jobs query to succeed
    const mockJobsSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [{ id: 'job-1', job_status: 'pending' }],
          error: null,
        }),
      }),
    })

    // Mock preflight probe to succeed
    const mockPreflightSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
    })

    // Mock transactions query to succeed
    const mockTransactionsSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({
        data: [{ job_id: 'job-1', customer_name: 'Test', customer_phone: '123', customer_email: 'test@test.com', total_amount: 100 }],
        error: null,
      }),
    })

    // Mock loaner_assignments query to fail with RLS error
    const mockLoanerSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        is: vi.fn().mockResolvedValue({
          data: null,
          error: mockRlsError,
        }),
      }),
    })

    // Order of mock calls:
    // 1. Preflight probe (job_parts)
    // 2. Main jobs query
    // 3. Transactions query
    // 4. Loaner assignments query
    mockSupabase.from.mockReturnValueOnce({ select: mockPreflightSelect }) // preflight
    mockSupabase.from.mockReturnValueOnce({ select: mockJobsSelect }) // jobs
    mockSupabase.from.mockReturnValueOnce({ select: mockTransactionsSelect }) // transactions
    mockSupabase.from.mockReturnValueOnce({ select: mockLoanerSelect }) // loaner_assignments

    // Should not throw despite RLS error
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const deals = await getAllDeals()
    
    // Should return deals even without loaner data
    expect(deals).toBeDefined()
    expect(Array.isArray(deals)).toBe(true)
    
    // Should log warning about RLS block
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[dealService:getAllDeals] RLS blocked loaner_assignments query'),
      expect.any(String)
    )
    
    warnSpy.mockRestore()
  })
})
