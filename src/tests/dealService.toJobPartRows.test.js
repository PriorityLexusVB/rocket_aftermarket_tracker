import { describe, it, expect } from 'vitest'
import { toJobPartRows } from '@/services/dealService'

// Note: This test focuses on the pure mapping logic, not network calls.
describe('toJobPartRows', () => {
  it('defaults promised_date to today when requiresScheduling is true and no date provided', () => {
    const today = new Date().toISOString().slice(0, 10)
    const rows = toJobPartRows('job-1', [
      { product_id: 'prod-1', unit_price: 100, quantity_used: 1, requiresScheduling: true },
    ])
    expect(rows).toHaveLength(1)
    expect(rows[0].promised_date.slice(0, 10)).toBe(today)
    expect(rows[0].requires_scheduling).toBe(true)
  })

  it('keeps provided promised_date as-is', () => {
    const rows = toJobPartRows('job-1', [
      {
        product_id: 'prod-2',
        unit_price: 50,
        quantity_used: 2,
        requiresScheduling: true,
        lineItemPromisedDate: '2030-01-01',
      },
    ])
    expect(rows[0].promised_date.startsWith('2030-01-01')).toBe(true)
  })

  it('sets no_schedule_reason when requiresScheduling is false', () => {
    const rows = toJobPartRows('job-1', [
      {
        product_id: 'prod-3',
        unit_price: 10,
        quantity_used: 1,
        requiresScheduling: false,
        noScheduleReason: 'Customer unavailable',
      },
    ])
    expect(rows[0].requires_scheduling).toBe(false)
    expect(rows[0].no_schedule_reason).toBe('Customer unavailable')
  })
})
