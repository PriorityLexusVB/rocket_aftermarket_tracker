// tests/unit/dealService.jobPartsTimesFallback.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import { mapFormToDb, toJobPartRows, getCapabilities } from '@/services/dealService'

describe('dealService - Per-Line Time Columns Fallback', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('cap_jobPartsTimes')
    }
  })

  describe('toJobPartRows with includeTimes option', () => {
    it('should include scheduled_* columns when includeTimes is true', () => {
      const items = [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-05',
          scheduledStartTime: '09:00:00',
          scheduledEndTime: '17:00:00',
        },
      ]

      const rows = toJobPartRows('job-123', items, { includeTimes: true })
      
      expect(rows).toHaveLength(1)
      expect(rows[0]).toHaveProperty('scheduled_start_time')
      expect(rows[0]).toHaveProperty('scheduled_end_time')
      expect(rows[0].scheduled_start_time).toBe('09:00:00')
      expect(rows[0].scheduled_end_time).toBe('17:00:00')
    })

    it('should exclude scheduled_* columns when includeTimes is false', () => {
      const items = [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-05',
          scheduledStartTime: '09:00:00',
          scheduledEndTime: '17:00:00',
        },
      ]

      const rows = toJobPartRows('job-123', items, { includeTimes: false })
      
      expect(rows).toHaveLength(1)
      expect(rows[0]).not.toHaveProperty('scheduled_start_time')
      expect(rows[0]).not.toHaveProperty('scheduled_end_time')
      // Other fields should still be present
      expect(rows[0].product_id).toBe('prod-1')
      expect(rows[0].promised_date).toBe('2025-11-05')
    })

    it('should default to capability setting when includeTimes not specified', () => {
      const items = [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-11-05',
        },
      ]

      // Without explicit opts, should use module capability
      const rows = toJobPartRows('job-123', items)
      
      expect(rows).toHaveLength(1)
      // Just verify it runs without error
      expect(rows[0].product_id).toBe('prod-1')
    })
  })

  describe('mapFormToDb with loanerForm', () => {
    it('should extract loanerForm when provided', () => {
      const formState = {
        job_number: 'JOB-001',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-001',
          eta_return_date: '2025-11-10',
          notes: 'Test',
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
    })

    it('should derive loanerForm from legacy loaner_number field', () => {
      const formState = {
        job_number: 'JOB-002',
        customer_needs_loaner: true,
        loaner_number: 'L-LEGACY',
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
      
      expect(result.loanerForm).toBeDefined()
      expect(result.loanerForm.loaner_number).toBe('L-LEGACY')
      expect(result.loanerForm.eta_return_date).toBe(null)
      expect(result.loanerForm.notes).toBe(null)
    })

    it('should return null loanerForm when neither field is provided', () => {
      const formState = {
        job_number: 'JOB-003',
        customer_needs_loaner: false,
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 100,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Complete',
          },
        ],
      }

      const result = mapFormToDb(formState)
      
      expect(result.loanerForm).toBe(null)
    })
  })

  describe('mapFormToDb with stockNumber extraction', () => {
    it('should extract stockNumber from formState', () => {
      const formState = {
        job_number: 'JOB-004',
        stockNumber: 'STK-123',
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
      
      expect(result.stockNumber).toBe('STK-123')
    })

    it('should handle snake_case stock_number field', () => {
      const formState = {
        job_number: 'JOB-005',
        stock_number: 'STK-456',
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
      
      expect(result.stockNumber).toBe('STK-456')
    })
  })

  describe('getCapabilities', () => {
    it('should return capabilities object with jobPartsHasTimes', () => {
      const caps = getCapabilities()
      
      expect(caps).toBeDefined()
      expect(caps).toHaveProperty('jobPartsHasTimes')
      expect(typeof caps.jobPartsHasTimes).toBe('boolean')
    })
  })
})
