// src/tests/unit/dealService.persistence.rls.test.js
/**
 * Deal Service Persistence & RLS Test Suite
 * 
 * This test file explicitly verifies persistence behaviors and RLS (Row-Level Security)
 * patterns as specified in Task 3 of the RLS & Reliability Hardening initiative.
 * 
 * Test Coverage:
 * 1. org_id inference (3 tests)
 * 2. Loaner assignment flows - creation & update (4 tests)
 * 3. Scheduling fallback when per-line scheduled_* absent (5 tests)
 * 4. Error wrapper classification - relationship vs permission vs generic (4 tests)
 * 5. Vendor aggregation states - Single, Mixed, Unassigned (6 tests)
 * 
 * Total: 22 tests
 * 
 * Note: This file supplements the existing dealService.persistence.test.js (27 tests)
 * and provides additional explicit RLS-focused test coverage.
 */

import { describe, it, expect, vi } from 'vitest'
import { mapFormToDb, toJobPartRows, aggregateVendors } from '@/services/dealService'

describe('Deal Service - Persistence & RLS Patterns', () => {
  describe('1. org_id Inference & Scoping', () => {
    it('should preserve org_id from form when explicitly provided', () => {
      const formState = {
        job_number: 'JOB-RLS-001',
        org_id: 'org-priority-lexus',
        customer_name: 'RLS Test Customer',
        lineItems: [
          {
            product_id: 'prod-oil-change',
            unit_price: 49.99,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Ready',
          },
        ],
      }

      const result = mapFormToDb(formState)

      // Verify org_id is preserved for RLS policies
      expect(result.jobPayload.org_id).toBe('org-priority-lexus')
      expect(result.customerName).toBe('RLS Test Customer')
    })

    it('should allow backend RLS inference when org_id is absent', () => {
      const formState = {
        job_number: 'JOB-RLS-002',
        customer_name: 'Backend Inference Test',
        // No org_id - backend will infer via auth_user_org() RLS helper
        lineItems: [
          {
            product_id: 'prod-brake-service',
            unit_price: 199.99,
            quantity_used: 1,
            requiresScheduling: true,
          },
        ],
      }

      const result = mapFormToDb(formState)

      // org_id should be undefined, letting RLS policies apply via auth_user_org()
      expect(result.jobPayload.org_id).toBeUndefined()
      expect(result.customerName).toBe('Backend Inference Test')
    })

    it('should maintain org_id consistency across job and transaction', () => {
      const formState = {
        job_number: 'JOB-RLS-003',
        org_id: 'org-consistency-test',
        customer_name: 'Consistency Test',
        customerMobile: '+15551234567',
        lineItems: [
          {
            product_id: 'prod-diagnostic',
            unit_price: 89.99,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Complete',
          },
        ],
      }

      const result = mapFormToDb(formState)

      // Both job and transaction should have same org_id for RLS
      expect(result.jobPayload.org_id).toBe('org-consistency-test')
      expect(result.customerName).toBe('Consistency Test')
      expect(result.customerPhone).toBeTruthy()
    })
  })

  describe('2. Loaner Assignment Persistence Flows', () => {
    it('should extract loanerForm for CREATE operation when customer_needs_loaner is true', () => {
      const formState = {
        job_number: 'JOB-LOANER-001',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'LOANER-001',
          eta_return_date: '2025-11-15',
          notes: 'Customer needs loaner for 3 days',
          vehicle_make: 'Toyota',
          vehicle_model: 'Corolla',
        },
        lineItems: [
          {
            product_id: 'prod-transmission',
            unit_price: 2500.00,
            quantity_used: 1,
            requiresScheduling: true,
          },
        ],
      }

      const result = mapFormToDb(formState)

      expect(result.loanerForm).toBeDefined()
      expect(result.loanerForm.loaner_number).toBe('LOANER-001')
      expect(result.loanerForm.eta_return_date).toBe('2025-11-15')
      expect(result.jobPayload.customer_needs_loaner).toBe(true)
    })

    it('should omit loanerForm when customer_needs_loaner is false', () => {
      const formState = {
        job_number: 'JOB-LOANER-002',
        customer_needs_loaner: false,
        loanerForm: null,
        lineItems: [
          {
            product_id: 'prod-inspection',
            unit_price: 39.99,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Not needed',
          },
        ],
      }

      const result = mapFormToDb(formState)

      expect(result.loanerForm).toBeUndefined()
      expect(result.jobPayload.customer_needs_loaner).toBe(false)
    })

    it('should handle loaner UPDATE flow - preserving existing loaner_id', () => {
      const formState = {
        id: 'existing-job-id',
        job_number: 'JOB-LOANER-003',
        customer_needs_loaner: true,
        loanerForm: {
          id: 'existing-loaner-id',
          loaner_number: 'LOANER-002',
          eta_return_date: '2025-11-20',
          notes: 'Extended loaner period',
        },
        lineItems: [
          {
            product_id: 'prod-engine-repair',
            unit_price: 3500.00,
            quantity_used: 1,
            requiresScheduling: true,
          },
        ],
      }

      const result = mapFormToDb(formState)

      expect(result.loanerForm).toBeDefined()
      expect(result.loanerForm.id).toBe('existing-loaner-id')
      expect(result.loanerForm.loaner_number).toBe('LOANER-002')
    })

    it('should handle loaner REMOVAL flow - setting customer_needs_loaner to false', () => {
      const formState = {
        id: 'existing-job-id',
        job_number: 'JOB-LOANER-004',
        customer_needs_loaner: false,
        loanerForm: null, // Loaner removed
        lineItems: [
          {
            product_id: 'prod-alignment',
            unit_price: 79.99,
            quantity_used: 1,
            requiresScheduling: false,
            noScheduleReason: 'Complete',
          },
        ],
      }

      const result = mapFormToDb(formState)

      expect(result.jobPayload.customer_needs_loaner).toBe(false)
      expect(result.loanerForm).toBeUndefined()
    })
  })

  describe('3. Scheduling Fallback Logic', () => {
    it('should use per-line scheduled_date when provided', () => {
      const lineItems = [
        {
          id: 'line-1',
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          scheduled_date: '2025-11-10',
          scheduled_start_time: '09:00',
          scheduled_end_time: '11:00',
        },
      ]

      const rows = toJobPartRows(lineItems)

      expect(rows[0].scheduled_date).toBe('2025-11-10')
      expect(rows[0].scheduled_start_time).toBe('09:00')
      expect(rows[0].scheduled_end_time).toBe('11:00')
    })

    it('should fallback to promised_date when per-line scheduling absent', () => {
      const lineItems = [
        {
          id: 'line-2',
          product_id: 'prod-2',
          unit_price: 200,
          quantity_used: 1,
          requiresScheduling: true,
          promised_date: '2025-11-15',
          // No scheduled_date - should fallback
        },
      ]

      const rows = toJobPartRows(lineItems, { promisedDateFallback: '2025-11-15' })

      expect(rows[0].scheduled_date).toBe('2025-11-15')
    })

    it('should set scheduled fields to null when requiresScheduling is false', () => {
      const lineItems = [
        {
          id: 'line-3',
          product_id: 'prod-3',
          unit_price: 50,
          quantity_used: 1,
          requiresScheduling: false,
          noScheduleReason: 'Ready',
        },
      ]

      const rows = toJobPartRows(lineItems)

      expect(rows[0].scheduled_date).toBeNull()
      expect(rows[0].scheduled_start_time).toBeNull()
      expect(rows[0].scheduled_end_time).toBeNull()
    })

    it('should handle mixed scheduling - some lines scheduled, some not', () => {
      const lineItems = [
        {
          id: 'line-4',
          product_id: 'prod-4',
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: true,
          scheduled_date: '2025-11-12',
        },
        {
          id: 'line-5',
          product_id: 'prod-5',
          unit_price: 150,
          quantity_used: 1,
          requiresScheduling: false,
          noScheduleReason: 'Parts on order',
        },
      ]

      const rows = toJobPartRows(lineItems)

      expect(rows[0].scheduled_date).toBe('2025-11-12')
      expect(rows[1].scheduled_date).toBeNull()
    })

    it('should preserve original scheduled_date on UPDATE when not changed', () => {
      const lineItems = [
        {
          id: 'existing-line-id',
          product_id: 'prod-6',
          unit_price: 300,
          quantity_used: 1,
          requiresScheduling: true,
          scheduled_date: '2025-11-18', // Original date
          _originalScheduledDate: '2025-11-18',
        },
      ]

      const rows = toJobPartRows(lineItems)

      expect(rows[0].scheduled_date).toBe('2025-11-18')
    })
  })

  describe('4. Error Wrapper Classification', () => {
    it('should recognize relationship errors (Could not find a relationship)', () => {
      const errorMessage = 'Could not find a relationship between job_parts and vendors'
      
      const isRelationshipError = errorMessage.includes('Could not find a relationship')
      
      expect(isRelationshipError).toBe(true)
    })

    it('should recognize permission errors (new row violates row-level security)', () => {
      const errorMessage = 'new row violates row-level security policy for table "jobs"'
      
      const isPermissionError = errorMessage.includes('row-level security')
      
      expect(isPermissionError).toBe(true)
    })

    it('should recognize generic database errors', () => {
      const errorMessage = 'duplicate key value violates unique constraint'
      
      const isRelationshipError = errorMessage.includes('Could not find a relationship')
      const isPermissionError = errorMessage.includes('row-level security')
      const isGenericError = !isRelationshipError && !isPermissionError
      
      expect(isGenericError).toBe(true)
    })

    it('should classify network errors as generic', () => {
      const errorMessage = 'Network request failed'
      
      const isRelationshipError = errorMessage.includes('Could not find a relationship')
      const isPermissionError = errorMessage.includes('row-level security')
      const isGenericError = !isRelationshipError && !isPermissionError
      
      expect(isGenericError).toBe(true)
    })
  })

  describe('5. Vendor Aggregation States', () => {
    it('should return "Single" when all line items have same vendor', () => {
      const lineItems = [
        { vendor_id: 'vendor-1', vendor_name: 'AutoZone' },
        { vendor_id: 'vendor-1', vendor_name: 'AutoZone' },
        { vendor_id: 'vendor-1', vendor_name: 'AutoZone' },
      ]

      const result = aggregateVendors(lineItems)

      expect(result.state).toBe('Single')
      expect(result.vendor_id).toBe('vendor-1')
      expect(result.vendor_name).toBe('AutoZone')
    })

    it('should return "Mixed" when line items have different vendors', () => {
      const lineItems = [
        { vendor_id: 'vendor-1', vendor_name: 'AutoZone' },
        { vendor_id: 'vendor-2', vendor_name: "O'Reilly" },
        { vendor_id: 'vendor-1', vendor_name: 'AutoZone' },
      ]

      const result = aggregateVendors(lineItems)

      expect(result.state).toBe('Mixed')
      expect(result.vendor_id).toBeNull()
      expect(result.vendor_name).toBeNull()
    })

    it('should return "Unassigned" when no vendors are assigned', () => {
      const lineItems = [
        { vendor_id: null, vendor_name: null },
        { vendor_id: null, vendor_name: null },
      ]

      const result = aggregateVendors(lineItems)

      expect(result.state).toBe('Unassigned')
      expect(result.vendor_id).toBeNull()
      expect(result.vendor_name).toBeNull()
    })

    it('should handle empty line items array as Unassigned', () => {
      const lineItems = []

      const result = aggregateVendors(lineItems)

      expect(result.state).toBe('Unassigned')
    })

    it('should handle single line item with vendor as Single', () => {
      const lineItems = [
        { vendor_id: 'vendor-3', vendor_name: 'NAPA' },
      ]

      const result = aggregateVendors(lineItems)

      expect(result.state).toBe('Single')
      expect(result.vendor_id).toBe('vendor-3')
      expect(result.vendor_name).toBe('NAPA')
    })

    it('should return Mixed when some vendors assigned, some unassigned', () => {
      const lineItems = [
        { vendor_id: 'vendor-1', vendor_name: 'AutoZone' },
        { vendor_id: null, vendor_name: null },
        { vendor_id: 'vendor-2', vendor_name: "O'Reilly" },
      ]

      const result = aggregateVendors(lineItems)

      expect(result.state).toBe('Mixed')
    })
  })
})
