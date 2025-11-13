import { describe, it, expect } from 'vitest'
import {
  toLocalDateTimeFields,
  fromLocalDateTimeFields,
  formatScheduleRange,
  validateScheduleRange,
  formatTime,
} from '@/utils/dateTimeUtils'

describe('dateTimeUtils', () => {
  it('toLocalDateTimeFields returns empty on invalid', () => {
    expect(toLocalDateTimeFields('not-a-date')).toEqual({ date: '', time: '' })
  })

  it('roundtrip local fields conversion', () => {
    const iso = '2025-11-13T15:30:00.000Z'
    const fields = toLocalDateTimeFields(iso)
    expect(fields.date).toMatch(/\d{4}-\d{2}-\d{2}/)
    expect(fields.time).toMatch(/\d{2}:\d{2}/)
    const back = fromLocalDateTimeFields(fields)
    expect(typeof back).toBe('string')
  })

  it('formatScheduleRange same-day', () => {
    const out = formatScheduleRange('2025-11-13T09:00:00Z', '2025-11-13T10:00:00Z')
    expect(out).toMatch(/Nov|Nov/) // month abbreviation
  })

  it('validateScheduleRange detects end before start', () => {
    const v = validateScheduleRange('2025-11-13T10:00:00Z', '2025-11-13T09:00:00Z')
    expect(v.valid).toBe(false)
  })

  it('formatTime returns empty for invalid', () => {
    expect(formatTime('bad')).toBe('')
  })
})
// src/tests/dateTimeUtils.test.js (extended tests)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  toLocalDateTimeFields,
  fromLocalDateTimeFields,
  formatScheduleRange,
  formatTime,
  validateScheduleRange,
} from '../utils/dateTimeUtils'

describe('dateTimeUtils (extended)', () => {
  describe('toLocalDateTimeFields', () => {
    it('should convert ISO timestamp to date/time object', () => {
      // Test with a known timestamp
      const iso = '2024-01-15T14:30:00.000Z'
      const result = toLocalDateTimeFields(iso)

      // Result should be an object with date and time fields
      expect(result).toHaveProperty('date')
      expect(result).toHaveProperty('time')
      expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(result.time).toMatch(/^\d{2}:\d{2}$/)
    })

    it('should return empty fields for null input', () => {
      expect(toLocalDateTimeFields(null)).toEqual({ date: '', time: '' })
      expect(toLocalDateTimeFields(undefined)).toEqual({ date: '', time: '' })
      expect(toLocalDateTimeFields('')).toEqual({ date: '', time: '' })
    })

    it('should handle invalid dates gracefully', () => {
      const result = toLocalDateTimeFields('invalid-date')
      expect(result).toEqual({ date: '', time: '' })
    })
  })

  describe('fromLocalDateTimeFields', () => {
    it('should convert date/time fields to ISO timestamp', () => {
      const fields = { date: '2024-01-15', time: '09:30' }
      const result = fromLocalDateTimeFields(fields)

      // Result should be a valid ISO string
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      const parsed = new Date(result)
      expect(parsed).toBeInstanceOf(Date)
      expect(isNaN(parsed.getTime())).toBe(false)
    })

    it('should return null for null/undefined input', () => {
      expect(fromLocalDateTimeFields(null)).toBe(null)
      expect(fromLocalDateTimeFields(undefined)).toBe(null)
    })

    it('should return null for empty fields', () => {
      expect(fromLocalDateTimeFields({ date: '', time: '' })).toBe(null)
      expect(fromLocalDateTimeFields({ date: '2024-01-15', time: '' })).toBe(null)
      expect(fromLocalDateTimeFields({ date: '', time: '09:30' })).toBe(null)
    })

    it('should handle complete date/time fields', () => {
      const fields = { date: '2024-06-15', time: '14:45' }
      const result = fromLocalDateTimeFields(fields)

      expect(result).toBeTruthy()
      expect(new Date(result)).toBeInstanceOf(Date)
    })
  })

  describe('formatScheduleRange', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('should format range with both start and end', () => {
      const start = '2024-01-20T14:00:00Z'
      const end = '2024-01-20T16:00:00Z'
      const result = formatScheduleRange(start, end)

      // Should include date and time range
      expect(result).toBeTruthy()
      expect(result).not.toBe('')
    })

    it('should format range with only start time', () => {
      const start = '2024-01-20T14:00:00Z'
      const result = formatScheduleRange(start, null)

      // Should include date and time
      expect(result).toBeTruthy()
      expect(result).not.toBe('')
    })

    it('should return empty string for null start', () => {
      expect(formatScheduleRange(null, null)).toBe('')
    })
  })
})
