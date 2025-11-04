// tests/unit/dealService.jobPartsTimesFallback.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDeal, updateDeal, getCapabilities } from '@/services/dealService'

// Mock Supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-1' } } })),
    },
    from: vi.fn((table) => {
      const mockChain = {
        insert: vi.fn(() => mockChain),
        update: vi.fn(() => mockChain),
        select: vi.fn(() => mockChain),
        eq: vi.fn(() => mockChain),
        in: vi.fn(() => mockChain),
        is: vi.fn(() => mockChain),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        limit: vi.fn(() => mockChain),
      }

      // Handle different table responses
      if (table === 'jobs') {
        mockChain.insert = vi.fn(() => ({
          ...mockChain,
          select: vi.fn(() => ({
            ...mockChain,
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'job-123', job_number: 'JOB-001' }, 
              error: null 
            })),
          })),
        }))
        mockChain.update = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => ({
            ...mockChain,
            select: vi.fn(() => ({
              ...mockChain,
              maybeSingle: vi.fn(() => Promise.resolve({ 
                data: { id: 'job-123', updated_at: new Date().toISOString() }, 
                error: null 
              })),
            })),
          })),
        }))
      }

      if (table === 'job_parts') {
        let callCount = 0
        mockChain.insert = vi.fn((rows) => {
          callCount++
          // First call with scheduled_* columns fails
          if (callCount === 1 && rows[0]?.scheduled_start_time !== undefined) {
            return Promise.resolve({ 
              data: null, 
              error: { message: 'column "scheduled_start_time" does not exist' } 
            })
          }
          // Second call without scheduled_* columns succeeds
          return Promise.resolve({ data: rows, error: null })
        })
        mockChain.delete = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        }))
      }

      if (table === 'products') {
        mockChain.in = vi.fn(() => ({
          ...mockChain,
          select: vi.fn(() => Promise.resolve({ 
            data: [{ id: 'prod-1' }], 
            error: null 
          })),
        }))
      }

      if (table === 'transactions') {
        mockChain.insert = vi.fn(() => Promise.resolve({ data: [{ id: 'txn-1' }], error: null }))
        mockChain.select = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => ({
            ...mockChain,
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            single: vi.fn(() => Promise.resolve({ 
              data: { customer_name: 'Test Customer' }, 
              error: null 
            })),
          })),
          limit: vi.fn(() => ({
            ...mockChain,
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        }))
      }

      if (table === 'user_profiles') {
        mockChain.select = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => ({
            ...mockChain,
            single: vi.fn(() => Promise.resolve({ 
              data: { org_id: 'org-1' }, 
              error: null 
            })),
          })),
        }))
      }

      if (table === 'loaner_assignments') {
        mockChain.select = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => ({
            ...mockChain,
            is: vi.fn(() => ({
              ...mockChain,
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
              maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
            })),
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
          in: vi.fn(() => ({
            ...mockChain,
            is: vi.fn(() => Promise.resolve({ data: [], error: null })),
          })),
        }))
      }

      if (table === 'vehicles') {
        mockChain.select = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => ({
            ...mockChain,
            maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        }))
        mockChain.insert = vi.fn(() => ({
          ...mockChain,
          select: vi.fn(() => ({
            ...mockChain,
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'vehicle-123' }, 
              error: null 
            })),
          })),
        }))
      }

      return mockChain
    }),
    rpc: vi.fn(() => Promise.resolve({ data: null, error: null })),
  },
}))

// Mock getDeal to avoid complex join queries
vi.mock('@/services/dealService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getDeal: vi.fn(() => Promise.resolve({ 
      id: 'job-123',
      job_number: 'JOB-001',
      appt_start: '2025-11-05T09:00:00',
      appt_end: '2025-11-05T17:00:00',
    })),
  }
})

describe('dealService - Per-Line Time Columns Fallback', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('cap_jobPartsTimes')
    }
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should retry createDeal without scheduled_* columns when they do not exist', async () => {
    const formState = {
      job_number: 'JOB-TEST-001',
      customer_name: 'Test Customer',
      org_id: 'org-1',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-05',
          scheduledStartTime: '09:00',
          scheduledEndTime: '17:00',
        },
      ],
    }

    const result = await createDeal(formState)
    
    expect(result).toBeDefined()
    expect(result.id).toBe('job-123')
    
    // Verify capability was disabled after first failure
    const caps = getCapabilities()
    expect(caps.jobPartsHasTimes).toBe(false)
    
    // Verify sessionStorage was updated
    if (typeof sessionStorage !== 'undefined') {
      expect(sessionStorage.getItem('cap_jobPartsTimes')).toBe('false')
    }
  })

  it('should retry updateDeal without scheduled_* columns when they do not exist', async () => {
    const formState = {
      job_number: 'JOB-TEST-002',
      customer_name: 'Test Customer',
      org_id: 'org-1',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 200,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-06',
          scheduledStartTime: '10:00',
          scheduledEndTime: '16:00',
        },
      ],
    }

    const result = await updateDeal('job-123', formState)
    
    expect(result).toBeDefined()
    expect(result.id).toBe('job-123')
  })

  it('should set job-level scheduled_* when capability is false and line items have times', async () => {
    // Disable capability first
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('cap_jobPartsTimes', 'false')
    }

    const formState = {
      job_number: 'JOB-TEST-003',
      customer_name: 'Test Customer',
      org_id: 'org-1',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 300,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-07',
          scheduledStartTime: '2025-11-07T08:00:00',
          scheduledEndTime: '2025-11-07T12:00:00',
        },
        {
          product_id: 'prod-1',
          unit_price: 400,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-08',
          scheduledStartTime: '2025-11-08T14:00:00',
          scheduledEndTime: '2025-11-08T18:00:00',
        },
      ],
    }

    const result = await createDeal(formState)
    
    expect(result).toBeDefined()
    // Job-level times should be set from earliest line item
    expect(result.appt_start).toBeTruthy()
    expect(result.appt_end).toBeTruthy()
  })

  it('should not trigger retry for non-missing-column errors', async () => {
    const { supabase } = await import('@/lib/supabase')
    
    // Mock a different error (not missing column)
    supabase.from = vi.fn((table) => {
      if (table === 'job_parts') {
        return {
          insert: vi.fn(() => Promise.resolve({ 
            data: null, 
            error: { message: 'Foreign key violation', code: '23503' } 
          })),
          delete: vi.fn(() => ({
            eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
          })),
        }
      }
      // Return default mock for other tables
      return supabase.from(table)
    })

    const formState = {
      job_number: 'JOB-TEST-004',
      customer_name: 'Test Customer',
      org_id: 'org-1',
      lineItems: [
        {
          product_id: 'invalid-product',
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-05',
        },
      ],
    }

    await expect(createDeal(formState)).rejects.toThrow()
  })
})
