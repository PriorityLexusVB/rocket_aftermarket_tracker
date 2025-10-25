import { describe, it, expect, vi, beforeEach } from 'vitest'

let callCount = 0

vi.mock('@/lib/supabase', () => {
  function chain() {
    return {
      select() {
        return this
      },
      order() {
        return this
      },
      eq() {
        return this
      },
      in() {
        return this
      },
      or() {
        return this
      },
      limit() {
        return this
      },
      async throwOnError() {
        callCount += 1
        // Small delay to simulate network and expose dedupe
        await new Promise((r) => setTimeout(r, 10))
        return { data: [{ id: 'p1', name: 'Widget', brand: 'Acme', unit_price: 99 }] }
      },
    }
  }
  return {
    supabase: {
      from(table) {
        return chain()
      },
    },
  }
})

// Import after mocks
import { getProducts, clearDropdownCache } from '@/services/dropdownService'

describe('dropdownService dedupe', () => {
  beforeEach(() => {
    clearDropdownCache()
    callCount = 0
  })

  it('dedupes parallel getProducts calls to one fetch', async () => {
    const [a, b] = await Promise.all([getProducts(), getProducts()])
    expect(a).toEqual(b)
    expect(callCount).toBe(1)
  })

  it('uses cache on subsequent calls without additional fetches', async () => {
    const first = await getProducts()
    const second = await getProducts()
    expect(first).toEqual(second)
    expect(callCount).toBe(1)
  })
})
