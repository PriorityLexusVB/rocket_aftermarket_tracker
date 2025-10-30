// src/tests/dealForm.adapters.test.js
import { describe, it, expect } from 'vitest'
import {
  entityToDraft,
  draftToCreatePayload,
  draftToUpdatePayload,
} from '../components/deals/formAdapters'

describe('dealForm adapters', () => {
  describe('entityToDraft', () => {
    it('converts a basic entity without loaner', () => {
      const entity = {
        id: '123',
        job_number: 'JOB-001',
        description: 'Test job',
        vendor_id: 'v1',
        customer_needs_loaner: false,
        lineItems: [
          {
            product_id: 'p1',
            quantity_used: 2,
            unit_price: 100,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const draft = entityToDraft(entity)

      expect(draft.id).toBe('123')
      expect(draft.job_number).toBe('JOB-001')
      expect(draft.description).toBe('Test job')
      expect(draft.vendor_id).toBe('v1')
      expect(draft.customer_needs_loaner).toBe(false)
      expect(draft.lineItems).toHaveLength(1)
      expect(draft.lineItems[0].product_id).toBe('p1')
      expect(draft.lineItems[0].quantity_used).toBe(2)
      expect(draft.lineItems[0].unit_price).toBe(100)
      expect(draft.loanerForm.loaner_number).toBe('')
    })

    it('converts an entity with loaner data', () => {
      const entity = {
        id: '456',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-1234',
          eta_return_date: '2024-12-01',
          notes: 'Test notes',
        },
        lineItems: [],
      }

      const draft = entityToDraft(entity)

      expect(draft.customer_needs_loaner).toBe(true)
      expect(draft.loanerForm.loaner_number).toBe('L-1234')
      expect(draft.loanerForm.eta_return_date).toBe('2024-12-01')
      expect(draft.loanerForm.notes).toBe('Test notes')
    })

    it('handles job_parts array from database', () => {
      const entity = {
        id: '789',
        job_parts: [
          {
            product_id: 'p2',
            quantity_used: 1,
            unit_price: 50,
            promised_date: '2024-11-15',
            requires_scheduling: false,
            no_schedule_reason: 'Already completed',
            is_off_site: true,
          },
        ],
      }

      const draft = entityToDraft(entity)

      expect(draft.lineItems).toHaveLength(1)
      expect(draft.lineItems[0].product_id).toBe('p2')
      expect(draft.lineItems[0].quantity_used).toBe(1)
      expect(draft.lineItems[0].unit_price).toBe(50)
      expect(draft.lineItems[0].promised_date).toBe('2024-11-15')
      expect(draft.lineItems[0].requires_scheduling).toBe(false)
      expect(draft.lineItems[0].no_schedule_reason).toBe('Already completed')
      expect(draft.lineItems[0].is_off_site).toBe(true)
    })

    it('returns empty draft for null/undefined entity', () => {
      const draft1 = entityToDraft(null)
      const draft2 = entityToDraft(undefined)
      const draft3 = entityToDraft({})

      expect(draft1.job_number).toBe('')
      expect(draft1.lineItems).toEqual([])
      expect(draft2.customer_needs_loaner).toBe(false)
      expect(draft3.loanerForm.loaner_number).toBe('')
    })

    it('normalizes camelCase fields to snake_case', () => {
      const entity = {
        lineItems: [
          {
            productId: 'p3',
            quantity: 3,
            unitPrice: 75,
            lineItemPromisedDate: '2024-12-01',
            requiresScheduling: true,
            isOffSite: false,
          },
        ],
      }

      const draft = entityToDraft(entity)

      expect(draft.lineItems[0].product_id).toBe('p3')
      expect(draft.lineItems[0].quantity_used).toBe(3)
      expect(draft.lineItems[0].unit_price).toBe(75)
    })
  })

  describe('draftToCreatePayload', () => {
    it('creates a valid payload from draft', () => {
      const draft = {
        job_number: 'JOB-002',
        description: 'New deal',
        vendor_id: 'v2',
        assigned_to: 'u1',
        customer_mobile: '5551234567',
        customer_needs_loaner: false,
        lineItems: [
          {
            product_id: 'p4',
            quantity_used: 1,
            unit_price: 200,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.job_number).toBe('JOB-002')
      expect(payload.description).toBe('New deal')
      expect(payload.vendor_id).toBe('v2')
      expect(payload.assigned_to).toBe('u1')
      expect(payload.customer_phone).toBe('+15551234567')
      expect(payload.customer_needs_loaner).toBe(false)
      expect(payload.loanerForm).toBe(null)
      expect(payload.lineItems).toHaveLength(1)
      expect(payload.lineItems[0].product_id).toBe('p4')
    })

    it('includes loaner data when toggle is on', () => {
      const draft = {
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-5678',
          eta_return_date: '2024-12-15',
          notes: 'Customer prefers red',
        },
        lineItems: [
          {
            product_id: 'p5',
            quantity_used: 1,
            unit_price: 100,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.customer_needs_loaner).toBe(true)
      expect(payload.loanerForm).not.toBe(null)
      expect(payload.loanerForm.loaner_number).toBe('L-5678')
      expect(payload.loanerForm.eta_return_date).toBe('2024-12-15')
      expect(payload.loanerForm.notes).toBe('Customer prefers red')
    })

    it('omits loaner when toggle is off', () => {
      const draft = {
        customer_needs_loaner: false,
        loanerForm: {
          loaner_number: 'L-9999',
          eta_return_date: '2024-12-20',
        },
        lineItems: [
          {
            product_id: 'p6',
            quantity_used: 1,
            unit_price: 50,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.customer_needs_loaner).toBe(false)
      expect(payload.loanerForm).toBe(null)
    })

    it('omits loaner when number is blank', () => {
      const draft = {
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: '  ',
          eta_return_date: '2024-12-20',
        },
        lineItems: [
          {
            product_id: 'p7',
            quantity_used: 1,
            unit_price: 50,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.loanerForm).toBe(null)
    })

    it('filters out line items without product_id', () => {
      const draft = {
        lineItems: [
          { product_id: 'p8', quantity_used: 1, unit_price: 100 },
          { product_id: '', quantity_used: 2, unit_price: 50 },
          { product_id: 'p9', quantity_used: 3, unit_price: 75 },
        ],
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.lineItems).toHaveLength(2)
      expect(payload.lineItems[0].product_id).toBe('p8')
      expect(payload.lineItems[1].product_id).toBe('p9')
    })

    it('normalizes 10-digit phone to E.164', () => {
      const draft = {
        customer_mobile: '(555) 123-4567',
        lineItems: [{ product_id: 'p10', quantity_used: 1, unit_price: 100 }],
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.customer_phone).toBe('+15551234567')
    })

    it('clears no_schedule_reason when requires_scheduling is true', () => {
      const draft = {
        lineItems: [
          {
            product_id: 'p11',
            quantity_used: 1,
            unit_price: 100,
            requires_scheduling: true,
            no_schedule_reason: 'Should be cleared',
            is_off_site: false,
          },
        ],
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.lineItems[0].no_schedule_reason).toBe(null)
      expect(payload.lineItems[0].noScheduleReason).toBe(null)
    })
  })

  describe('draftToUpdatePayload', () => {
    it('includes id and updated_at', () => {
      const draft = {
        updated_at: '2024-10-30T12:00:00Z',
        job_number: 'JOB-003',
        lineItems: [
          {
            product_id: 'p12',
            quantity_used: 1,
            unit_price: 150,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const payload = draftToUpdatePayload('deal-123', draft)

      expect(payload.id).toBe('deal-123')
      expect(payload.updated_at).toBe('2024-10-30T12:00:00Z')
      expect(payload.job_number).toBe('JOB-003')
      expect(payload.lineItems).toHaveLength(1)
    })

    it('produces same payload shape as create for identical draft', () => {
      const draft = {
        job_number: 'JOB-004',
        description: 'Test',
        lineItems: [
          {
            product_id: 'p13',
            quantity_used: 1,
            unit_price: 100,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const createPayload = draftToCreatePayload(draft)
      const updatePayload = draftToUpdatePayload('deal-456', draft)

      // Should have same fields except id and updated_at
      expect(updatePayload.job_number).toBe(createPayload.job_number)
      expect(updatePayload.description).toBe(createPayload.description)
      expect(updatePayload.lineItems).toEqual(createPayload.lineItems)
      expect(updatePayload.id).toBe('deal-456')
    })
  })
})
