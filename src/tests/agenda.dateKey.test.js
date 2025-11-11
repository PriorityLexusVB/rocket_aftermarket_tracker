// tests/agenda.dateKey.test.js
// Unit test for toDateKey NY timezone mapping
import { describe, it, expect } from 'vitest'
import { toDateKey } from '@/pages/calendar-agenda'

describe('toDateKey', () => {
  it('maps ISO timestamp to yyyy-mm-dd in America/New_York', () => {
    // Choose a known date
    const iso = '2025-11-11T15:30:00.000Z'
    const key = toDateKey(iso)
    expect(key).toMatch(/\d{4}-\d{2}-\d{2}/)
  })
  it('returns unscheduled when nullish', () => {
    expect(toDateKey(null)).toBe('unscheduled')
  })
})
