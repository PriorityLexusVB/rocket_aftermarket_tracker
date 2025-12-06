// tests/unit/dealService.mapDbDealToForm.test.js
import { describe, it, expect } from 'vitest'
import { mapDbDealToForm } from '@/services/dealService'

describe('mapDbDealToForm', () => {
  it('maps appointment window times from job_parts to line items', () => {
    const dbDeal = {
      id: 'deal-123',
      job_number: 'JOB-001',
      title: 'Test Deal',
      description: 'Test description',
      customer_needs_loaner: false,
      job_parts: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          promised_date: '2025-12-15',
          scheduled_start_time: '2025-12-15T10:00:00',
          scheduled_end_time: '2025-12-15T11:30:00',
          requires_scheduling: true,
          no_schedule_reason: null,
          is_off_site: false,
          vendor_id: null,
        },
      ],
    }

    const formData = mapDbDealToForm(dbDeal)

    expect(formData).toBeDefined()
    expect(formData.lineItems).toHaveLength(1)

    const lineItem = formData.lineItems[0]
    // Time fields should be extracted as HH:MM format for time inputs
    expect(lineItem.scheduled_start_time).toBe('10:00')
    expect(lineItem.scheduledStartTime).toBe('10:00')
    expect(lineItem.scheduled_end_time).toBe('11:30')
    expect(lineItem.scheduledEndTime).toBe('11:30')
    expect(lineItem.promised_date).toBe('2025-12-15')
    expect(lineItem.promisedDate).toBe('2025-12-15')
  })

  it('maps loaner expected return date from loaner_eta_return_date', () => {
    const dbDeal = {
      id: 'deal-456',
      job_number: 'JOB-002',
      title: 'Deal with Loaner',
      description: 'Test',
      customer_needs_loaner: true,
      loaner_number: 'LOANER-001',
      loaner_eta_return_date: '2025-12-20',
      loaner_notes: 'Return by noon',
      job_parts: [],
    }

    const formData = mapDbDealToForm(dbDeal)

    expect(formData).toBeDefined()
    expect(formData.customer_needs_loaner).toBe(true)
    expect(formData.loaner_number).toBe('LOANER-001')
    expect(formData.loanerNumber).toBe('LOANER-001')
    
    // Check top-level eta_return_date field for DealFormV2 compatibility
    expect(formData.eta_return_date).toBe('2025-12-20')
    
    // Check loanerForm nested object
    expect(formData.loanerForm).toBeDefined()
    expect(formData.loanerForm.loaner_number).toBe('LOANER-001')
    expect(formData.loanerForm.eta_return_date).toBe('2025-12-20')
    expect(formData.loanerForm.notes).toBe('Return by noon')
  })

  it('handles deal with both appointment window and loaner return date', () => {
    const dbDeal = {
      id: 'deal-789',
      job_number: 'JOB-003',
      title: 'Complete Deal',
      description: 'Full test',
      customer_needs_loaner: true,
      loaner_number: 'LOANER-002',
      loaner_eta_return_date: '2025-12-18',
      loaner_notes: 'Test notes',
      job_parts: [
        {
          id: 'part-2',
          product_id: 'prod-2',
          unit_price: 200,
          quantity_used: 2,
          promised_date: '2025-12-12',
          scheduled_start_time: '2025-12-12T13:30:00',
          scheduled_end_time: '2025-12-12T15:45:00',
          requires_scheduling: true,
          no_schedule_reason: null,
          is_off_site: true,
          vendor_id: 'vendor-1',
        },
      ],
    }

    const formData = mapDbDealToForm(dbDeal)

    // Check appointment window - should extract time-only (HH:MM)
    expect(formData.lineItems).toHaveLength(1)
    const lineItem = formData.lineItems[0]
    expect(lineItem.scheduledStartTime).toBe('13:30')
    expect(lineItem.scheduledEndTime).toBe('15:45')
    expect(lineItem.promisedDate).toBe('2025-12-12')

    // Check loaner
    expect(formData.loaner_number).toBe('LOANER-002')
    expect(formData.eta_return_date).toBe('2025-12-18')
    expect(formData.loanerForm.eta_return_date).toBe('2025-12-18')
  })

  it('handles missing appointment window times gracefully', () => {
    const dbDeal = {
      id: 'deal-notime',
      job_number: 'JOB-004',
      title: 'No Times',
      description: 'Test',
      customer_needs_loaner: false,
      job_parts: [
        {
          id: 'part-3',
          product_id: 'prod-3',
          unit_price: 50,
          quantity_used: 1,
          promised_date: '2025-12-25',
          scheduled_start_time: null,
          scheduled_end_time: null,
          requires_scheduling: true,
          no_schedule_reason: null,
          is_off_site: false,
          vendor_id: null,
        },
      ],
    }

    const formData = mapDbDealToForm(dbDeal)

    expect(formData.lineItems).toHaveLength(1)
    const lineItem = formData.lineItems[0]
    expect(lineItem.scheduledStartTime).toBe('')
    expect(lineItem.scheduledEndTime).toBe('')
    expect(lineItem.promisedDate).toBe('2025-12-25')
  })

  it('handles missing loaner data gracefully', () => {
    const dbDeal = {
      id: 'deal-noloan',
      job_number: 'JOB-005',
      title: 'No Loaner',
      description: 'Test',
      customer_needs_loaner: false,
      loaner_number: '',
      loaner_eta_return_date: null,
      loaner_notes: '',
      job_parts: [],
    }

    const formData = mapDbDealToForm(dbDeal)

    expect(formData.customer_needs_loaner).toBe(false)
    expect(formData.loaner_number).toBe('')
    expect(formData.eta_return_date).toBe('')
    expect(formData.loanerForm.eta_return_date).toBe('')
  })

  it('extracts time in HH:MM format from ISO datetime strings', () => {
    const dbDeal = {
      id: 'deal-time',
      job_number: 'JOB-006',
      title: 'Time Test',
      description: 'Test time extraction',
      customer_needs_loaner: false,
      job_parts: [
        {
          id: 'part-time',
          product_id: 'prod-1',
          unit_price: 50,
          quantity_used: 1,
          promised_date: '2025-12-25',
          // Full ISO datetime with seconds and timezone
          scheduled_start_time: '2025-12-25T09:15:30.000Z',
          scheduled_end_time: '2025-12-25T17:45:00Z',
          requires_scheduling: true,
          no_schedule_reason: null,
          is_off_site: false,
          vendor_id: null,
        },
      ],
    }

    const formData = mapDbDealToForm(dbDeal)

    expect(formData.lineItems).toHaveLength(1)
    const lineItem = formData.lineItems[0]
    // Should extract only HH:MM, ignoring seconds and timezone
    expect(lineItem.scheduledStartTime).toBe('09:15')
    expect(lineItem.scheduledEndTime).toBe('17:45')
  })

  it('handles time-only format (already HH:MM) gracefully', () => {
    const dbDeal = {
      id: 'deal-timeonly',
      job_number: 'JOB-007',
      title: 'Time Only Test',
      description: 'Test',
      customer_needs_loaner: false,
      job_parts: [
        {
          id: 'part-timeonly',
          product_id: 'prod-1',
          unit_price: 50,
          quantity_used: 1,
          promised_date: '2025-12-25',
          // Already in HH:MM format (shouldn't happen but handle gracefully)
          scheduled_start_time: '14:30',
          scheduled_end_time: '16:00',
          requires_scheduling: true,
          no_schedule_reason: null,
          is_off_site: false,
          vendor_id: null,
        },
      ],
    }

    const formData = mapDbDealToForm(dbDeal)

    expect(formData.lineItems).toHaveLength(1)
    const lineItem = formData.lineItems[0]
    // Should return as-is when already in HH:MM format
    expect(lineItem.scheduledStartTime).toBe('14:30')
    expect(lineItem.scheduledEndTime).toBe('16:00')
  })
})
