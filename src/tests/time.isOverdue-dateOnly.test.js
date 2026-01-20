import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { isOverdue } from '@/lib/time'

describe('time.isOverdue (date-only)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    // Jan = standard time (ET = UTC-5); pick a stable midday ET reference.
    vi.setSystemTime(new Date('2026-01-20T17:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not mark today as overdue for YYYY-MM-DD', () => {
    expect(isOverdue('2026-01-20')).toBe(false)
  })

  it('marks yesterday as overdue for YYYY-MM-DD', () => {
    expect(isOverdue('2026-01-19')).toBe(true)
  })

  it('does not mark today as overdue for midnight ISO variants', () => {
    expect(isOverdue('2026-01-20T00:00:00Z')).toBe(false)
    expect(isOverdue('2026-01-20T00:00:00.000Z')).toBe(false)
  })
})
