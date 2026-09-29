import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ rows: [] }))

vi.mock('@/lib/supabase', () => {
  const query = {
    select: () => query,
    not: () => query,
    eq: () => query,
    throwOnError: async () => ({ data: state.rows }),
  }

  return { supabase: { from: () => query } }
})

import analyticsService from '@/services/analyticsService'

describe('analyticsService vehicle condition analysis', () => {
  beforeEach(() => {
    state.rows = [
      {
        quantity_used: 1,
        total_price: 200,
        products: { name: 'Current product', category: 'Protection', brand: 'A' },
        jobs: { vehicles: { year: 2026, make: 'Lexus', model: 'RX' } },
      },
      {
        quantity_used: 2,
        total_price: 300,
        products: { name: 'Older product', category: 'Appearance', brand: 'B' },
        jobs: { vehicles: { year: 2012, make: 'Lexus', model: 'ES' } },
      },
      {
        quantity_used: 3,
        total_price: 400,
        products: { name: 'Missing year product', category: 'Care', brand: 'C' },
        jobs: { vehicles: { year: null, make: 'Lexus', model: 'GX' } },
      },
    ]
  })

  it('keeps current, older, and missing-year rows unknown without losing totals', async () => {
    const result = await analyticsService.getProductsByVehicleType()

    expect(result.condition_available).toBe(false)
    expect(result.new).toEqual([])
    expect(result.used).toEqual([])
    expect(result.unknown).toHaveLength(3)
    expect(result.unknown.map((item) => item.vehicle_year)).toEqual([2026, 2012, null])
    expect(result.unknown.reduce((sum, item) => sum + item.quantity_used, 0)).toBe(6)
    expect(result.unknown.reduce((sum, item) => sum + item.total_price, 0)).toBe(900)
  })
})
