// src/tests/dealFormV2.fieldMapping.test.js
// Documents and tests the UI → DB field mapping for DealFormV2
// This test serves as documentation and validation of the form's data flow

import { describe, it, expect } from 'vitest'
import { mapFormToDb, mapDbDealToForm, toJobPartRows } from '@/services/dealService'

/**
 * FIELD MAPPING DOCUMENTATION
 * ===========================
 *
 * DealFormV2 (src/components/deals/DealFormV2.jsx) handles both CREATE and EDIT modes.
 * Below is the complete mapping from UI fields to database columns.
 *
 * CUSTOMER SECTION (Step 1):
 * --------------------------
 * UI Field                → DB Column(s)
 * customerName            → transactions.customer_name (via customerName in payload)
 * dealDate                → [currently not persisted to specific column, used for job_number]
 * jobNumber               → jobs.job_number
 * vehicleDescription      → jobs.title (via TitleCase normalization)
 * stockNumber             → vehicles.stock_number (via attachOrCreateVehicleByStockNumber)
 * vin                     → vehicles.vin
 * customerMobile          → transactions.customer_phone (normalized to E.164)
 * customerEmail           → transactions.customer_email
 * vendorId                → jobs.vendor_id (job-level default vendor)
 * notes                   → jobs.description (UI "Notes" maps to description)
 * assignedTo              → jobs.assigned_to (sales consultant)
 * deliveryCoordinator     → jobs.delivery_coordinator_id
 * financeManager          → jobs.finance_manager_id
 * needsLoaner             → jobs.customer_needs_loaner
 * loanerNumber            → loaner_assignments.loaner_number
 * loanerReturnDate        → loaner_assignments.eta_return_date
 * loanerNotes             → loaner_assignments.notes
 *
 * LINE ITEMS SECTION (Step 2):
 * ----------------------------
 * UI Field                → DB Column(s)
 * productId               → job_parts.product_id
 * unitPrice               → job_parts.unit_price
 * requiresScheduling      → job_parts.requires_scheduling
 * dateScheduled           → job_parts.promised_date
 * isMultiDay              → [UI only, not directly persisted]
 * scheduledStartTime      → job_parts.scheduled_start_time (if capability enabled)
 * scheduledEndTime        → job_parts.scheduled_end_time (if capability enabled)
 * noScheduleReason        → job_parts.no_schedule_reason
 * isOffSite               → job_parts.is_off_site
 * vendorId (per-line)     → job_parts.vendor_id
 *
 * COMPUTED FIELDS:
 * ----------------
 * Total                   → transactions.total_amount (sum of line items)
 * dealer_id               → jobs.dealer_id, transactions.dealer_id (from useTenant hook)
 * job_id                  → job_parts.job_id, transactions.job_id, loaner_assignments.job_id
 */

describe('DealFormV2 - UI → DB Field Mapping Documentation', () => {
  describe('Customer Section Mapping', () => {
    it('maps customer name correctly', () => {
      const formData = {
        customerName: 'john smith',
        customer_name: 'john smith',
        lineItems: [],
      }
      const { customerName } = mapFormToDb(formData)
      // Note: Title Case is applied by titleCase function in dealService
      expect(customerName).toBe('John Smith')
    })

    it('maps vehicle description to title with TitleCase', () => {
      const formData = {
        vehicle_description: '2024 honda accord',
        vehicleDescription: '2024 honda accord',
        lineItems: [],
      }
      const { payload } = mapFormToDb(formData)
      expect(payload.title).toBe('2024 Honda Accord')
    })

    it('maps notes to description field', () => {
      const formData = {
        notes: 'Special instructions for this deal',
        lineItems: [],
      }
      const { payload } = mapFormToDb(formData)
      expect(payload.description).toBe('Special instructions for this deal')
    })

    it('includes dealer_id in payload when provided', () => {
      const formData = {
        dealer_id: 'dealer-uuid-123',
        lineItems: [],
      }
      const { payload } = mapFormToDb(formData)
      expect(payload.dealer_id).toBe('dealer-uuid-123')
    })

    it('maps staff assignments correctly', () => {
      const formData = {
        assigned_to: 'sales-user-id',
        delivery_coordinator_id: 'dc-user-id',
        finance_manager_id: 'fm-user-id',
        lineItems: [],
      }
      const { payload } = mapFormToDb(formData)
      expect(payload.assigned_to).toBe('sales-user-id')
      expect(payload.delivery_coordinator_id).toBe('dc-user-id')
      expect(payload.finance_manager_id).toBe('fm-user-id')
    })

    it('maps loaner toggle correctly', () => {
      const formData = {
        customer_needs_loaner: true,
        loanerForm: {
          loaner_number: 'L-1234',
          eta_return_date: '2025-12-01',
          notes: 'Return by 5pm',
        },
        lineItems: [],
      }
      const { payload, loanerForm } = mapFormToDb(formData)
      expect(payload.customer_needs_loaner).toBe(true)
      expect(loanerForm.loaner_number).toBe('L-1234')
      expect(loanerForm.eta_return_date).toBe('2025-12-01')
      expect(loanerForm.notes).toBe('Return by 5pm')
    })
  })

  describe('Line Items Mapping', () => {
    it('maps line item fields correctly', () => {
      const formData = {
        lineItems: [
          {
            product_id: 'prod-uuid-1',
            unit_price: 299.99,
            quantity_used: 1,
            requires_scheduling: true,
            promised_date: '2025-12-15',
            is_off_site: true,
            vendor_id: 'vendor-uuid-1',
          },
        ],
      }
      const { normalizedLineItems } = mapFormToDb(formData)
      const item = normalizedLineItems[0]

      expect(item.product_id).toBe('prod-uuid-1')
      expect(item.unit_price).toBe(299.99)
      expect(item.quantity_used).toBe(1)
      expect(item.requires_scheduling).toBe(true)
      expect(item.promised_date).toBe('2025-12-15')
      expect(item.is_off_site).toBe(true)
      expect(item.vendor_id).toBe('vendor-uuid-1')
    })

    it('maps no-schedule reason correctly', () => {
      const formData = {
        lineItems: [
          {
            product_id: 'prod-uuid-2',
            unit_price: 99,
            quantity_used: 1,
            requires_scheduling: false,
            no_schedule_reason: 'Installed at delivery',
            is_off_site: false,
          },
        ],
      }
      const { normalizedLineItems } = mapFormToDb(formData)
      const item = normalizedLineItems[0]

      expect(item.requires_scheduling).toBe(false)
      expect(item.no_schedule_reason).toBe('Installed at delivery')
    })

    it('toJobPartRows creates correct DB-ready rows', () => {
      const jobId = 'job-uuid-123'
      const lineItems = [
        {
          product_id: 'prod-1',
          vendor_id: 'vendor-1',
          quantity_used: 2,
          unit_price: 150,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-12-20',
          isOffSite: true,
          scheduledStartTime: '09:00',
          scheduledEndTime: '12:00',
        },
      ]

      const rows = toJobPartRows(jobId, lineItems, { includeTimes: true })
      const row = rows[0]

      expect(row.job_id).toBe(jobId)
      expect(row.product_id).toBe('prod-1')
      expect(row.vendor_id).toBe('vendor-1')
      expect(row.quantity_used).toBe(2)
      expect(row.unit_price).toBe(150)
      expect(row.requires_scheduling).toBe(true)
      expect(row.promised_date).toBe('2025-12-20')
      expect(row.is_off_site).toBe(true)
      expect(row.scheduled_start_time).toBe('09:00')
      expect(row.scheduled_end_time).toBe('12:00')
    })

    it('toJobPartRows excludes time fields when capability disabled', () => {
      const rows = toJobPartRows(
        'job-1',
        [
          {
            product_id: 'prod-1',
            requiresScheduling: true,
            lineItemPromisedDate: '2025-12-20',
            scheduledStartTime: '09:00',
            scheduledEndTime: '12:00',
          },
        ],
        { includeTimes: false }
      )

      expect(rows[0].scheduled_start_time).toBeUndefined()
      expect(rows[0].scheduled_end_time).toBeUndefined()
    })
  })

  describe('DB → Form Mapping (Edit Mode)', () => {
    it('mapDbDealToForm correctly maps for edit mode', () => {
      const dbDeal = {
        id: 'deal-uuid-123',
        dealer_id: 'dealer-uuid-456',
        job_number: 'JOB-001',
        title: '2024 Lexus RX350',
        description: 'Customer requested early delivery',
        vehicle_id: 'vehicle-uuid-789',
        vendor_id: 'vendor-uuid-123',
        job_status: 'pending',
        assigned_to: 'sales-user-id',
        delivery_coordinator_id: 'dc-user-id',
        finance_manager_id: 'fm-user-id',
        customer_needs_loaner: true,
        customer_name: 'Jane Doe',
        customer_phone: '+15551234567',
        customer_email: 'jane@example.com',
        loaner_number: 'L-5678',
        loaner_eta_return_date: '2025-12-25',
        loaner_notes: 'Full tank required',
        vehicle: {
          stock_number: 'STK-001',
          vin: '1HGBH41JXMN109186',
        },
        job_parts: [
          {
            id: 'part-uuid-1',
            product_id: 'prod-uuid-1',
            unit_price: '299.99',
            quantity_used: 1,
            promised_date: '2025-12-15',
            requires_scheduling: true,
            is_off_site: true,
            vendor_id: 'line-vendor-uuid-1',
            scheduled_start_time: '09:00:00',
            scheduled_end_time: '12:00:00',
          },
        ],
        updated_at: '2025-11-25T10:00:00Z',
      }

      const formData = mapDbDealToForm(dbDeal)

      // Core fields
      expect(formData.id).toBe('deal-uuid-123')
      expect(formData.dealer_id).toBe('dealer-uuid-456')
      expect(formData.job_number).toBe('JOB-001')
      expect(formData.vehicle_description).toBe('2024 Lexus RX350')
      expect(formData.notes).toBe('Customer requested early delivery')

      // Staff assignments
      expect(formData.assigned_to).toBe('sales-user-id')
      expect(formData.delivery_coordinator_id).toBe('dc-user-id')
      expect(formData.finance_manager_id).toBe('fm-user-id')

      // Customer fields
      expect(formData.customer_name).toBe('Jane Doe')
      expect(formData.customer_phone).toBe('+15551234567')
      expect(formData.customer_email).toBe('jane@example.com')

      // Loaner fields
      expect(formData.customer_needs_loaner).toBe(true)
      expect(formData.loanerForm.loaner_number).toBe('L-5678')
      expect(formData.loanerForm.eta_return_date).toBe('2025-12-25')
      expect(formData.loanerForm.notes).toBe('Full tank required')

      // Stock number from vehicle
      expect(formData.stock_number).toBe('STK-001')

      // Line items
      expect(formData.lineItems).toHaveLength(1)
      const lineItem = formData.lineItems[0]
      expect(lineItem.product_id).toBe('prod-uuid-1')
      // Note: DB returns unit_price as string, mapDbDealToForm preserves this
      expect(Number(lineItem.unit_price)).toBe(299.99)
      expect(lineItem.requires_scheduling).toBe(true)
      expect(lineItem.is_off_site).toBe(true)
      expect(lineItem.vendor_id).toBe('line-vendor-uuid-1')
    })
  })

  describe('Create vs Edit Mode Behavior', () => {
    it('create mode requires dealer_id for RLS compliance', () => {
      // This documents that the form includes dealer_id from useTenant hook
      const formData = {
        dealer_id: 'required-dealer-id',
        customerName: 'Test',
        jobNumber: 'JOB-001',
        lineItems: [
          {
            product_id: 'prod-1',
            unit_price: 100,
            requires_scheduling: true,
            promised_date: '2025-12-15',
          },
        ],
      }
      const { payload } = mapFormToDb(formData)
      expect(payload.dealer_id).toBe('required-dealer-id')
    })

    it('edit mode preserves dealer_id from existing deal', () => {
      const dbDeal = {
        id: 'existing-deal-id',
        dealer_id: 'existing-dealer-id',
        job_number: 'JOB-002',
        title: 'Test Deal',
        job_parts: [],
      }

      const formData = mapDbDealToForm(dbDeal)
      expect(formData.dealer_id).toBe('existing-dealer-id')
    })
  })

  describe('Total Amount Calculation', () => {
    it('calculates correct total from line items', () => {
      const formData = {
        lineItems: [
          { product_id: 'p1', unit_price: 299.99, quantity_used: 1, requires_scheduling: true },
          { product_id: 'p2', unit_price: 199.5, quantity_used: 2, requires_scheduling: true },
        ],
      }
      const { jobParts } = mapFormToDb(formData)

      const total = jobParts.reduce((sum, item) => sum + item.total_price, 0)
      expect(total).toBe(299.99 + 199.5 * 2) // 698.99
    })
  })
})

describe('DealFormV2 - V2 Flag Behavior', () => {
  it('V2 behavior: loaner form is properly structured', () => {
    const formData = {
      customer_needs_loaner: true,
      loanerForm: {
        loaner_number: 'L-1234',
        eta_return_date: '2025-12-01',
        notes: 'Handle with care',
      },
      lineItems: [],
    }

    const { loanerForm } = mapFormToDb(formData)
    expect(loanerForm).toEqual({
      loaner_number: 'L-1234',
      eta_return_date: '2025-12-01',
      notes: 'Handle with care',
    })
  })

  it('V2 behavior: loaner form is null when toggle off', () => {
    const formData = {
      customer_needs_loaner: false,
      lineItems: [],
    }

    const { loanerForm } = mapFormToDb(formData)
    expect(loanerForm).toBeNull()
  })
})

/**
 * Tests for dealer_id preservation - critical for RLS compliance
 * These tests document the expected behavior when editing legacy deals
 */
describe('DealFormV2 - dealer_id Preservation for RLS Compliance', () => {
  it('dealer_id flows through full edit cycle: DB → Form → Payload', () => {
    // Simulate loading a deal from database
    const dbDeal = {
      id: 'job-uuid-123',
      dealer_id: 'dealer-uuid-456',
      job_number: 'JOB-TEST-001',
      title: '2024 Lexus RX350',
      description: 'Customer notes',
      job_status: 'pending',
      customer_needs_loaner: false,
      job_parts: [
        {
          id: 'part-1',
          product_id: 'prod-1',
          unit_price: '499.00',
          quantity_used: 1,
          requires_scheduling: true,
          promised_date: '2025-12-15',
        },
      ],
    }

    // Map DB → Form
    const formData = mapDbDealToForm(dbDeal)
    expect(formData.dealer_id).toBe('dealer-uuid-456')

    // Simulate user editing (dealer_id should NOT be lost)
    const editedFormData = {
      ...formData,
      customer_name: 'Updated Customer Name',
    }

    // Map Form → DB payload
    const { payload } = mapFormToDb(editedFormData)
    expect(payload.dealer_id).toBe('dealer-uuid-456')
  })

  it('dealer_id in payload enables RLS-compliant transaction updates', () => {
    const formData = {
      dealer_id: 'dealer-uuid-789',
      job_number: 'JOB-002',
      customer_name: 'Test Customer',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 299.99,
          quantity_used: 1,
        },
      ],
    }

    const { payload } = mapFormToDb(formData)

    // The transaction upsert will use this dealer_id
    // to satisfy RLS policy: dealer_id = auth_dealer_id()
    expect(payload.dealer_id).toBe('dealer-uuid-789')
  })
})
