// tests/dealService.loanerPersistence.test.js
import { describe, it, expect } from 'vitest'
import { mapDbDealToForm } from '@/services/dealService'

describe('dealService - Loaner Persistence Fix', () => {
  describe('mapDbDealToForm - loanerForm mapping', () => {
    it('should map loaner data to nested loanerForm structure', () => {
      const dbDeal = {
        id: 'deal-123',
        job_number: 'JOB-001',
        customer_needs_loaner: true,
        loaner_number: 'L-2025-001',
        loaner_eta_return_date: '2025-12-01',
        loaner_notes: 'Test loaner notes',
        job_parts: [],
      }

      const formDeal = mapDbDealToForm(dbDeal)

      // Verify loanerForm is properly structured
      expect(formDeal.loanerForm).toBeDefined()
      expect(formDeal.loanerForm.loaner_number).toBe('L-2025-001')
      expect(formDeal.loanerForm.eta_return_date).toBe('2025-12-01')
      expect(formDeal.loanerForm.notes).toBe('Test loaner notes')
    })

    it('should handle missing loaner data gracefully', () => {
      const dbDeal = {
        id: 'deal-456',
        job_number: 'JOB-002',
        customer_needs_loaner: false,
        job_parts: [],
      }

      const formDeal = mapDbDealToForm(dbDeal)

      // Verify loanerForm exists with empty values
      expect(formDeal.loanerForm).toBeDefined()
      expect(formDeal.loanerForm.loaner_number).toBe('')
      expect(formDeal.loanerForm.eta_return_date).toBe('')
      expect(formDeal.loanerForm.notes).toBe('')
    })

    it('should maintain backward compatibility with flat loaner_number field', () => {
      const dbDeal = {
        id: 'deal-789',
        job_number: 'JOB-003',
        customer_needs_loaner: true,
        loaner_number: 'L-2025-999',
        job_parts: [],
      }

      const formDeal = mapDbDealToForm(dbDeal)

      // Verify both flat and nested structures exist
      expect(formDeal.loaner_number).toBe('L-2025-999')
      expect(formDeal.loanerNumber).toBe('L-2025-999')
      expect(formDeal.loanerForm.loaner_number).toBe('L-2025-999')
    })

    it('should handle partial loaner data correctly', () => {
      const dbDeal = {
        id: 'deal-partial',
        job_number: 'JOB-004',
        customer_needs_loaner: true,
        loaner_number: 'L-PARTIAL',
        // Missing loaner_eta_return_date and loaner_notes
        job_parts: [],
      }

      const formDeal = mapDbDealToForm(dbDeal)

      // Verify all loanerForm fields exist with appropriate defaults
      expect(formDeal.loanerForm).toBeDefined()
      expect(formDeal.loanerForm.loaner_number).toBe('L-PARTIAL')
      expect(formDeal.loanerForm.eta_return_date).toBe('')
      expect(formDeal.loanerForm.notes).toBe('')
    })
  })

  describe('mapDbDealToForm - complete deal with loaner', () => {
    it('should correctly map a complete deal with all loaner fields', () => {
      const dbDeal = {
        id: 'complete-deal-1',
        job_number: 'JOB-COMPLETE-001',
        title: 'Complete Deal with Loaner',
        description: 'Test deal',
        customer_needs_loaner: true,
        loaner_number: 'L-COMPLETE-001',
        loaner_eta_return_date: '2025-12-15',
        loaner_notes: 'Customer needs compact car',
        customer_name: 'John Doe',
        customer_phone: '+15551234567',
        customer_email: 'john@example.com',
        job_parts: [
          {
            product_id: 'prod-1',
            unit_price: 100,
            quantity_used: 1,
            requires_scheduling: true,
            promised_date: '2025-11-20',
          },
        ],
      }

      const formDeal = mapDbDealToForm(dbDeal)

      // Verify all key fields are present and correct
      expect(formDeal.id).toBe('complete-deal-1')
      expect(formDeal.job_number).toBe('JOB-COMPLETE-001')
      expect(formDeal.customer_needs_loaner).toBe(true)

      // Verify loanerForm structure
      expect(formDeal.loanerForm).toEqual({
        loaner_number: 'L-COMPLETE-001',
        eta_return_date: '2025-12-15',
        notes: 'Customer needs compact car',
      })

      // Verify customer data
      expect(formDeal.customer_name).toBe('John Doe')
      expect(formDeal.customer_phone).toBe('+15551234567')
      expect(formDeal.customer_email).toBe('john@example.com')

      // Verify line items
      expect(formDeal.lineItems).toHaveLength(1)
      expect(formDeal.lineItems[0].product_id).toBe('prod-1')
    })
  })
})
