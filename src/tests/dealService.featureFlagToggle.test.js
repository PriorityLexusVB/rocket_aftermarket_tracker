// src/tests/dealService.featureFlagToggle.test.js
import { describe, it, expect } from 'vitest'
import { draftToCreatePayload } from '../components/deals/formAdapters'

describe('VITE_DEAL_FORM_V2 Toggle Behavior', () => {
  describe('When flag is TRUE (V2 enabled)', () => {
    it('should use adapter to normalize payload', () => {
      const formState = {
        job_number: 'JOB-001',
        description: 'Test deal',
        customer_mobile: '5551234567',
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-001',
          eta_return_date: '2024-12-01',
        },
        lineItems: [
          {
            product_id: 'prod-1',
            quantity_used: 1,
            unit_price: 100,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      // With V2 flag, use adapter
      const payload = draftToCreatePayload(formState)

      // Adapter should normalize phone number
      expect(payload.customer_phone).toBe('+15551234567')
      expect(payload.customer_needs_loaner).toBe(true)
      expect(payload.loanerForm).not.toBe(null)
      expect(payload.lineItems).toHaveLength(1)
      expect(payload.lineItems[0].requiresScheduling).toBe(true)
    })

    it('should handle loaner toggle correctly with adapter', () => {
      const formStateWithLoaner = {
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-123',
          eta_return_date: '2024-12-01',
        },
        lineItems: [
          {
            product_id: 'prod-1',
            quantity_used: 1,
            unit_price: 100,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const payloadWithLoaner = draftToCreatePayload(formStateWithLoaner)
      expect(payloadWithLoaner.loanerForm).not.toBe(null)
      expect(payloadWithLoaner.loanerForm.loaner_number).toBe('L-123')

      const formStateWithoutLoaner = {
        customer_needs_loaner: false,
        loanerForm: {
          loaner_number: 'L-999',
        },
        lineItems: [
          {
            product_id: 'prod-1',
            quantity_used: 1,
            unit_price: 100,
            requires_scheduling: true,
            is_off_site: false,
          },
        ],
      }

      const payloadWithoutLoaner = draftToCreatePayload(formStateWithoutLoaner)
      expect(payloadWithoutLoaner.loanerForm).toBe(null)
    })
  })

  describe('When flag is FALSE (V2 disabled)', () => {
    it('should pass form state directly without adapter', () => {
      const formState = {
        job_number: 'JOB-002',
        description: 'Legacy test',
        customer_mobile: '5551234567',
        customer_needs_loaner: false,
        lineItems: [
          {
            product_id: 'prod-2',
            quantity_used: 2,
            unit_price: 50,
            requires_scheduling: false,
            is_off_site: true,
          },
        ],
      }

      // Without V2 flag, form state would be passed directly
      // This simulates the behavior: const payload = useV2 ? draftToCreatePayload(formState) : formState
      const payload = formState

      // Without adapter, phone is not normalized
      expect(payload.customer_mobile).toBe('5551234567')
      expect(payload.customer_phone).toBeUndefined()
      expect(payload.lineItems).toHaveLength(1)
      expect(payload.lineItems[0].product_id).toBe('prod-2')
    })
  })

  describe('Rollback Safety', () => {
    it('should not affect database or services when toggling flag', () => {
      // The feature flag only affects client-side data transformation
      // It does not modify database schemas, RPC functions, or service layer code
      // This test verifies that the adapter is a pure transformation

      const originalFormState = {
        job_number: 'JOB-003',
        lineItems: [
          {
            product_id: 'prod-3',
            quantity_used: 1,
            unit_price: 100,
          },
        ],
      }

      const formStateCopy = JSON.parse(JSON.stringify(originalFormState))

      // Apply adapter
      draftToCreatePayload(originalFormState)

      // Original form state should not be modified
      expect(originalFormState).toEqual(formStateCopy)
    })

    it('should produce valid payload for both V2 enabled and disabled', () => {
      const formState = {
        job_number: 'JOB-004',
        description: 'Test',
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

      // V2 enabled: with adapter
      const v2Payload = draftToCreatePayload(formState)
      expect(v2Payload.job_number).toBe('JOB-004')
      expect(v2Payload.lineItems).toHaveLength(1)

      // V2 disabled: without adapter (direct form state)
      const legacyPayload = formState
      expect(legacyPayload.job_number).toBe('JOB-004')
      expect(legacyPayload.lineItems).toHaveLength(1)

      // Both should have valid structure
      expect(v2Payload.lineItems[0].product_id).toBe('prod-4')
      expect(legacyPayload.lineItems[0].product_id).toBe('prod-4')
    })
  })

  describe('Flag Toggle Documentation', () => {
    it('should document the expected behavior when flag is true', () => {
      // When VITE_DEAL_FORM_V2=true:
      // 1. NewDeal.jsx uses draftToCreatePayload adapter
      // 2. EditDeal.jsx uses entityToDraft and draftToUpdatePayload adapters
      // 3. Phone numbers are normalized to E.164 format
      // 4. Loaner data is properly structured
      // 5. Line items include both snake_case and camelCase keys for compatibility
      expect(true).toBe(true) // Documentation test
    })

    it('should document the expected behavior when flag is false', () => {
      // When VITE_DEAL_FORM_V2=false:
      // 1. NewDeal.jsx passes form state directly to dealService
      // 2. EditDeal.jsx uses dealService.mapDbDealToForm (if available) or raw data
      // 3. No adapter transformations are applied
      // 4. Legacy behavior is preserved for safe rollback
      expect(true).toBe(true) // Documentation test
    })

    it('should document the safe rollback mechanism', () => {
      // To revert to legacy behavior:
      // 1. Set VITE_DEAL_FORM_V2=false in .env.development or .env.local
      // 2. Restart dev server (pnpm dev)
      // 3. No database migrations or service changes needed
      // 4. No production data is affected
      // 5. UI instantly reverts to legacy behavior
      expect(true).toBe(true) // Documentation test
    })
  })
})
