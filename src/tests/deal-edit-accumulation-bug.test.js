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
import { toJobPartRows } from '../services/dealService'

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
        }
      ]
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
        }
      ]
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
      }
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
        }
      ]
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
        lineItems: [{
          product_id: 'prod-1',
          unitPrice: 100 + i,
          quantity: 1,
        }]
      }
      
      const editedAdapted = draftToUpdatePayload({ id: 'job-123' }, editedPayload)
      expect(editedAdapted.lineItems).toHaveLength(1)
      
      const editedRows = toJobPartRows('job-123', editedAdapted.lineItems, { includeTimes: true })
      expect(editedRows).toHaveLength(1)
    }
  })
})
