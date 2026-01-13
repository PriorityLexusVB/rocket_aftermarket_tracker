// Test date/time input helpers for HTML input elements
import { describe, test, expect } from 'vitest'
import { toDateInputValue, toTimeInputValue } from '../utils/dateTimeUtils'

describe('toDateInputValue', () => {
  test('converts ISO datetime to YYYY-MM-DD format', () => {
    const result = toDateInputValue('2025-12-12T18:35:00+00:00')
    expect(result).toBe('2025-12-12')
  })

  test('converts ISO datetime with Z timezone to YYYY-MM-DD format', () => {
    const result = toDateInputValue('2025-12-12T13:07:00Z')
    expect(result).toBe('2025-12-12')
  })

  test('handles already formatted YYYY-MM-DD dates (date-only; no timezone day-shift)', () => {
    // Date-only values should remain stable when displayed in ET.
    // This prevents UI regressions where saving 2026-01-14 shows 2026-01-13 on reload.
    const result = toDateInputValue('2025-12-12')
    expect(result).toBe('2025-12-12')
  })

  test('returns empty string for null input', () => {
    const result = toDateInputValue(null)
    expect(result).toBe('')
  })

  test('returns empty string for undefined input', () => {
    const result = toDateInputValue(undefined)
    expect(result).toBe('')
  })

  test('returns empty string for empty string input', () => {
    const result = toDateInputValue('')
    expect(result).toBe('')
  })

  test('returns empty string for invalid date', () => {
    const result = toDateInputValue('invalid-date')
    expect(result).toBe('')
  })

  test('converts Date object to YYYY-MM-DD format', () => {
    const date = new Date('2025-12-12T18:35:00Z')
    const result = toDateInputValue(date)
    expect(result).toBe('2025-12-12')
  })

  test('treats midnight ISO variants as date-only', () => {
    const result = toDateInputValue('2025-12-12T00:00:00Z')
    expect(result).toBe('2025-12-12')
  })
})

describe('toTimeInputValue', () => {
  test('converts ISO datetime to HH:mm format in Eastern timezone', () => {
    // 18:35 UTC is 13:35 ET when EST (UTC-5)
    const result = toTimeInputValue('2025-12-12T18:35:00+00:00')
    // Result will be in ET, which is -5 hours from UTC in winter
    expect(result).toMatch(/^\d{2}:\d{2}$/)
    expect(result).toBe('13:35')
  })

  test('converts ISO datetime with Z timezone to HH:mm format', () => {
    // 13:07 UTC is 08:07 ET when EST (UTC-5)
    const result = toTimeInputValue('2025-12-12T13:07:00Z')
    expect(result).toMatch(/^\d{2}:\d{2}$/)
    expect(result).toBe('08:07')
  })

  test('returns empty string for null input', () => {
    const result = toTimeInputValue(null)
    expect(result).toBe('')
  })

  test('returns empty string for undefined input', () => {
    const result = toTimeInputValue(undefined)
    expect(result).toBe('')
  })

  test('returns empty string for empty string input', () => {
    const result = toTimeInputValue('')
    expect(result).toBe('')
  })

  test('returns empty string for invalid date', () => {
    const result = toTimeInputValue('invalid-date')
    expect(result).toBe('')
  })

  test('converts Date object to HH:mm format', () => {
    const date = new Date('2025-12-12T18:35:00Z')
    const result = toTimeInputValue(date)
    expect(result).toMatch(/^\d{2}:\d{2}$/)
    expect(result).toBe('13:35')
  })

  test('pads single-digit hours with leading zero', () => {
    // 09:30 UTC is 04:30 ET when EST (UTC-5)
    const result = toTimeInputValue('2025-12-12T09:30:00Z')
    expect(result).toBe('04:30')
  })
})

describe('Integration: date and time input values', () => {
  test('split ISO datetime into separate date and time inputs', () => {
    const iso = '2025-12-12T18:35:00+00:00'
    const date = toDateInputValue(iso)
    const time = toTimeInputValue(iso)

    expect(date).toBe('2025-12-12')
    expect(time).toBe('13:35')
  })

  test('handles midnight UTC correctly', () => {
    const iso = '2025-12-12T00:00:00Z'
    const date = toDateInputValue(iso)
    const time = toTimeInputValue(iso)

    // Midnight ISO variants are treated as date-only to avoid day-shift.
    expect(date).toBe('2025-12-12')
    expect(time).toBe('')
  })

  test('handles end of day UTC correctly', () => {
    const iso = '2025-12-12T23:59:00Z'
    const date = toDateInputValue(iso)
    const time = toTimeInputValue(iso)

    expect(date).toBe('2025-12-12')
    expect(time).toBe('18:59') // ET
  })
})
