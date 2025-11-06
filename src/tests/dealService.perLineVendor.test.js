import { describe, it, expect } from 'vitest'
import { toJobPartRows } from '@/services/dealService'

// Test per-line vendor support added in migration 20251106000000_add_job_parts_vendor_id.sql
describe('toJobPartRows - per-line vendor support', () => {
  it('includes vendor_id when provided in snake_case', () => {
    const rows = toJobPartRows('job-1', [
      {
        product_id: 'prod-1',
        vendor_id: 'vendor-123',
        unit_price: 100,
        quantity_used: 1,
        requiresScheduling: true,
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].vendor_id).toBe('vendor-123')
  })

  it('includes vendor_id when provided in camelCase', () => {
    const rows = toJobPartRows('job-1', [
      {
        product_id: 'prod-1',
        vendorId: 'vendor-456',
        unit_price: 100,
        quantity_used: 1,
        requiresScheduling: true,
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].vendor_id).toBe('vendor-456')
  })

  it('sets vendor_id to null when not provided', () => {
    const rows = toJobPartRows('job-1', [
      {
        product_id: 'prod-1',
        unit_price: 100,
        quantity_used: 1,
        requiresScheduling: true,
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].vendor_id).toBe(null)
  })

  it('allows different vendors for different line items', () => {
    const rows = toJobPartRows('job-1', [
      {
        product_id: 'prod-1',
        vendor_id: 'vendor-A',
        unit_price: 100,
        quantity_used: 1,
        requiresScheduling: true,
      },
      {
        product_id: 'prod-2',
        vendor_id: 'vendor-B',
        unit_price: 200,
        quantity_used: 1,
        requiresScheduling: true,
      },
    ])
    expect(rows).toHaveLength(2)
    expect(rows[0].vendor_id).toBe('vendor-A')
    expect(rows[1].vendor_id).toBe('vendor-B')
  })

  it('preserves vendor_id alongside other line item fields', () => {
    const rows = toJobPartRows('job-1', [
      {
        product_id: 'prod-1',
        vendor_id: 'vendor-789',
        unit_price: 150,
        quantity_used: 2,
        requiresScheduling: false,
        noScheduleReason: 'Off-site work',
        isOffSite: true,
      },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].vendor_id).toBe('vendor-789')
    expect(rows[0].product_id).toBe('prod-1')
    expect(rows[0].quantity_used).toBe(2)
    expect(rows[0].unit_price).toBe(150)
    expect(rows[0].requires_scheduling).toBe(false)
    expect(rows[0].no_schedule_reason).toBe('Off-site work')
    expect(rows[0].is_off_site).toBe(true)
  })
})
