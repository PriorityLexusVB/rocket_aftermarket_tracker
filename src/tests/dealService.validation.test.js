import { describe, it, expect } from 'vitest'
import { mapFormToDb } from '../services/dealService'

describe('dealService mapFormToDb validation', () => {
  it('passes when non-scheduled items include a reason and numbers are coerced', () => {
    const form = {
      job_number: 'J-1',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: '199.99',
          quantity_used: undefined,
          requires_scheduling: false,
          no_schedule_reason: 'Customer will call back',
        },
      ],
    }

    const { normalizedLineItems } = mapFormToDb(form)
    expect(normalizedLineItems).toHaveLength(1)
    expect(normalizedLineItems[0].quantity_used).toBe(1)
    expect(normalizedLineItems[0].unit_price).toBe(199.99)
    expect(normalizedLineItems[0].requires_scheduling).toBe(false)
    expect(normalizedLineItems[0].no_schedule_reason).toBe('Customer will call back')
  })

  it('throws if a non-scheduled line item is missing a reason', () => {
    const form = {
      job_number: 'J-2',
      lineItems: [
        {
          product_id: 'prod-1',
          unit_price: 100,
          quantity_used: 1,
          requires_scheduling: false,
          no_schedule_reason: '',
        },
      ],
    }

    expect(() => mapFormToDb(form)).toThrow(/reason/i)
  })

  it('throws if no line items have a product selected', () => {
    const form = {
      job_number: 'J-3',
      lineItems: [
        {
          product_id: '',
          unit_price: 50,
          quantity_used: 1,
          requires_scheduling: true,
        },
      ],
    }

    expect(() => mapFormToDb(form)).toThrow(/product/i)
  })
})
