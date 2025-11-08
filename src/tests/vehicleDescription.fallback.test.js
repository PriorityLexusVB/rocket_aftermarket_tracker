import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock supabase minimal API used by dealService
vi.mock('@/lib/supabase', () => {
  const calls = []
  const supabase = {
    from() {
      calls.push({ op: 'from' })
      return {
        select() {
          return { single: () => ({ data: null, error: null }) }
        },
      }
    },
    rpc() {
      return { error: null }
    },
    channel() {
      return { on() {}, subscribe() {} }
    },
    removeChannel() {},
    __calls: calls,
  }
  return { supabase }
})

import * as dealService from '@/services/dealService.js'

describe('Vehicle Description Fallback Precedence', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses explicit non-generic title as description (highest precedence)', () => {
    const input = {
      title: '2024 Lexus RX350 F Sport',
      vehicle_description: 'ignored if explicit non-generic title',
      lineItems: [],
    }
    const { payload } = dealService.mapFormToDb(input)
    expect(payload.title).toBe('2024 Lexus RX350 F Sport')
  })

  it('uses vehicle_description (TitleCase) when title missing or generic', () => {
    const input = {
      title: 'Deal JOB-123',
      vehicle_description: '2024 lexus rx350',
      lineItems: [],
    }
    const { payload } = dealService.mapFormToDb(input)
    // titleCase keeps model casing as Rx350 per formatter implementation
    expect(payload.title).toBe('2024 Lexus Rx350')
  })

  it('falls back to derived vehicle fields when title generic and no vehicle_description at mapDbDealToForm', () => {
    const dbDeal = {
      id: 'id-1',
      title: 'Deal JOB-789',
      vehicle: { year: 2025, make: 'Toyota', model: 'Tacoma' },
      job_parts: [],
    }
    const form = dealService.mapDbDealToForm(dbDeal)
    expect(form.vehicle_description).toBe('2025 Toyota Tacoma')
  })

  it('falls back to job number placeholder when no title and no vehicle_description', () => {
    const input = {
      job_number: 'JOB-999',
      lineItems: [],
    }
    const { payload } = dealService.mapFormToDb(input)
    expect(payload.title).toBe('Deal JOB-999')
  })

  it('uses empty string when nothing available (no title, no vehicle, no job number)', () => {
    const dbDeal = {
      id: 'id-2',
      title: 'Untitled Deal',
      vehicle: null,
      job_parts: [],
    }
    const form = dealService.mapDbDealToForm(dbDeal)
    // In this edge case we keep title as-is and vehicle_description remains ''
    expect(form.vehicle_description).toBe('')
  })
})
