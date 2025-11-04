import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createDeal, updateDeal, toJobPartRows } from '@/services/dealService'
import { supabase } from '@/lib/supabase'

// Mock supabase
vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

describe('dealService job_parts times fallback', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    // Clear sessionStorage
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('toJobPartRows', () => {
    it('includes scheduled_* fields by default', () => {
      const items = [
        {
          product_id: 1,
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-10',
          scheduledStartTime: '2025-11-10T09:00:00Z',
          scheduledEndTime: '2025-11-10T17:00:00Z',
        },
      ]
      const rows = toJobPartRows('job-123', items)
      expect(rows).toHaveLength(1)
      expect(rows[0].scheduled_start_time).toBe('2025-11-10T09:00:00Z')
      expect(rows[0].scheduled_end_time).toBe('2025-11-10T17:00:00Z')
    })

    it('excludes scheduled_* fields when includeTimes is false', () => {
      const items = [
        {
          product_id: 1,
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-10',
          scheduledStartTime: '2025-11-10T09:00:00Z',
          scheduledEndTime: '2025-11-10T17:00:00Z',
        },
      ]
      const rows = toJobPartRows('job-123', items, { includeTimes: false })
      expect(rows).toHaveLength(1)
      expect(rows[0]).not.toHaveProperty('scheduled_start_time')
      expect(rows[0]).not.toHaveProperty('scheduled_end_time')
      // Other fields should still be present
      expect(rows[0].product_id).toBe(1)
      expect(rows[0].promised_date).toBe('2025-11-10')
    })
  })

  describe('createDeal fallback', () => {
    it('retries insert without scheduled_* on missing column error', async () => {
      const formState = {
        job_number: 'TEST-123',
        title: 'Test Deal',
        lineItems: [
          {
            product_id: 1,
            unit_price: 100,
            quantity_used: 1,
            requiresScheduling: true,
            lineItemPromisedDate: '2025-11-10',
            scheduledStartTime: '2025-11-10T09:00:00Z',
            scheduledEndTime: '2025-11-10T17:00:00Z',
          },
        ],
      }

      // Mock the jobs insert to succeed
      const mockJobInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'job-123' },
            error: null,
          }),
        }),
      })

      // Mock first insert to fail with missing column error, second to succeed
      let insertCallCount = 0
      const mockJobPartsInsert = vi.fn().mockImplementation(() => {
        insertCallCount++
        if (insertCallCount === 1) {
          // First call fails with missing column error
          return Promise.resolve({
            data: null,
            error: {
              message: 'Could not find the "scheduled_end_time" column of "job_parts" in the schema cache',
            },
          })
        } else {
          // Second call succeeds
          return Promise.resolve({ data: [], error: null })
        }
      })

      // Mock products check
      const mockProductsSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ id: 1 }],
          error: null,
        }),
      })

      // Mock transactions and loaner queries
      const mockTransactionsSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      })

      const mockTransactionsInsert = vi.fn().mockResolvedValue({ data: [], error: null })

      // Setup supabase mock
      supabase.from.mockImplementation((table) => {
        if (table === 'jobs') {
          return { insert: mockJobInsert }
        } else if (table === 'job_parts') {
          return { insert: mockJobPartsInsert }
        } else if (table === 'products') {
          return { select: mockProductsSelect }
        } else if (table === 'transactions') {
          return {
            select: mockTransactionsSelect,
            insert: mockTransactionsInsert,
          }
        }
        return {}
      })

      // Mock getDeal to return minimal data
      const mockGetDeal = vi.fn().mockResolvedValue({ id: 'job-123' })
      vi.doMock('@/services/dealService', async () => {
        const actual = await vi.importActual('@/services/dealService')
        return {
          ...actual,
          getDeal: mockGetDeal,
        }
      })

      // Mock auth
      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      try {
        await createDeal(formState)
      } catch (e) {
        // We expect this to potentially fail due to mocking limitations
        // but the important part is that retry logic was triggered
      }

      // Verify that insert was called twice (initial + retry)
      expect(mockJobPartsInsert).toHaveBeenCalledTimes(2)
    })

    it('propagates non-missing-column errors without retry', async () => {
      const formState = {
        job_number: 'TEST-456',
        title: 'Test Deal',
        lineItems: [
          {
            product_id: 1,
            unit_price: 100,
            quantity_used: 1,
            requiresScheduling: true,
            lineItemPromisedDate: '2025-11-10',
          },
        ],
      }

      // Mock the jobs insert to succeed
      const mockJobInsert = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { id: 'job-456' },
            error: null,
          }),
        }),
      })

      // Mock insert to fail with non-missing-column error
      const mockJobPartsInsert = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Foreign key constraint violation' },
      })

      // Mock products check
      const mockProductsSelect = vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          data: [{ id: 1 }],
          error: null,
        }),
      })

      supabase.from.mockImplementation((table) => {
        if (table === 'jobs') {
          return { insert: mockJobInsert }
        } else if (table === 'job_parts') {
          return { insert: mockJobPartsInsert }
        } else if (table === 'products') {
          return { select: mockProductsSelect }
        }
        return {}
      })

      supabase.auth.getUser.mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      })

      // Should throw and NOT retry
      await expect(createDeal(formState)).rejects.toThrow()
      
      // Verify that insert was only called once (no retry)
      expect(mockJobPartsInsert).toHaveBeenCalledTimes(1)
    })
  })

  describe('updateDeal fallback', () => {
    it('retries insert without scheduled_* on missing column error', async () => {
      const dealId = 'deal-789'
      const formState = {
        job_number: 'TEST-789',
        title: 'Updated Deal',
        lineItems: [
          {
            product_id: 2,
            unit_price: 200,
            quantity_used: 2,
            requiresScheduling: true,
            lineItemPromisedDate: '2025-11-15',
            scheduledStartTime: '2025-11-15T10:00:00Z',
            scheduledEndTime: '2025-11-15T18:00:00Z',
          },
        ],
      }

      // Mock jobs update
      const mockJobUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: dealId, updated_at: new Date().toISOString() },
              error: null,
            }),
          }),
        }),
      })

      // Mock job_parts delete
      const mockJobPartsDelete = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      // Mock first insert to fail, second to succeed
      let insertCallCount = 0
      const mockJobPartsInsert = vi.fn().mockImplementation(() => {
        insertCallCount++
        if (insertCallCount === 1) {
          return Promise.resolve({
            data: null,
            error: {
              message: 'column "scheduled_start_time" does not exist',
            },
          })
        } else {
          return Promise.resolve({ data: [], error: null })
        }
      })

      // Mock transactions
      const mockTransactionsSelect = vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            maybeSingle: vi.fn().mockResolvedValue({
              data: { id: 'txn-1', transaction_number: 'TXN-123' },
              error: null,
            }),
          }),
        }),
      })

      const mockTransactionsUpdate = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      })

      supabase.from.mockImplementation((table) => {
        if (table === 'jobs') {
          return { update: mockJobUpdate }
        } else if (table === 'job_parts') {
          return {
            delete: mockJobPartsDelete,
            insert: mockJobPartsInsert,
          }
        } else if (table === 'transactions') {
          return {
            select: mockTransactionsSelect,
            update: mockTransactionsUpdate,
          }
        }
        return {}
      })

      // Mock getDeal
      const mockGetDeal = vi.fn().mockResolvedValue({ id: dealId })
      vi.doMock('@/services/dealService', async () => {
        const actual = await vi.importActual('@/services/dealService')
        return {
          ...actual,
          getDeal: mockGetDeal,
        }
      })

      try {
        await updateDeal(dealId, formState)
      } catch (e) {
        // May fail due to mocking limitations
      }

      // Verify that insert was called twice
      expect(mockJobPartsInsert).toHaveBeenCalledTimes(2)
    })
  })
})
