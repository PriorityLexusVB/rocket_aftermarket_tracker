import { describe, it, expect } from 'vitest'
import { mapFormToDb, toJobPartRows } from '@/services/dealService'

describe('dealService mapping', () => {
  it('throws when non-scheduled line item lacks reason', () => {
    const form = {
      lineItems: [
        {
          product_id: 1,
          unit_price: 100,
          quantity_used: 1,
          requiresScheduling: false,
          noScheduleReason: '',
        },
      ],
    }
    expect(() => mapFormToDb(form)).toThrow(/line item.*reason/i)
  })

  it('maps booleans and preserves snake_case for DB', () => {
    const form = {
      lineItems: [
        {
          product_id: 1,
          unit_price: 50,
          quantity_used: 2,
          requiresScheduling: true,
          lineItemPromisedDate: '2025-10-25',
          noScheduleReason: null,
          isOffSite: true,
        },
      ],
    }

    const { normalizedLineItems } = mapFormToDb(form)
    expect(normalizedLineItems).toHaveLength(1)
    const li = normalizedLineItems[0]
    expect(li.requires_scheduling).toBe(true)
    expect(li.is_off_site).toBe(true)
    expect(li.promised_date).toBe('2025-10-25')
    expect(li.no_schedule_reason).toBe(null)
  })

  it('toJobPartRows defaults promised_date for scheduled items without date', () => {
    const today = new Date().toISOString().slice(0, 10)
    const items = [{ product_id: 2, unit_price: 10, quantity_used: 1, requiresScheduling: true }]
    const rows = toJobPartRows('job-1', items)
    expect(rows).toHaveLength(1)
    expect(rows[0].promised_date).toBe(today)
    expect(rows[0].requires_scheduling).toBe(true)
  })

  it('allows non-scheduled with a reason', () => {
    const form = {
      lineItems: [
        {
          product_id: 1,
          unit_price: 10,
          quantity_used: 1,
          requiresScheduling: false,
          noScheduleReason: 'Installed at delivery',
        },
      ],
    }
    const mapped = mapFormToDb(form)
    expect(mapped.normalizedLineItems[0].requires_scheduling).toBe(false)
    expect(mapped.normalizedLineItems[0].no_schedule_reason).toBe('Installed at delivery')
  })
})
