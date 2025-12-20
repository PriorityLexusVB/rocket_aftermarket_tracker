import { describe, it, expect } from 'vitest'
import {
  entityToDraft,
  draftToCreatePayload,
  draftToUpdatePayload,
} from '@/components/deals/formAdapters'

describe('formAdapters', () => {
  it('omits loaner keys when toggle is OFF', () => {
    const draft = { customer_needs_loaner: false, loaner_pickup: '2025-10-30', foo: 'bar' }
    const out = draftToCreatePayload(draft)
    expect(out.loaner_pickup).toBeUndefined()
    expect(out.foo).toBe('bar')
  })

  it('keeps loaner keys when toggle is ON', () => {
    const draft = { customer_needs_loaner: true, loaner_pickup: '2025-10-30' }
    const out = draftToCreatePayload(draft)
    expect(out.loaner_pickup).toBe('2025-10-30')
  })

  it('normalizes items and drops invalid/zero qty', () => {
    const draft = {
      items: [
        { sku: 'A', unit_price: '499', qty: '1' },
        { sku: 'B', unitPrice: 100, quantity: 0 }, // dropped
        null, // dropped
      ],
    }
    const out = draftToCreatePayload(draft)
    expect(out.items).toEqual([{ sku: 'A', unitPrice: 499, quantity: 1 }])
  })

  it('entityToDraft is resilient and normalizes items', () => {
    const entity = { items: [{ price: '250', quantity: '2' }] }
    const d = entityToDraft(entity)
    expect(d.items[0].unitPrice).toBe(250)
    expect(d.items[0].quantity).toBe(2)
  })

  it('draftToUpdatePayload forwards id from original if missing in draft', () => {
    const original = { id: 'deal_123' }
    const d = { items: [{ unitPrice: 1, quantity: 1 }] }
    const out = draftToUpdatePayload(original, d)
    expect(out.id).toBe('deal_123')
  })
})
