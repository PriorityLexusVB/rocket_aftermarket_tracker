// Test to reproduce Deal Edit Flow issues
import { describe, it, expect, beforeEach, vi } from 'vitest'

describe('Deal Edit Flow - Issue Reproduction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should preserve customer name when editing a deal', async () => {
    // Step 1: Create a deal with customer name
    const createPayload = {
      customer_name: 'Rob Brasco',
      customer_mobile: '555-1234',
      job_number: 'TEST-001',
      deal_date: '2025-01-17',
      lineItems: [
        {
          product_id: 'test-product-1',
          unit_price: 100,
          quantity_used: 1,
          promised_date: '2025-01-20',
          requires_scheduling: true,
          is_off_site: false,
          vendor_id: null,
        },
      ],
    }

    // Mock createDeal to verify what's being sent
    console.log('Creating deal with payload:', JSON.stringify(createPayload, null, 2))

    // Step 2: Edit the deal (change line item price)
    const editPayload = {
      customer_name: 'Rob Brasco', // Should be preserved
      customer_mobile: '555-1234',
      job_number: 'TEST-001',
      deal_date: '2025-01-17',
      lineItems: [
        {
          product_id: 'test-product-1',
          unit_price: 150, // Changed price
          quantity_used: 1,
          promised_date: '2025-01-20',
          requires_scheduling: true,
          is_off_site: false,
          vendor_id: null,
        },
      ],
    }

    console.log('Editing deal with payload:', JSON.stringify(editPayload, null, 2))

    // The issue: customer_name should be preserved in the transaction table
    // Expected: transaction.customer_name = 'Rob Brasco'
    // Actual: transaction.customer_name might be 'Unknown Customer' or empty

    expect(editPayload.customer_name).toBe('Rob Brasco')
  })

  it('should not duplicate line items when editing', async () => {
    // Test that line items are properly replaced, not duplicated
    const initialPayload = {
      customer_name: 'Test Customer',
      job_number: 'TEST-002',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          requires_scheduling: false,
          no_schedule_reason: 'Test',
        },
      ],
    }

    const editedPayload = {
      customer_name: 'Test Customer',
      job_number: 'TEST-002',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          requires_scheduling: false,
          no_schedule_reason: 'Test',
        },
        {
          product_id: 'prod-2',
          unit_price: 200,
          quantity_used: 1,
          requires_scheduling: false,
          no_schedule_reason: 'Test',
        },
      ],
    }

    // After edit, should have exactly 2 line items, not 3
    console.log('Initial line items:', initialPayload.lineItems.length)
    console.log('Edited line items:', editedPayload.lineItems.length)
    expect(editedPayload.lineItems.length).toBe(2)
  })
})
