// tests/unit/dealService.vehicleAttachAndLoaner.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createDeal, updateDeal } from '@/services/dealService'

// Mock Supabase
let mockVehicleLookupData = null
let mockVehicleInsertId = 'vehicle-new-123'
let mockLoanerCalled = false

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
        delete: vi.fn(() => mockChain),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        limit: vi.fn(() => mockChain),
      }

      if (table === 'jobs') {
        mockChain.insert = vi.fn(() => ({
          ...mockChain,
          select: vi.fn(() => ({
            ...mockChain,
            single: vi.fn(() => Promise.resolve({ 
              data: { id: 'job-123', job_number: 'JOB-001', vehicle_id: mockVehicleInsertId }, 
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
                data: { id: 'job-123', updated_at: new Date().toISOString(), vehicle_id: mockVehicleInsertId }, 
                error: null 
              })),
            })),
          })),
        }))
      }

      if (table === 'job_parts') {
        mockChain.insert = vi.fn(() => Promise.resolve({ data: [], error: null }))
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
        mockChain.update = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
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
        mockChain.insert = vi.fn((data) => {
          mockLoanerCalled = true
          return Promise.resolve({ data: [{ id: 'loaner-123', ...data[0] }], error: null })
        })
        mockChain.update = vi.fn((data) => {
          mockLoanerCalled = true
          return ({
            ...mockChain,
            eq: vi.fn(() => Promise.resolve({ data: { id: 'loaner-123', ...data }, error: null })),
          })
        })
        mockChain.select = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => ({
            ...mockChain,
            is: vi.fn(() => ({
              ...mockChain,
              single: vi.fn(() => Promise.resolve({ data: null, error: null })),
              maybeSingle: vi.fn(() => Promise.resolve({ 
                data: mockLoanerCalled ? { id: 'loaner-123', loaner_number: 'L-001' } : null, 
                error: null 
              })),
            })),
          })),
          in: vi.fn(() => ({
            ...mockChain,
            is: vi.fn(() => Promise.resolve({ 
              data: mockLoanerCalled ? [{ job_id: 'job-123', loaner_number: 'L-001' }] : [], 
              error: null 
            })),
          })),
        }))
      }

      if (table === 'vehicles') {
        mockChain.select = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn((field, value) => ({
            ...mockChain,
            eq: vi.fn(() => ({
              ...mockChain,
              maybeSingle: vi.fn(() => {
                // Return existing vehicle if mockVehicleLookupData is set
                if (mockVehicleLookupData) {
                  return Promise.resolve({ data: mockVehicleLookupData, error: null })
                }
                return Promise.resolve({ data: null, error: null })
              }),
            })),
            maybeSingle: vi.fn(() => {
              if (mockVehicleLookupData) {
                return Promise.resolve({ data: mockVehicleLookupData, error: null })
              }
              return Promise.resolve({ data: null, error: null })
            }),
          })),
        }))
        mockChain.insert = vi.fn((data) => ({
          ...mockChain,
          select: vi.fn(() => ({
            ...mockChain,
            single: vi.fn(() => Promise.resolve({ 
              data: { id: mockVehicleInsertId, ...data[0] }, 
              error: null 
            })),
          })),
        }))
        mockChain.update = vi.fn(() => ({
          ...mockChain,
          eq: vi.fn(() => Promise.resolve({ data: null, error: null })),
        }))
      }

      return mockChain
    }),
  },
}))

// Mock getDeal
vi.mock('@/services/dealService', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    getDeal: vi.fn(() => Promise.resolve({ 
      id: 'job-123',
      job_number: 'JOB-001',
      vehicle_id: mockVehicleInsertId,
      loaner_number: mockLoanerCalled ? 'L-001' : '',
      loaner_id: mockLoanerCalled ? 'loaner-123' : null,
      vehicle: mockVehicleLookupData || { id: mockVehicleInsertId, stock_number: 'STK-123' },
    })),
  }
})

describe('dealService - Vehicle Attach and Loaner Persistence', () => {
  beforeEach(() => {
    mockVehicleLookupData = null
    mockVehicleInsertId = 'vehicle-new-123'
    mockLoanerCalled = false
    vi.clearAllMocks()
  })

  describe('Vehicle Attach by Stock Number', () => {
    it('should lookup and attach existing vehicle by stock_number when vehicle_id is missing', async () => {
      // Mock existing vehicle
      mockVehicleLookupData = { id: 'vehicle-existing-456', stock_number: 'STK-EXISTING' }
      mockVehicleInsertId = 'vehicle-existing-456'

      const formState = {
        job_number: 'JOB-TEST-001',
        customer_name: 'Test Customer',
        stock_number: 'STK-EXISTING',
        org_id: 'org-1',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 100,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Installed at delivery',
          },
        ],
      }

      const result = await createDeal(formState)
      
      expect(result).toBeDefined()
      expect(result.vehicle_id).toBe('vehicle-existing-456')
      expect(result.vehicle).toBeDefined()
      expect(result.vehicle.stock_number).toBe('STK-EXISTING')
    })

    it('should create new vehicle by stock_number when not found', async () => {
      // No existing vehicle
      mockVehicleLookupData = null
      mockVehicleInsertId = 'vehicle-new-789'

      const formState = {
        job_number: 'JOB-TEST-002',
        customer_name: 'Test Customer',
        stock_number: 'STK-NEW-123',
        customer_mobile: '+15551234567',
        org_id: 'org-1',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 200,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Pre-installed',
          },
        ],
      }

      const result = await createDeal(formState)
      
      expect(result).toBeDefined()
      expect(result.vehicle_id).toBe('vehicle-new-789')
      expect(result.vehicle).toBeDefined()
    })

    it('should attach vehicle in updateDeal when stock_number is provided', async () => {
      mockVehicleLookupData = { id: 'vehicle-update-111', stock_number: 'STK-UPDATE' }
      mockVehicleInsertId = 'vehicle-update-111'

      const formState = {
        job_number: 'JOB-TEST-003',
        customer_name: 'Test Customer',
        stock_number: 'STK-UPDATE',
        org_id: 'org-1',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 300,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Not needed',
          },
        ],
      }

      const result = await updateDeal('job-123', formState)
      
      expect(result).toBeDefined()
      expect(result.vehicle_id).toBe('vehicle-update-111')
    })
  })

  describe('Loaner Persistence via loaner_assignments', () => {
    it('should create loaner_assignment when loanerForm is provided', async () => {
      const formState = {
        job_number: 'JOB-TEST-004',
        customer_name: 'Test Customer',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-001',
          eta_return_date: '2025-11-10',
          notes: 'Test loaner',
        },
        org_id: 'org-1',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 100,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Ready',
          },
        ],
      }

      const result = await createDeal(formState)
      
      expect(result).toBeDefined()
      expect(mockLoanerCalled).toBe(true)
      expect(result.loaner_number).toBe('L-001')
      expect(result.loaner_id).toBe('loaner-123')
    })

    it('should handle legacy loaner_number field', async () => {
      const formState = {
        job_number: 'JOB-TEST-005',
        customer_name: 'Test Customer',
        customer_needs_loaner: true,
        loaner_number: 'L-LEGACY-002',
        org_id: 'org-1',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 150,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Complete',
          },
        ],
      }

      const result = await createDeal(formState)
      
      expect(result).toBeDefined()
      expect(mockLoanerCalled).toBe(true)
    })

    it('should not create loaner_assignment when customer_needs_loaner is false', async () => {
      const formState = {
        job_number: 'JOB-TEST-006',
        customer_name: 'Test Customer',
        customer_needs_loaner: false,
        loanerForm: {
          loaner_number: 'L-SHOULD-NOT-SAVE',
          eta_return_date: null,
          notes: null,
        },
        org_id: 'org-1',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 100,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Done',
          },
        ],
      }

      const result = await createDeal(formState)
      
      expect(result).toBeDefined()
      expect(mockLoanerCalled).toBe(false)
    })

    it('should update loaner_assignment in updateDeal', async () => {
      const formState = {
        job_number: 'JOB-TEST-007',
        customer_name: 'Test Customer',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-UPDATE-003',
          eta_return_date: '2025-11-15',
          notes: 'Updated loaner',
        },
        org_id: 'org-1',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 250,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Finished',
          },
        ],
      }

      const result = await updateDeal('job-123', formState)
      
      expect(result).toBeDefined()
      expect(mockLoanerCalled).toBe(true)
    })
  })

  describe('Combined: Vehicle + Loaner', () => {
    it('should handle both vehicle attach and loaner assignment together', async () => {
      mockVehicleLookupData = null
      mockVehicleInsertId = 'vehicle-combo-999'

      const formState = {
        job_number: 'JOB-TEST-008',
        customer_name: 'Test Customer',
        stock_number: 'STK-COMBO-999',
        customer_mobile: '+15559876543',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-COMBO-004',
          eta_return_date: '2025-11-20',
          notes: 'Combo test',
        },
        org_id: 'org-1',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 500,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Both fields',
          },
        ],
      }

      const result = await createDeal(formState)
      
      expect(result).toBeDefined()
      expect(result.vehicle_id).toBe('vehicle-combo-999')
      expect(mockLoanerCalled).toBe(true)
      expect(result.loaner_number).toBe('L-001')
    })
  })
})
