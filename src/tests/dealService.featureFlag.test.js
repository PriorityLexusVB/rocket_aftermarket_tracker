// src/tests/dealForm.featureFlag.test.jsx
import { describe, it, expect } from 'vitest'
import {
  entityToDraft,
  draftToCreatePayload,
  draftToUpdatePayload,
} from '../components/deals/formAdapters'

describe('VITE_DEAL_FORM_V2 Feature Flag', () => {
  describe('Form Adapters Availability', () => {
    it('should export entityToDraft adapter', () => {
      expect(entityToDraft).toBeDefined()
      expect(typeof entityToDraft).toBe('function')
    })

    it('should export draftToCreatePayload adapter', () => {
      expect(draftToCreatePayload).toBeDefined()
      expect(typeof draftToCreatePayload).toBe('function')
    })

    it('should export draftToUpdatePayload adapter', () => {
      expect(draftToUpdatePayload).toBeDefined()
      expect(typeof draftToUpdatePayload).toBe('function')
    })
  })

  describe('V2 Flag Behavior - entityToDraft', () => {
    it('should convert DB entity to draft form state when V2 is enabled', () => {
      const dbEntity = {
        id: 'test-123',
        job_number: 'JOB-001',
        description: 'Test Deal',
        vendor_id: 'vendor-1',
        assigned_to: 'user-1',
        finance_manager_id: 'fm-1',
        delivery_coordinator_id: 'dc-1',
        customer_mobile: '5551234567',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-001',
          eta_return_date: '2024-12-01',
          notes: 'Red car preferred',
        },
        job_parts: [
          {
            product_id: 'prod-1',
            quantity_used: 2,
            unit_price: 150.5,
            promised_date: '2024-11-15',
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const draft = entityToDraft(dbEntity)

      expect(draft.id).toBe('test-123')
      expect(draft.job_number).toBe('JOB-001')
      expect(draft.description).toBe('Test Deal')
      expect(draft.vendor_id).toBe('vendor-1')
      expect(draft.assigned_to).toBe('user-1')
      expect(draft.finance_manager_id).toBe('fm-1')
      expect(draft.delivery_coordinator_id).toBe('dc-1')
      expect(draft.customer_mobile).toBe('5551234567')
      expect(draft.customer_needs_loaner).toBe(true)
      expect(draft.loanerForm.loaner_number).toBe('L-001')
      expect(draft.loanerForm.eta_return_date).toBe('2024-12-01')
      expect(draft.loanerForm.notes).toBe('Red car preferred')
      expect(draft.lineItems).toHaveLength(1)
      expect(draft.lineItems[0].product_id).toBe('prod-1')
      expect(draft.lineItems[0].quantity_used).toBe(2)
      expect(draft.lineItems[0].unit_price).toBe(150.5)
    })

    it('should handle missing fields gracefully', () => {
      const emptyEntity = {}

      const draft = entityToDraft(emptyEntity)

      expect(draft.job_number).toBe('')
      expect(draft.description).toBe('')
      expect(draft.lineItems).toEqual([])
      expect(draft.customer_needs_loaner).toBe(false)
      expect(draft.loanerForm.loaner_number).toBe('')
    })
  })

  describe('V2 Flag Behavior - draftToCreatePayload', () => {
    it('should convert draft to create payload when V2 is enabled', () => {
      const draft = {
        job_number: 'JOB-002',
        description: 'New deal',
        vendor_id: 'vendor-2',
        assigned_to: 'user-2',
        finance_manager_id: 'fm-2',
        delivery_coordinator_id: 'dc-2',
        customer_mobile: '(555) 987-6543',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-002',
          eta_return_date: '2024-12-15',
          notes: 'Blue car',
        },
        lineItems: [
          {
            product_id: 'prod-2',
            quantity_used: 1,
            unit_price: 200,
            promised_date: '2024-11-20',
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
        org_id: 'org-1',
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.job_number).toBe('JOB-002')
      expect(payload.description).toBe('New deal')
      expect(payload.vendor_id).toBe('vendor-2')
      expect(payload.assigned_to).toBe('user-2')
      expect(payload.finance_manager_id).toBe('fm-2')
      expect(payload.delivery_coordinator_id).toBe('dc-2')
      expect(payload.customer_phone).toBe('+15559876543') // Phone normalized
      expect(payload.customer_needs_loaner).toBe(true)
      expect(payload.loanerForm).not.toBe(null)
      expect(payload.loanerForm.loaner_number).toBe('L-002')
      expect(payload.lineItems).toHaveLength(1)
      expect(payload.lineItems[0].product_id).toBe('prod-2')
      expect(payload.org_id).toBe('org-1')
    })

    it('should omit loaner data when toggle is off', () => {
      const draft = {
        customer_needs_loaner: false,
        loanerForm: {
          loaner_number: 'L-999',
          eta_return_date: '2024-12-20',
        },
        lineItems: [
          {
            product_id: 'prod-3',
            quantity_used: 1,
            unit_price: 100,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const payload = draftToCreatePayload(draft)

      expect(payload.customer_needs_loaner).toBe(false)
      expect(payload.loanerForm).toBe(null)
    })
  })

  describe('V2 Flag Behavior - draftToUpdatePayload', () => {
    it('should include id and version info for update', () => {
      const draft = {
        updated_at: '2024-10-30T12:00:00Z',
        job_number: 'JOB-003',
        description: 'Updated deal',
        lineItems: [
          {
            product_id: 'prod-4',
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
      expect(payload.description).toBe('Updated deal')
    })
  })

  describe('Feature Flag Rollback Safety', () => {
    it('should not modify original entity when converting to draft', () => {
      const original = {
        id: 'test-456',
        job_number: 'JOB-999',
        job_parts: [
          {
            product_id: 'prod-5',
            quantity_used: 1,
            unit_price: 100,
          },
        ],
      }

      const originalCopy = JSON.parse(JSON.stringify(original))

      entityToDraft(original)

      expect(original).toEqual(originalCopy)
    })

    it('should not modify draft when converting to payload', () => {
      const draft = {
        job_number: 'JOB-888',
        lineItems: [
          {
            product_id: 'prod-6',
            quantity_used: 2,
            unit_price: 75,
          },
        ],
      }

      const draftCopy = JSON.parse(JSON.stringify(draft))

      draftToCreatePayload(draft)

      expect(draft).toEqual(draftCopy)
    })
  })

  describe('Data Integrity', () => {
    it('should preserve all required fields through round-trip conversion', () => {
      const dbEntity = {
        id: 'test-789',
        job_number: 'JOB-777',
        description: 'Round trip test',
        vendor_id: 'vendor-3',
        assigned_to: 'user-3',
        customer_needs_loaner: false,
        job_parts: [
          {
            product_id: 'prod-7',
            quantity_used: 1,
            unit_price: 100,
            requires_scheduling: true,
            promised_date: '2024-11-25',
            is_off_site: false,
          },
        ],
      }

      // Convert DB entity to draft
      const draft = entityToDraft(dbEntity)

      // Convert draft to update payload
      const payload = draftToUpdatePayload(dbEntity.id, draft)

      // Verify key fields are preserved
      expect(payload.id).toBe(dbEntity.id)
      expect(payload.job_number).toBe(dbEntity.job_number)
      expect(payload.description).toBe(dbEntity.description)
      expect(payload.vendor_id).toBe(dbEntity.vendor_id)
      expect(payload.assigned_to).toBe(dbEntity.assigned_to)
      expect(payload.customer_needs_loaner).toBe(dbEntity.customer_needs_loaner)
      expect(payload.lineItems).toHaveLength(1)
      expect(payload.lineItems[0].product_id).toBe(dbEntity.job_parts[0].product_id)
    })
  })
})
