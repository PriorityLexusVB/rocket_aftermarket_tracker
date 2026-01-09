/**
 * Test: Vehicle Description and Vendor Aggregation
 *
 * Verifies:
 * 1. Vehicle description is derived from title (custom description) or vehicle fields
 * 2. Vendor aggregation works correctly for per-line vendors
 * 3. Staff names are included in deal queries
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAllDeals, mapDbDealToForm } from '../services/dealService'
import { supabase } from '../lib/supabase'

// Mock Supabase
vi.mock('../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

describe('Vehicle Description and Vendor Aggregation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAllDeals - vehicle_description derivation', () => {
    it('should derive vehicle_description from title when title is custom', async () => {
      const mockJobs = [
        {
          id: 'job-1',
          title: '2025 Lexus RX350',
          job_number: 'JOB-001',
          job_status: 'pending',
          created_at: '2024-01-15T10:00:00Z',
          customer_needs_loaner: false,
          vehicle: { year: 2025, make: 'Lexus', model: 'RX350', stock_number: 'ST123' },
          vendor: null,
          job_parts: [],
          sales_consultant: null,
          delivery_coordinator: null,
          finance_manager: null,
        },
      ]

      const mockTransactions = []
      const mockLoaners = []

      supabase.from.mockImplementation((table) => {
        if (table === 'job_parts') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockJobs, error: null }),
          }
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockTransactions, error: null }),
          }
        }
        if (table === 'loaner_assignments') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: mockLoaners, error: null }),
          }
        }
      })

      const deals = await getAllDeals()

      expect(deals).toHaveLength(1)
      expect(deals[0].vehicle_description).toBe('2025 Lexus RX350')
    })

    it('should derive vehicle_description from vehicle fields when title is generic', async () => {
      const mockJobs = [
        {
          id: 'job-2',
          title: 'Deal JOB-002',
          job_number: 'JOB-002',
          job_status: 'pending',
          created_at: '2024-01-15T10:00:00Z',
          customer_needs_loaner: false,
          vehicle: { year: 2024, make: 'Toyota', model: 'Camry', stock_number: 'ST456' },
          vendor: null,
          job_parts: [],
          sales_consultant: null,
          delivery_coordinator: null,
          finance_manager: null,
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'job_parts') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockJobs, error: null }),
          }
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === 'loaner_assignments') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
      })

      const deals = await getAllDeals()

      expect(deals).toHaveLength(1)
      expect(deals[0].vehicle_description).toBe('2024 Toyota Camry')
    })
  })

  describe('getAllDeals - vendor aggregation', () => {
    it('should show single vendor when all off-site items use same vendor', async () => {
      const mockJobs = [
        {
          id: 'job-3',
          title: 'Test Job',
          job_number: 'JOB-003',
          job_status: 'pending',
          created_at: '2024-01-15T10:00:00Z',
          customer_needs_loaner: false,
          vehicle: null,
          vendor: null,
          job_parts: [
            {
              id: 'part-1',
              product_id: 'prod-1',
              is_off_site: true,
              vendor: { id: 'vendor-1', name: 'EverNew' },
              product: { name: 'PPF', category: 'PPF' },
            },
            {
              id: 'part-2',
              product_id: 'prod-2',
              is_off_site: true,
              vendor: { id: 'vendor-1', name: 'EverNew' },
              product: { name: 'Tint', category: 'Tint' },
            },
          ],
          sales_consultant: null,
          delivery_coordinator: null,
          finance_manager: null,
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'job_parts') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockJobs, error: null }),
          }
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === 'loaner_assignments') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
      })

      const deals = await getAllDeals()

      expect(deals).toHaveLength(1)
      expect(deals[0].vendor_name).toBe('EverNew')
    })

    it('should show "Mixed" when off-site items use different vendors', async () => {
      const mockJobs = [
        {
          id: 'job-4',
          title: 'Test Job',
          job_number: 'JOB-004',
          job_status: 'pending',
          created_at: '2024-01-15T10:00:00Z',
          customer_needs_loaner: false,
          vehicle: null,
          vendor: null,
          job_parts: [
            {
              id: 'part-1',
              product_id: 'prod-1',
              is_off_site: true,
              vendor: { id: 'vendor-1', name: 'EverNew' },
              product: { name: 'PPF', category: 'PPF' },
            },
            {
              id: 'part-2',
              product_id: 'prod-2',
              is_off_site: true,
              vendor: { id: 'vendor-2', name: 'DetailPro' },
              product: { name: 'Tint', category: 'Tint' },
            },
          ],
          sales_consultant: null,
          delivery_coordinator: null,
          finance_manager: null,
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'job_parts') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockJobs, error: null }),
          }
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === 'loaner_assignments') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
      })

      const deals = await getAllDeals()

      expect(deals).toHaveLength(1)
      expect(deals[0].vendor_name).toBe('Mixed')
    })

    it('should fallback to job-level vendor when no off-site items', async () => {
      const mockJobs = [
        {
          id: 'job-5',
          title: 'Test Job',
          job_number: 'JOB-005',
          job_status: 'pending',
          created_at: '2024-01-15T10:00:00Z',
          customer_needs_loaner: false,
          vehicle: null,
          vendor: { id: 'vendor-1', name: 'MainVendor' },
          job_parts: [
            {
              id: 'part-1',
              product_id: 'prod-1',
              is_off_site: false,
              vendor: null,
              product: { name: 'Detail', category: 'Detail' },
            },
          ],
          sales_consultant: null,
          delivery_coordinator: null,
          finance_manager: null,
        },
      ]

      supabase.from.mockImplementation((table) => {
        if (table === 'job_parts') {
          return {
            select: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }
        }
        if (table === 'jobs') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockJobs, error: null }),
          }
        }
        if (table === 'transactions') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
        if (table === 'loaner_assignments') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            is: vi.fn().mockResolvedValue({ data: [], error: null }),
          }
        }
      })

      const deals = await getAllDeals()

      expect(deals).toHaveLength(1)
      expect(deals[0].vendor_name).toBe('MainVendor')
    })
  })

  describe('mapDbDealToForm - vehicle_description', () => {
    it('should use pre-computed vehicle_description if available', () => {
      const dbDeal = {
        id: 'job-1',
        title: 'Deal JOB-001',
        vehicle_description: '2025 Lexus RX350',
        vehicle: { year: 2025, make: 'Lexus', model: 'RX350' },
        job_parts: [],
      }

      const formDeal = mapDbDealToForm(dbDeal)

      expect(formDeal.vehicle_description).toBe('2025 Lexus RX350')
      expect(formDeal.vehicleDescription).toBe('2025 Lexus RX350')
    })

    it('should derive from title when vehicle_description not pre-computed', () => {
      const dbDeal = {
        id: 'job-2',
        title: '2024 Toyota Camry',
        vehicle: { year: 2024, make: 'Toyota', model: 'Camry' },
        job_parts: [],
      }

      const formDeal = mapDbDealToForm(dbDeal)

      expect(formDeal.vehicle_description).toBe('2024 Toyota Camry')
      expect(formDeal.vehicleDescription).toBe('2024 Toyota Camry')
    })

    it('should derive from vehicle fields when title is generic', () => {
      const dbDeal = {
        id: 'job-3',
        title: 'Untitled Deal',
        vehicle: { year: 2023, make: 'Honda', model: 'Civic' },
        job_parts: [],
      }

      const formDeal = mapDbDealToForm(dbDeal)

      expect(formDeal.vehicle_description).toBe('2023 Honda Civic')
      expect(formDeal.vehicleDescription).toBe('2023 Honda Civic')
    })
  })
})
