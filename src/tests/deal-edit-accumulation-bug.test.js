/**
 * Test to reproduce the job_parts accumulation bug reported in PR #195
 *
 * Issue: When editing a deal multiple times, job_parts rows accumulate in the database
 * instead of being replaced. Each save adds more rows instead of maintaining the same count.
 *
 * Expected behavior:
 * - Start with N line items
 * - Edit and save M times
 * - Database should have exactly N rows (not N*M rows)
 */

import { describe, it, expect } from 'vitest'
import { draftToUpdatePayload, normalizeLineItems } from '../components/deals/formAdapters'
import { toJobPartRows, mapDbDealToForm } from '../services/dealService'

describe('Deal Edit - Job Parts Accumulation Bug', () => {
  it('formAdapters should not duplicate line items', () => {
    // Simulate the payload from DealFormV2
    const payloadFromForm = {
      id: 'job-123',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          promised_date: '2025-01-20',
          requires_scheduling: true,
          is_off_site: false,
        },
      ],
    }

    // Pass through draftToUpdatePayload (as happens when VITE_DEAL_FORM_V2=true)
    const adapted = draftToUpdatePayload({ id: 'job-123' }, payloadFromForm)

    // Should still have exactly 1 line item
    expect(adapted.lineItems).toHaveLength(1)
    expect(adapted.items).toHaveLength(1)
  })

  it('normalizeLineItems should not accumulate items', () => {
    const draft = {
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity: 1,
        },
      ],
    }

    // Call normalizeLineItems multiple times
    const result1 = normalizeLineItems(draft)
    expect(result1).toHaveLength(1)

    const result2 = normalizeLineItems(draft)
    expect(result2).toHaveLength(1)

    const result3 = normalizeLineItems(draft)
    expect(result3).toHaveLength(1)
  })

  it('toJobPartRows should create exactly N rows for N input items', () => {
    const jobId = 'job-123'
    const lineItems = [
      {
        product_id: 'prod-1',
        unit_price: 100,
        quantity_used: 1,
        requiresScheduling: true,
        lineItemPromisedDate: '2025-01-20',
        scheduledStartTime: '09:00',
        scheduledEndTime: '17:00',
        isOffSite: false,
      },
    ]

    const rows = toJobPartRows(jobId, lineItems, { includeTimes: true })

    expect(rows).toHaveLength(1)
    expect(rows[0].product_id).toBe('prod-1')
    expect(rows[0].job_id).toBe(jobId)
  })

  it('multiple passes through adapters should maintain count', () => {
    // Simulate: Form → Adapter → Service → DB

    // Step 1: Start with 1 line item from form
    const formPayload = {
      lineItems: [
        {
          product_id: 'prod-1',
          unitPrice: 100,
          quantity: 1,
        },
      ],
    }

    // Step 2: Pass through adapter
    const adapted = draftToUpdatePayload({ id: 'job-123' }, formPayload)
    expect(adapted.lineItems).toHaveLength(1)

    // Step 3: Convert to DB rows
    const rows = toJobPartRows('job-123', adapted.lineItems, { includeTimes: true })
    expect(rows).toHaveLength(1)

    // Step 4: Simulate multiple edits - each should maintain count
    for (let i = 0; i < 5; i++) {
      const editedPayload = {
        lineItems: [
          {
            product_id: 'prod-1',
            unitPrice: 100 + i,
            quantity: 1,
          },
        ],
      }

      const editedAdapted = draftToUpdatePayload({ id: 'job-123' }, editedPayload)
      expect(editedAdapted.lineItems).toHaveLength(1)

      const editedRows = toJobPartRows('job-123', editedAdapted.lineItems, { includeTimes: true })
      expect(editedRows).toHaveLength(1)
    }
  })

  it('CRITICAL: simulates the full edit cycle that user is experiencing', () => {
    // This test simulates what happens when user edits a deal multiple times
    // Expected: Count should stay constant
    // Bug: Count accumulates (1→2→3→4)

    // Cycle 1: Start with deal that has 1 item in DB
    const dbDeal1 = {
      id: 'job-123',
      job_number: 'TEST-001',
      job_parts: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          promised_date: '2025-01-20',
          requires_scheduling: true,
          is_off_site: false,
        },
      ],
    }

    // Load into form
    const formDeal1 = mapDbDealToForm(dbDeal1)
    expect(formDeal1.lineItems).toHaveLength(1) // Should load 1 item

    // User edits and saves (simulate DealFormV2 payload creation)
    const savePayload1 = {
      lineItems: formDeal1.lineItems.map((item) => ({
        product_id: item.product_id,
        unit_price: item.unit_price + 10, // User changed price
        quantity_used: item.quantity_used,
        promised_date: item.promised_date,
        requires_scheduling: item.requires_scheduling,
        is_off_site: item.is_off_site,
      })),
    }
    expect(savePayload1.lineItems).toHaveLength(1) // Payload should have 1 item

    // Convert to DB rows (simulate updateDeal)
    const rows1 = toJobPartRows('job-123', savePayload1.lineItems, { includeTimes: false })
    expect(rows1).toHaveLength(1) // Should INSERT 1 row

    // Cycle 2: Assume DB now has the saved items (should be 1 row)
    // Simulate fetching from DB after save
    const dbDeal2 = {
      id: 'job-123',
      job_number: 'TEST-001',
      job_parts: rows1.map((row, idx) => ({
        id: `part-${idx + 1}`,
        ...row,
      })),
    }

    expect(dbDeal2.job_parts).toHaveLength(1) // DB should have 1 row

    // Load into form again
    const formDeal2 = mapDbDealToForm(dbDeal2)
    expect(formDeal2.lineItems).toHaveLength(1) // Should load 1 item (not 2!)

    // Save again
    const savePayload2 = {
      lineItems: formDeal2.lineItems.map((item) => ({
        product_id: item.product_id,
        unit_price: item.unit_price + 10,
        quantity_used: item.quantity_used,
        promised_date: item.promised_date,
        requires_scheduling: item.requires_scheduling,
        is_off_site: item.is_off_site,
      })),
    }
    expect(savePayload2.lineItems).toHaveLength(1) // Should still be 1

    const rows2 = toJobPartRows('job-123', savePayload2.lineItems, { includeTimes: false })
    expect(rows2).toHaveLength(1) // Should INSERT 1 row (not 2!)
  })
})
