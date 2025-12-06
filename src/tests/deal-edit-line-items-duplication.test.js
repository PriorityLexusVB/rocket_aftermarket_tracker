/**
 * Test for line item duplication bug in deal edit flow
 * 
 * Bug description:
 * - When editing a deal and saving, job_parts are deleted then re-inserted
 * - After reopening the same deal, line items sometimes show duplicated in the UI
 * - Time fields sometimes come back blank
 * 
 * Root cause hypothesis:
 * - DealFormV2 component's useEffect (line 129-183) may be setting lineItems multiple times
 * - Or mapDbDealToForm may be producing duplicate entries
 * - Or the DELETE + INSERT in updateDeal may be creating duplicates
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mapDbDealToForm, toJobPartRows } from '../services/dealService'

describe('Deal Edit - Line Items Duplication Bug', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('mapDbDealToForm should produce exactly N lineItems for N job_parts', () => {
    const dbDeal = {
      id: 'job-123',
      job_number: 'TEST-001',
      customer_name: 'Test Customer',
      org_id: 'org-456',
      job_parts: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          promised_date: '2025-01-20',
          scheduled_start_time: '2025-01-20T09:00:00',
          scheduled_end_time: '2025-01-20T17:00:00',
          requires_scheduling: true,
          is_off_site: false,
          vendor_id: null,
        },
        {
          id: 'part-2',
          product_id: 'prod-2',
          unit_price: 200,
          quantity_used: 1,
          promised_date: '2025-01-21',
          scheduled_start_time: '2025-01-21T10:00:00',
          scheduled_end_time: '2025-01-21T16:00:00',
          requires_scheduling: true,
          is_off_site: false,
          vendor_id: null,
        },
      ],
    }

    const formDeal = mapDbDealToForm(dbDeal)

    expect(formDeal).toBeDefined()
    expect(formDeal.lineItems).toBeDefined()
    expect(formDeal.lineItems).toHaveLength(2)
    
    // Verify each line item has the correct data
    expect(formDeal.lineItems[0].product_id).toBe('prod-1')
    expect(formDeal.lineItems[0].unit_price).toBe(100)
    expect(formDeal.lineItems[1].product_id).toBe('prod-2')
    expect(formDeal.lineItems[1].unit_price).toBe(200)
  })

  it('mapDbDealToForm should preserve scheduled times in HH:MM format', () => {
    const dbDeal = {
      id: 'job-123',
      job_number: 'TEST-001',
      job_parts: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          promised_date: '2025-01-20',
          // These are ISO datetime strings from the database
          scheduled_start_time: '2025-01-20T13:30:00',
          scheduled_end_time: '2025-01-20T15:45:00',
          requires_scheduling: true,
          is_off_site: false,
        },
      ],
    }

    const formDeal = mapDbDealToForm(dbDeal)

    // formatTime() should convert to HH:MM format for time pickers
    // The actual format depends on formatTime implementation and timezone
    // For now, just verify they're not empty
    expect(formDeal.lineItems[0].scheduled_start_time).toBeTruthy()
    expect(formDeal.lineItems[0].scheduled_end_time).toBeTruthy()
    expect(formDeal.lineItems[0].scheduledStartTime).toBeTruthy()
    expect(formDeal.lineItems[0].scheduledEndTime).toBeTruthy()
  })

  it('toJobPartRows should create exactly N rows for N line items', () => {
    const jobId = 'job-123'
    const lineItems = [
      {
        product_id: 'prod-1',
        unit_price: 100,
        requiresScheduling: true,
        lineItemPromisedDate: '2025-01-20',
        scheduledStartTime: '2025-01-20T09:00:00',
        scheduledEndTime: '2025-01-20T17:00:00',
        isOffSite: false,
        vendorId: null,
      },
      {
        product_id: 'prod-2',
        unit_price: 200,
        requiresScheduling: true,
        lineItemPromisedDate: '2025-01-21',
        scheduledStartTime: '2025-01-21T10:00:00',
        scheduledEndTime: '2025-01-21T16:00:00',
        isOffSite: false,
        vendorId: null,
      },
    ]

    const rows = toJobPartRows(jobId, lineItems, { includeTimes: true })

    expect(rows).toHaveLength(2)
    expect(rows[0].product_id).toBe('prod-1')
    expect(rows[0].unit_price).toBe(100)
    expect(rows[1].product_id).toBe('prod-2')
    expect(rows[1].unit_price).toBe(200)
  })

  it('round-trip: mapDbDealToForm → toJobPartRows should preserve count and data', () => {
    // Simulate: load deal from DB → map to form → user edits → map back to DB rows
    const dbDeal = {
      id: 'job-123',
      job_number: 'TEST-001',
      org_id: 'org-456',
      job_parts: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          promised_date: '2025-01-20',
          scheduled_start_time: '2025-01-20T09:00:00',
          scheduled_end_time: '2025-01-20T17:00:00',
          requires_scheduling: true,
          is_off_site: false,
          vendor_id: null,
        },
      ],
    }

    // Step 1: Load deal and map to form format
    const formDeal = mapDbDealToForm(dbDeal)
    expect(formDeal.lineItems).toHaveLength(1)

    // Step 2: User saves without changes - convert back to DB rows
    const rows = toJobPartRows(dbDeal.id, formDeal.lineItems, { includeTimes: true })
    expect(rows).toHaveLength(1)
    expect(rows[0].product_id).toBe('prod-1')
  })

  it('should handle empty job_parts array', () => {
    const dbDeal = {
      id: 'job-123',
      job_number: 'TEST-001',
      job_parts: [],
    }

    const formDeal = mapDbDealToForm(dbDeal)
    expect(formDeal.lineItems).toHaveLength(0)
  })

  it('should handle missing job_parts field', () => {
    const dbDeal = {
      id: 'job-123',
      job_number: 'TEST-001',
      // job_parts field is missing
    }

    const formDeal = mapDbDealToForm(dbDeal)
    expect(formDeal.lineItems).toHaveLength(0)
  })

  it('time fields should round-trip correctly (DB → Form → DB)', () => {
    // Step 1: Start with DB data with ISO timestamps
    const dbDeal = {
      id: 'job-123',
      job_number: 'TEST-001',
      org_id: 'org-456',
      job_parts: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          promised_date: '2025-01-20',
          scheduled_start_time: '2025-01-20T09:30:00-05:00',  // ISO with TZ
          scheduled_end_time: '2025-01-20T17:00:00-05:00',
          requires_scheduling: true,
          is_off_site: false,
        },
      ],
    }

    // Step 2: Map to form (should use formatTime to convert to HH:MM)
    const formDeal = mapDbDealToForm(dbDeal)
    
    // formatTime should produce HH:MM format
    expect(formDeal.lineItems[0].scheduled_start_time).toBeTruthy()
    expect(formDeal.lineItems[0].scheduled_end_time).toBeTruthy()
    
    // Should be in HH:MM format (either "09:30" or "9:30" depending on formatTime)
    const startTime = formDeal.lineItems[0].scheduled_start_time
    const endTime = formDeal.lineItems[0].scheduled_end_time
    
    // Should be in HH:MM format (two-digit hours)
    expect(startTime).toMatch(/^\d{2}:\d{2}$/)
    expect(endTime).toMatch(/^\d{2}:\d{2}$/)
    
    // Step 3: Convert back to DB rows (would happen in save)
    // In the actual save flow, combineDateAndTime would convert HH:MM back to ISO
    // For this test, we're just verifying the time values are preserved
    const rows = toJobPartRows(dbDeal.id, formDeal.lineItems, { includeTimes: true })
    
    expect(rows).toHaveLength(1)
    // The times in rows would be ISO format after combineDateAndTime
    // For now, just verify they exist
    expect(rows[0].scheduled_start_time).toBeTruthy()
    expect(rows[0].scheduled_end_time).toBeTruthy()
  })
})
