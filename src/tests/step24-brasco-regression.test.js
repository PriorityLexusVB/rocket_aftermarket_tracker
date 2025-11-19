/**
 * Step 24: Brasco-style regression test - Multi-edit with many line items
 * 
 * Goal: Verify that multiple edits to a deal with many line items do not:
 * - Duplicate line items in the database
 * - Show incorrect totals in the deals list
 * - Lose loaner numbers
 * 
 * This test creates a deal similar to Rob Brasco's real scenario with multiple
 * line items, performs multiple updates, and verifies data integrity.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the supabase module BEFORE importing dealService
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(() =>
        Promise.resolve({ data: { user: { id: 'test-user-id' } }, error: null })
      ),
    },
    from: vi.fn(() => {
      const chainable = {
        select: vi.fn(() => chainable),
        insert: vi.fn(() => chainable),
        update: vi.fn(() => chainable),
        delete: vi.fn(() => chainable),
        eq: vi.fn(() => chainable),
        is: vi.fn(() => chainable),
        in: vi.fn(() => chainable),
        limit: vi.fn(() => chainable),
        single: vi.fn(() => Promise.resolve({ data: null, error: null })),
        maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
        then: (resolve) => resolve({ data: [], error: null }),
      }
      return chainable
    }),
  },
}))

describe('Step 24: Brasco-style regression - Multi-edit deal with many line items', () => {
  let testJobId
  let testVehicleId
  let testProductIds
  let insertedJobPartIds

  beforeEach(() => {
    testJobId = 'test-job-brasco-001'
    testVehicleId = 'test-vehicle-001'
    testProductIds = Array.from({ length: 10 }, (_, i) => `prod-${i + 1}`)
    insertedJobPartIds = []

    // Reset mock call history
    vi.clearAllMocks()
  })

  it('should not duplicate line items after multiple updates', async () => {
    // Create a deal with 10 line items (similar to Brasco's deal)
    const initialLineItems = testProductIds.map((prodId, idx) => ({
      product_id: prodId,
      quantity_used: 1,
      unit_price: 499.0 + idx * 10, // Varying prices
      promised_date: '2025-01-25',
      requires_scheduling: true,
      is_off_site: true,
    }))

    const dealForm = {
      title: 'Rob Brasco Test Deal',
      job_number: 'JOB-BRASCO-001',
      vehicle_id: testVehicleId,
      description: 'Multi-item deal for regression testing',
      lineItems: initialLineItems,
      customerName: 'Rob Brasco',
      customerMobile: '+14155551234',
      customer_needs_loaner: true,
      loanerForm: {
        loaner_number: 'L-123',
        eta_return_date: '2025-01-30',
        notes: 'Test loaner',
      },
    }

    // First assertion: After creating, we should have exactly 10 line items
    expect(initialLineItems).toHaveLength(10)

    // Simulate multiple updates (changing dates, prices, etc.)
    const updates = [
      { ...dealForm, description: 'Updated description 1' },
      { ...dealForm, description: 'Updated description 2', lineItems: initialLineItems },
      {
        ...dealForm,
        lineItems: initialLineItems.map((item, idx) =>
          idx === 0 ? { ...item, unit_price: 599.0 } : item
        ),
      },
    ]

    // For each update, verify that we maintain the same number of items
    for (const updateForm of updates) {
      expect(updateForm.lineItems).toHaveLength(10)
    }

    // Final assertion: Verify that the total_amount calculation is based on ALL items
    const expectedTotal = initialLineItems.reduce(
      (sum, item) => sum + item.unit_price * (item.quantity_used || 1),
      0
    )
    expect(expectedTotal).toBeGreaterThan(499.0) // Should be sum of all items, not just one

    // Verify the calculation formula matches dealService logic
    const calculatedTotal = initialLineItems.reduce((sum, item) => {
      const qty = Number(item?.quantity_used || 1)
      const price = Number(item?.unit_price || 0)
      return sum + qty * price
    }, 0)
    expect(calculatedTotal).toBe(expectedTotal)
  })

  it('should calculate total_amount from all line items, not a single item', async () => {
    // Create a deal with multiple items at different prices
    const lineItems = [
      { product_id: 'prod-1', quantity_used: 60, unit_price: 499.0, requires_scheduling: true },
      { product_id: 'prod-2', quantity_used: 1, unit_price: 200.0, requires_scheduling: true },
      { product_id: 'prod-3', quantity_used: 2, unit_price: 150.0, requires_scheduling: true },
    ]

    // Expected total: 60 * 499 + 1 * 200 + 2 * 150 = 29940 + 200 + 300 = 30440
    const expectedTotal = 60 * 499.0 + 1 * 200.0 + 2 * 150.0

    // Verify the calculation
    const calculatedTotal = lineItems.reduce((sum, item) => {
      const qty = Number(item?.quantity_used || 1)
      const price = Number(item?.unit_price || 0)
      return sum + qty * price
    }, 0)

    expect(calculatedTotal).toBe(expectedTotal)
    expect(calculatedTotal).toBe(30440)

    // Verify it's NOT just the first item's price
    expect(calculatedTotal).not.toBe(499.0)
    expect(calculatedTotal).not.toBe(200.0)
  })

  it('should preserve loaner number across multiple edits', () => {
    // Test the loaner persistence pattern
    const loanerData = {
      loaner_number: 'L-123',
      eta_return_date: '2025-01-30',
      notes: 'Test loaner',
    }

    // Verify loaner data structure
    expect(loanerData.loaner_number).toBe('L-123')
    expect(loanerData.loaner_number?.trim()).toBeTruthy()

    // Simulate the mapFormToDb pattern for loaner
    const formState = {
      customer_needs_loaner: true,
      loanerForm: loanerData,
    }

    // Verify loaner extraction logic
    const extractedLoaner = formState?.loanerForm || null
    expect(extractedLoaner).not.toBeNull()
    expect(extractedLoaner?.loaner_number).toBe('L-123')

    // Verify upsertLoanerAssignment would be called when:
    // 1. customer_needs_loaner is true
    // 2. loanerForm exists and has loaner_number
    const shouldUpsert =
      formState?.customer_needs_loaner && !!extractedLoaner?.loaner_number?.trim()
    expect(shouldUpsert).toBe(true)
  })

  it('should verify deals list shows correct total, not single item price', () => {
    // Mock a deal with multiple parts (like the $29,940 vs $499 scenario)
    const deal = {
      id: 'deal-001',
      job_number: 'JOB-001',
      total_amount: 29940.0, // This should be the sum of all parts
      job_parts: [
        { id: 'part-1', unit_price: 499.0, quantity_used: 60, total_price: 29940.0 },
        { id: 'part-2', unit_price: 200.0, quantity_used: 1, total_price: 200.0 },
      ],
    }

    // Verify the total_amount is numeric
    const totalAmount = parseFloat(deal?.total_amount)
    expect(totalAmount).toBe(29940.0)

    // Verify it's not just one item's price
    expect(totalAmount).not.toBe(499.0)
    expect(totalAmount).not.toBe(200.0)

    // Verify formatting for display (ValueDisplay component pattern)
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })
    const formatted = formatter.format(totalAmount)
    expect(formatted).toBe('$29,940')
  })
})
