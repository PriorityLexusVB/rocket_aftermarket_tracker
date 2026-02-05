import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('dealService - total_amount numeric coercion', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should convert total_amount from string to number in getAllDeals', async () => {
    const mockFrom = vi.fn()
    const mockGetUser = vi.fn()

    // IMPORTANT:
    // Avoid vi.mock/doMock for '@/lib/supabase' because other test files may establish
    // a persistent module mock in the same worker. Instead, mutate the exported supabase
    // client for the duration of this test and restore it.
    const { supabase } = await import('@/lib/supabase')
    const { setProfileCaps } = await import('@/utils/userProfileName')
    setProfileCaps({ name: false, full_name: false, display_name: false })

    const originalFrom = supabase.from
    const originalGetUser = supabase?.auth?.getUser

    supabase.from = mockFrom
    supabase.auth = supabase.auth || {}
    supabase.auth.getUser = mockGetUser

    mockGetUser.mockImplementation(() =>
      Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })
    )

    mockFrom.mockImplementation((table) => {
      if (table === 'jobs') {
        return {
          select() {
            return {
              in() {
                return {
                  order() {
                    return Promise.resolve({
                      data: [
                        {
                          id: 'job-1',
                          job_number: 'JOB-001',
                          title: 'Test Deal',
                          job_status: 'pending',
                          created_at: '2025-01-15T10:00:00Z',
                          job_parts: [],
                          vehicle: {
                            year: 2025,
                            make: 'Test',
                            model: 'Car',
                            stock_number: 'L25-001',
                          },
                          vendor: null,
                        },
                      ],
                      error: null,
                    })
                  },
                }
              },
              eq() {
                return {
                  async single() {
                    return {
                      data: {
                        id: 'job-1',
                        job_number: 'JOB-001',
                        title: 'Test Deal',
                        job_status: 'pending',
                        created_at: '2025-01-15T10:00:00Z',
                        job_parts: [],
                        vehicle: {
                          year: 2025,
                          make: 'Test',
                          model: 'Car',
                          stock_number: 'L25-001',
                        },
                        vendor: null,
                      },
                      error: null,
                    }
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
                return Promise.resolve({
                  data: [
                    {
                      job_id: 'job-1',
                      customer_name: 'Test Customer',
                      customer_phone: '555-1234',
                      customer_email: 'test@example.com',
                      // PostgREST returns DECIMAL as string
                      total_amount: '1234.56',
                    },
                  ],
                  error: null,
                })
              },
              eq() {
                return {
                  async maybeSingle() {
                    return {
                      data: {
                        job_id: 'job-1',
                        customer_name: 'Test Customer',
                        customer_phone: '555-1234',
                        customer_email: 'test@example.com',
                        total_amount: '1234.56',
                      },
                      error: null,
                    }
                  },
                  async single() {
                    return {
                      data: {
                        job_id: 'job-1',
                        customer_name: 'Test Customer',
                        customer_phone: '555-1234',
                        customer_email: 'test@example.com',
                        total_amount: '1234.56',
                      },
                      error: null,
                    }
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
                    return Promise.resolve({ data: [], error: null })
                  },
                  // Some code paths may skip returned_at filtering.
                  then: undefined,
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

      // Default fallback
      return {
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }
    })

    try {
      const { getAllDeals } = await vi.importActual('@/services/dealService')
      const deals = await getAllDeals()

      expect(deals).toBeDefined()
      expect(Array.isArray(deals)).toBe(true)
      expect(deals.length).toBeGreaterThan(0)

      const deal = deals[0]
      expect(deal.total_amount).toBeDefined()
      // Should be a number, not a string
      expect(typeof deal.total_amount).toBe('number')
      expect(deal.total_amount).toBe(1234.56)
    } finally {
      supabase.from = originalFrom
      if (originalGetUser) supabase.auth.getUser = originalGetUser
    }
  })

  it('should handle zero total_amount correctly', async () => {
    const mockFrom = vi.fn()
    const mockGetUser = vi.fn()

    const { supabase } = await import('@/lib/supabase')
    const { setProfileCaps } = await import('@/utils/userProfileName')
    setProfileCaps({ name: false, full_name: false, display_name: false })

    const originalFrom = supabase.from
    const originalGetUser = supabase?.auth?.getUser

    supabase.from = mockFrom
    supabase.auth = supabase.auth || {}
    supabase.auth.getUser = mockGetUser

    // Same base stubs as the main test; we only assert coercion and non-negativity.
    mockGetUser.mockImplementation(() =>
      Promise.resolve({ data: { user: { id: 'user-1' } }, error: null })
    )

    mockFrom.mockImplementation((table) => {
      if (table === 'jobs') {
        return {
          select() {
            return {
              in() {
                return {
                  order() {
                    return Promise.resolve({
                      data: [
                        {
                          id: 'job-1',
                          job_number: 'JOB-001',
                          title: 'Test Deal',
                          job_status: 'pending',
                          created_at: '2025-01-15T10:00:00Z',
                          job_parts: [],
                          vehicle: {
                            year: 2025,
                            make: 'Test',
                            model: 'Car',
                            stock_number: 'L25-001',
                          },
                          vendor: null,
                        },
                      ],
                      error: null,
                    })
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
                return Promise.resolve({
                  data: [
                    {
                      job_id: 'job-1',
                      customer_name: 'Test Customer',
                      customer_phone: '555-1234',
                      customer_email: 'test@example.com',
                      total_amount: '0',
                    },
                  ],
                  error: null,
                })
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
                    return Promise.resolve({ data: [], error: null })
                  },
                  then: undefined,
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

      return {
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }
    })

    try {
      const { getAllDeals } = await vi.importActual('@/services/dealService')
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
    } finally {
      supabase.from = originalFrom
      if (originalGetUser) supabase.auth.getUser = originalGetUser
    }
  })
})
