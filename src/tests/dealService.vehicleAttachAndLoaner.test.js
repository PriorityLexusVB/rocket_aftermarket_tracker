// tests/unit/dealService.vehicleAttachAndLoaner.test.js
import { describe, it, expect } from 'vitest'
import { mapFormToDb } from '@/services/dealService'

describe('dealService - Vehicle Attach and Loaner Persistence', () => {
  describe('Vehicle Stock Number Extraction', () => {
    it('should extract stockNumber and customerPhone for vehicle operations', () => {
      const formState = {
        job_number: 'JOB-TEST-001',
        customer_name: 'Test Customer',
        stockNumber: 'STK-EXISTING',
        customerMobile: '+15551234567',
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

      const result = mapFormToDb(formState)

      expect(result.stockNumber).toBe('STK-EXISTING')
      expect(result.customerPhone).toBeTruthy()
      expect(result.customerName).toBe('Test Customer')
    })

    it('should handle snake_case stock_number field', () => {
      const formState = {
        job_number: 'JOB-TEST-002',
        stock_number: 'STK-SNAKE-CASE',
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

      const result = mapFormToDb(formState)

      expect(result.stockNumber).toBe('STK-SNAKE-CASE')
    })

    it('should return empty string when stock number is not provided', () => {
      const formState = {
        job_number: 'JOB-TEST-003',
        customer_name: 'Test Customer',
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

      const result = mapFormToDb(formState)

      expect(result.stockNumber).toBe('')
    })
  })

  describe('Loaner Form Extraction', () => {
    it('should extract loanerForm when provided', () => {
      const formState = {
        job_number: 'JOB-TEST-004',
        customer_name: 'Test Customer',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-001',
          eta_return_date: '2025-11-10',
          notes: 'Test loaner',
        },
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

      const result = mapFormToDb(formState)

      expect(result.loanerForm).toBeDefined()
      expect(result.loanerForm.loaner_number).toBe('L-001')
      expect(result.loanerForm.eta_return_date).toBe('2025-11-10')
      expect(result.loanerForm.notes).toBe('Test loaner')
    })

    it('should derive loanerForm from legacy loaner_number field', () => {
      const formState = {
        job_number: 'JOB-TEST-005',
        customer_name: 'Test Customer',
        customer_needs_loaner: true,
        loaner_number: 'L-LEGACY-002',
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

      const result = mapFormToDb(formState)

      expect(result.loanerForm).toBeDefined()
      expect(result.loanerForm.loaner_number).toBe('L-LEGACY-002')
      expect(result.loanerForm.eta_return_date).toBe(null)
      expect(result.loanerForm.notes).toBe(null)
    })

    it('should return null loanerForm when neither field is provided', () => {
      const formState = {
        job_number: 'JOB-TEST-006',
        customer_name: 'Test Customer',
        customer_needs_loaner: false,
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

      const result = mapFormToDb(formState)

      expect(result.loanerForm).toBe(null)
    })

    it('should prioritize loanerForm over legacy loaner_number', () => {
      const formState = {
        job_number: 'JOB-TEST-007',
        customer_name: 'Test Customer',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-NEW',
          eta_return_date: '2025-11-12',
          notes: 'New format',
        },
        loaner_number: 'L-OLD',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 200,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Finished',
          },
        ],
      }

      const result = mapFormToDb(formState)

      expect(result.loanerForm).toBeDefined()
      expect(result.loanerForm.loaner_number).toBe('L-NEW')
      expect(result.loanerForm.notes).toBe('New format')
    })
  })

  describe('Combined Extraction', () => {
    it('should extract both stockNumber and loanerForm together', () => {
      const formState = {
        job_number: 'JOB-TEST-008',
        customer_name: 'Test Customer',
        stockNumber: 'STK-COMBO-999',
        customerMobile: '+15559876543',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-COMBO-004',
          eta_return_date: '2025-11-20',
          notes: 'Combo test',
        },
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

      const result = mapFormToDb(formState)

      expect(result.stockNumber).toBe('STK-COMBO-999')
      expect(result.customerPhone).toBeTruthy()
      expect(result.loanerForm).toBeDefined()
      expect(result.loanerForm.loaner_number).toBe('L-COMBO-004')
    })
  })

  describe('Payload Generation', () => {
    it('should generate jobPayload from mapFormToDb', () => {
      const formState = {
        job_number: 'JOB-TEST-009',
        customer_name: 'Test Customer',
        stockNumber: 'STK-999',
        customer_needs_loaner: true,
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

      const result = mapFormToDb(formState)

      expect(result.payload).toBeDefined()
      expect(result.payload.job_number).toBe('JOB-TEST-009')
      expect(result.payload.customer_needs_loaner).toBe(true)
      // Vehicle ID should not be set yet (that happens in createDeal/updateDeal)
      expect(result.payload.vehicle_id).toBeUndefined()
    })
  })
})
