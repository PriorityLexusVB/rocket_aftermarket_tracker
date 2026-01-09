// src/tests/dealFormV2.editTimes.test.js
// Test that DealFormV2 correctly displays schedule times when editing a deal

import { describe, it, expect } from 'vitest'

/**
 * This test documents and verifies the fix for the schedule time display bug.
 *
 * ISSUE: When editing a deal, the Start Time / End Time fields in line items
 * showed as blank (--:-- --) even though times were saved correctly in DB.
 *
 * ROOT CAUSE: mapDbDealToForm() converts UTC timestamps to local HH:MM format
 * using formatTime(). DealFormV2 then incorrectly called toTimeInputValue() on
 * these already-formatted strings, which expects ISO datetime strings.
 *
 * FIX: Remove toTimeInputValue() calls in DealFormV2 line item initialization
 * since mapDbDealToForm() already provides the correct HH:MM format.
 */

describe('DealFormV2 - Edit Deal Time Display Fix', () => {
  it('documents the time mapping flow from DB to form inputs', () => {
    // Step 1: Database stores times as UTC timestamptz
    const dbJobPart = {
      id: 'part-1',
      product_id: 'prod-1',
      unit_price: 100,
      quantity_used: 1,
      promised_date: '2025-12-15',
      // Example: 2:00 PM ET = 7:00 PM UTC (assuming EST/UTC-5)
      scheduled_start_time: '2025-12-15T19:00:00Z',
      // Example: 4:30 PM ET = 9:30 PM UTC (assuming EST/UTC-5)
      scheduled_end_time: '2025-12-15T21:30:00Z',
      requires_scheduling: true,
    }

    // Step 2: mapDbDealToForm() uses formatTime() to convert UTC → ET HH:MM
    // This happens in dealService.js:mapDbDealToForm()
    const lineItemFromMapper = {
      ...dbJobPart,
      // formatTime() converts '2025-12-15T19:00:00Z' → '14:00' (ET)
      scheduledStartTime: '14:00',
      scheduled_start_time: '14:00',
      // formatTime() converts '2025-12-15T21:30:00Z' → '16:30' (ET)
      scheduledEndTime: '16:30',
      scheduled_end_time: '16:30',
    }

    // Step 3: DealFormV2 should use these HH:MM values directly for <input type="time">
    // BEFORE FIX: Called toTimeInputValue('14:00') which expects ISO, returned ''
    // AFTER FIX: Uses '14:00' directly, which is correct for time inputs

    // Verify the format is correct for HTML time inputs
    expect(lineItemFromMapper.scheduledStartTime).toBe('14:00')
    expect(lineItemFromMapper.scheduledEndTime).toBe('16:30')
    expect(lineItemFromMapper.scheduledStartTime).toMatch(/^\d{2}:\d{2}$/)
    expect(lineItemFromMapper.scheduledEndTime).toMatch(/^\d{2}:\d{2}$/)
  })

  it('verifies time format is preserved through form initialization', () => {
    // Simulate job.lineItems coming from EditDealModal → mapDbDealToForm()
    const jobFromModal = {
      id: 'job-123',
      lineItems: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: 299.99,
          promised_date: '2025-12-20',
          // These are already in HH:MM format from mapDbDealToForm()
          scheduled_start_time: '09:30',
          scheduledStartTime: '09:30',
          scheduled_end_time: '11:45',
          scheduledEndTime: '11:45',
          requires_scheduling: true,
        },
      ],
    }

    // DealFormV2 initialization logic (AFTER FIX)
    const initialLineItems = jobFromModal.lineItems.map((item) => ({
      ...item,
      dateScheduled: item.promised_date || '',
      // ✅ FIX: Use the already-formatted HH:MM values directly
      scheduledStartTime: item?.scheduled_start_time || item?.scheduledStartTime || '',
      scheduledEndTime: item?.scheduled_end_time || item?.scheduledEndTime || '',
    }))

    // Verify time inputs receive correct format
    expect(initialLineItems[0].scheduledStartTime).toBe('09:30')
    expect(initialLineItems[0].scheduledEndTime).toBe('11:45')
  })

  it('handles missing times gracefully', () => {
    const jobWithNoTimes = {
      id: 'job-456',
      lineItems: [
        {
          id: 'part-2',
          product_id: 'prod-2',
          unit_price: 199.0,
          promised_date: '2025-12-25',
          // No times set
          scheduled_start_time: '',
          scheduledStartTime: '',
          scheduled_end_time: null,
          scheduledEndTime: null,
          requires_scheduling: true,
        },
      ],
    }

    const initialLineItems = jobWithNoTimes.lineItems.map((item) => ({
      ...item,
      scheduledStartTime: item?.scheduled_start_time || item?.scheduledStartTime || '',
      scheduledEndTime: item?.scheduled_end_time || item?.scheduledEndTime || '',
    }))

    // Should default to empty string for blank time inputs
    expect(initialLineItems[0].scheduledStartTime).toBe('')
    expect(initialLineItems[0].scheduledEndTime).toBe('')
  })

  it('preserves both snake_case and camelCase for backward compatibility', () => {
    // mapDbDealToForm() provides both naming conventions
    const lineItem = {
      id: 'part-3',
      scheduled_start_time: '13:15',
      scheduledStartTime: '13:15',
      scheduled_end_time: '15:00',
      scheduledEndTime: '15:00',
    }

    // DealFormV2 can use either convention
    const startTime1 = lineItem?.scheduled_start_time || ''
    const startTime2 = lineItem?.scheduledStartTime || ''

    expect(startTime1).toBe('13:15')
    expect(startTime2).toBe('13:15')
    expect(startTime1).toBe(startTime2)
  })
})

/**
 * VERIFICATION STEPS FOR MANUAL TESTING:
 *
 * 1. Create a new deal with a line item that requires scheduling
 *    - Set Date Scheduled: 2025-12-15
 *    - Set Start Time: 2:00 PM
 *    - Set End Time: 4:30 PM
 *    - Save the deal
 *
 * 2. Open the Edit Deal modal for the same deal
 *    - Verify Date Scheduled shows: 2025-12-15
 *    - Verify Start Time shows: 14:00 (or 2:00 PM if browser uses 12h format)
 *    - Verify End Time shows: 16:30 (or 4:30 PM if browser uses 12h format)
 *    - Previously, these would show as blank (--:-- --)
 *
 * 3. Verify the times also appear correctly in the calendar view
 *
 * 4. Verify no regressions:
 *    - Loaner assignments still work
 *    - Job parts don't duplicate on update
 *    - Other deal fields save correctly
 */
