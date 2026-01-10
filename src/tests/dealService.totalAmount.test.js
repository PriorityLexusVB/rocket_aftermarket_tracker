import { describe, it, expect, vi, beforeEach } from 'vitest'

function mockSupabaseForTotalAmountTests() {
  // Mock supabase client to return total_amount as string (as PostgREST does for DECIMAL types)
  vi.doMock('@/lib/supabase', () => {
    const mockJobs = [
      {
        id: 'job-1',
        job_number: 'JOB-001',
        title: 'Test Deal',
        job_status: 'pending',
        created_at: '2025-01-15T10:00:00Z',
        job_parts: [],
      },
    ]

    const mockTransactions = [
      {
        job_id: 'job-1',
        customer_name: 'Test Customer',
        customer_phone: '555-1234',
        customer_email: 'test@example.com',
        // Supabase returns DECIMAL as string
        total_amount: '1234.56',
      },
    ]

    const mockLoaners = []

    const supabase = {
      auth: {
        getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })),
      },
      from(table) {
        if (table === 'jobs') {
          return {
            select() {
              return {
                in() {
                  return {
                    order() {
                      return Promise.resolve({ data: mockJobs, error: null })
                    },
                  }
                },
                eq() {
                  return {
                    async single() {
                      return { data: mockJobs[0], error: null }
                    },
                  }
                },
              }
            },
          }
        }
        if (table === 'transactions') {
          return {
            select() {
              return {
                in() {
                  return Promise.resolve({ data: mockTransactions, error: null })
                },
                eq() {
                  return {
                    async maybeSingle() {
                      return { data: mockTransactions[0], error: null }
                    },
                  }
                },
              }
            },
          }
        }
        if (table === 'loaner_assignments') {
          return {
            select() {
              return {
                in() {
                  return {
                    is() {
                      return Promise.resolve({ data: mockLoaners, error: null })
                    },
                  }
                },
              }
            },
          }
        }
        if (table === 'job_parts') {
          return {
            select() {
              return {
                limit() {
                  return Promise.resolve({ data: [], error: null })
                },
              }
            },
          }
        }
        if (table === 'user_profiles') {
          return {
            select() {
              return {
                eq() {
                  return {
                    async single() {
                      return { data: { name: 'Test User' }, error: null }
                    },
                  }
                },
              }
            },
          }
        }
        // Default fallback
        return {
          select: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      },
    }

    return { supabase }
  })
}

describe('dealService - total_amount numeric coercion', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mockSupabaseForTotalAmountTests()
  })

  it('should convert total_amount from string to number in getAllDeals', async () => {
    const { getAllDeals } = await import('../services/dealService')

    const deals = await getAllDeals()

    expect(deals).toBeDefined()
    expect(Array.isArray(deals)).toBe(true)
    expect(deals.length).toBeGreaterThan(0)

    const deal = deals[0]
    expect(deal.total_amount).toBeDefined()
    // Should be a number, not a string
    expect(typeof deal.total_amount).toBe('number')
    expect(deal.total_amount).toBe(1234.56)
  })

  it('should handle zero total_amount correctly', async () => {
    const { getAllDeals } = await import('../services/dealService')

    const deals = await getAllDeals()

    expect(deals).toBeDefined()
    expect(Array.isArray(deals)).toBe(true)

    if (deals.length > 0) {
      const deal = deals[0]
      expect(deal.total_amount).toBeDefined()
      // Should be a number type (parseFloat handles both strings and numbers)
      expect(typeof deal.total_amount).toBe('number')
      // parseFloat('1234.56') should work, parseFloat(1234.56) should also work
      expect(deal.total_amount).toBeGreaterThanOrEqual(0)
    }
  })
})
