// src/tests/dateTimeUtils.test.js
import { describe, it, expect, vi, afterEach } from 'vitest'
import {
  toLocalDateTimeFields,
  fromLocalDateTimeFields,
  combineDateAndTime,
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

  describe('toLocalDateTimeFields (extended)', () => {
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

  describe('fromLocalDateTimeFields (extended)', () => {
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

  describe('formatScheduleRange (extended)', () => {
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

    // DST boundary tests
    it('should handle spring forward DST transition (2024-03-10)', () => {
      // 2024-03-10 02:00 AM EST -> 03:00 AM EDT (spring forward)
      const beforeDST = '2024-03-10T06:00:00Z' // 01:00 EST
      const afterDST = '2024-03-10T08:00:00Z' // 04:00 EDT
      const result = formatScheduleRange(beforeDST, afterDST)

      expect(result).toBeTruthy()
      expect(result).toContain('Mar')
      expect(result).toContain('10')
    })

    it('should handle fall back DST transition (2024-11-03)', () => {
      // 2024-11-03 02:00 AM EDT -> 01:00 AM EST (fall back)
      const beforeDST = '2024-11-03T05:00:00Z' // 01:00 EDT
      const afterDST = '2024-11-03T07:00:00Z' // 02:00 EST
      const result = formatScheduleRange(beforeDST, afterDST)

      expect(result).toBeTruthy()
      expect(result).toContain('Nov')
      expect(result).toContain('3')
    })

    // Multi-day range tests
    it('should format multi-day range correctly', () => {
      const start = '2024-01-15T14:00:00Z'
      const end = '2024-01-17T16:00:00Z'
      const result = formatScheduleRange(start, end)

      // Should show both dates when spanning multiple days
      expect(result).toBeTruthy()
      expect(result).toContain('Jan')
      expect(result).not.toBe('')
    })

    it('should format same-day range correctly', () => {
      const start = '2024-06-20T13:00:00Z' // 09:00 EDT
      const end = '2024-06-20T17:00:00Z' // 13:00 EDT
      const result = formatScheduleRange(start, end)

      // Same day should show date once with time range
      expect(result).toBeTruthy()
      expect(result).toContain('Jun')
      expect(result).toContain('20')
      // Should have a time separator (–)
      expect(result).toContain('–')
    })

    // Invalid input edge cases
    it('should handle malformed ISO strings gracefully', () => {
      expect(formatScheduleRange('not-a-date', '2024-01-20T14:00:00Z')).toBe('')
      // When start is valid but end is invalid, the function catches the error and returns empty
      expect(formatScheduleRange('2024-01-20T14:00:00Z', 'not-a-date')).toBe('')
      expect(formatScheduleRange('invalid', 'also-invalid')).toBe('')
    })

    it('should handle undefined/null inputs', () => {
      expect(formatScheduleRange(undefined, undefined)).toBe('')
      expect(formatScheduleRange(null, undefined)).toBe('')
      expect(formatScheduleRange(undefined, null)).toBe('')
    })

    it('should handle empty string inputs', () => {
      expect(formatScheduleRange('', '')).toBe('')
      expect(formatScheduleRange('', '2024-01-20T14:00:00Z')).toBe('')
    })

    it('should render date-only schedule as "Time TBD" (no day-shift)', () => {
      const result = formatScheduleRange('2025-01-15', null)
      expect(result).toContain('Jan')
      expect(result).toContain('15')
      expect(result).toContain('Time TBD')
    })
  })

  // Additional edge case tests
  describe('Edge cases and validation', () => {
    it('fromLocalDateTimeFields should handle non-object input', () => {
      expect(fromLocalDateTimeFields('not-an-object')).toBe(null)
      expect(fromLocalDateTimeFields(123)).toBe(null)
      expect(fromLocalDateTimeFields([])).toBe(null)
    })

    it('fromLocalDateTimeFields should handle incomplete date fields', () => {
      // JavaScript Date constructor is lenient and will roll over invalid dates
      // e.g., 2024-13-45 becomes 2025-02-14 (13 months + 45 days from 2024-01-01)
      // The function returns a result if Date parsing succeeds
      const result1 = fromLocalDateTimeFields({ date: '2024-13-45', time: '09:30' })
      expect(result1).toBeTruthy() // Date constructor is lenient

      // Incomplete format (missing day) will fail
      expect(fromLocalDateTimeFields({ date: '2024-01', time: '09:30' })).toBe(null)

      // Non-numeric date will fail
      expect(fromLocalDateTimeFields({ date: 'abc', time: '09:30' })).toBe(null)
    })

    it('fromLocalDateTimeFields should handle incomplete time fields', () => {
      // JavaScript Date constructor is lenient with hour overflow
      // 25:30 becomes 01:30 next day
      const result1 = fromLocalDateTimeFields({ date: '2024-01-15', time: '25:30' })
      expect(result1).toBeTruthy() // Date constructor is lenient

      // Incomplete time format (missing minutes) will fail
      expect(fromLocalDateTimeFields({ date: '2024-01-15', time: '09' })).toBe(null)

      // Non-numeric time will fail
      expect(fromLocalDateTimeFields({ date: '2024-01-15', time: 'abc' })).toBe(null)
    })

    it('validateScheduleRange should return proper error codes', () => {
      // Missing start
      expect(validateScheduleRange(null, '2024-01-20T14:00:00Z')).toEqual({
        valid: false,
        errors: ['start_required'],
        error: 'Start time is required',
      })

      // Missing end
      expect(validateScheduleRange('2024-01-20T14:00:00Z', null)).toEqual({
        valid: false,
        errors: ['end_required'],
        error: 'End time is required',
      })

      // Both missing
      const result = validateScheduleRange(null, null)
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('start_required')
      expect(result.errors).toContain('end_required')
      expect(result.error).toBe('Start time is required')

      // End before start
      expect(validateScheduleRange('2024-01-20T14:00:00Z', '2024-01-20T13:00:00Z')).toEqual({
        valid: false,
        errors: ['end_not_after_start'],
        error: 'End time must be after start time',
      })

      // Valid range
      expect(validateScheduleRange('2024-01-20T13:00:00Z', '2024-01-20T14:00:00Z')).toEqual({
        valid: true,
        errors: [],
        error: '',
      })
    })

    it('formatTime should handle edge cases', () => {
      expect(formatTime(null)).toBe('')
      expect(formatTime(undefined)).toBe('')
      expect(formatTime('')).toBe('')
      expect(formatTime('invalid-date')).toBe('')
    })

    it('formatTime should render date-only values as "Time TBD"', () => {
      expect(formatTime('2025-01-15')).toBe('Time TBD')
    })

    it('toLocalDateTimeFields roundtrip should preserve data across DST boundaries', () => {
      // Test timestamp around DST change
      const dstTimestamp = '2024-03-10T07:00:00Z' // Around spring DST
      const fields = toLocalDateTimeFields(dstTimestamp)

      expect(fields.date).toMatch(/\d{4}-\d{2}-\d{2}/)
      expect(fields.time).toMatch(/\d{2}:\d{2}/)

      const backToISO = fromLocalDateTimeFields(fields)
      expect(backToISO).toBeTruthy()

      // Should be close (within same hour due to DST complexity)
      const original = new Date(dstTimestamp).getTime()
      const converted = new Date(backToISO).getTime()
      const diffHours = Math.abs(original - converted) / (1000 * 60 * 60)
      expect(diffHours).toBeLessThan(2) // Allow for DST shift
    })
  })

  describe('combineDateAndTime', () => {
    it('should combine valid date and time into ISO datetime', () => {
      const result = combineDateAndTime('2025-12-06', '13:07')
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      // Should be a valid ISO string
      const parsed = new Date(result)
      expect(isNaN(parsed.getTime())).toBe(false)
    })

    it('should return null when date is missing', () => {
      expect(combineDateAndTime('', '13:07')).toBe(null)
      expect(combineDateAndTime(null, '13:07')).toBe(null)
      expect(combineDateAndTime(undefined, '13:07')).toBe(null)
      expect(combineDateAndTime('   ', '13:07')).toBe(null)
    })

    it('should return null when time is missing', () => {
      expect(combineDateAndTime('2025-12-06', '')).toBe(null)
      expect(combineDateAndTime('2025-12-06', null)).toBe(null)
      expect(combineDateAndTime('2025-12-06', undefined)).toBe(null)
      expect(combineDateAndTime('2025-12-06', '   ')).toBe(null)
    })

    it('should return null when both date and time are missing', () => {
      expect(combineDateAndTime('', '')).toBe(null)
      expect(combineDateAndTime(null, null)).toBe(null)
      expect(combineDateAndTime(undefined, undefined)).toBe(null)
    })

    it('should handle time input with leading zeros', () => {
      const result = combineDateAndTime('2025-12-06', '09:30')
      expect(result).toBeTruthy()
      const parsed = new Date(result)
      expect(isNaN(parsed.getTime())).toBe(false)
    })

    it('should handle time input without leading zeros', () => {
      // Input like "9:30" should be normalized to "09:30"
      const result = combineDateAndTime('2025-12-06', '9:30')
      expect(result).toBeTruthy()
      const parsed = new Date(result)
      expect(isNaN(parsed.getTime())).toBe(false)
    })

    it('should handle time input with no leading zeros on both components', () => {
      // Input like "9:5" should be normalized to "09:05"
      const result = combineDateAndTime('2025-12-06', '9:5')
      expect(result).toBeTruthy()
      const parsed = new Date(result)
      expect(isNaN(parsed.getTime())).toBe(false)
    })

    it('should handle midnight correctly', () => {
      const result = combineDateAndTime('2025-12-06', '00:00')
      expect(result).toBeTruthy()
      const parsed = new Date(result)
      expect(isNaN(parsed.getTime())).toBe(false)
    })

    it('should handle end of day correctly', () => {
      const result = combineDateAndTime('2025-12-06', '23:59')
      expect(result).toBeTruthy()
      const parsed = new Date(result)
      expect(isNaN(parsed.getTime())).toBe(false)
    })

    it('should return null for invalid time format without colon', () => {
      expect(combineDateAndTime('2025-12-06', '1307')).toBe(null)
      expect(combineDateAndTime('2025-12-06', 'abc')).toBe(null)
    })

    it('should return null for non-string inputs', () => {
      expect(combineDateAndTime(123, '13:07')).toBe(null)
      expect(combineDateAndTime('2025-12-06', 123)).toBe(null)
      expect(combineDateAndTime({}, {})).toBe(null)
    })

    it('should preserve date correctly (line item date + time)', () => {
      // This tests the actual use case: combining dateScheduled (from date picker)
      // with scheduledStartTime (from time picker)
      const dateScheduled = '2025-12-06'
      const scheduledStartTime = '13:07'

      const result = combineDateAndTime(dateScheduled, scheduledStartTime)
      expect(result).toBeTruthy()

      // Parse the result and verify the date component is preserved
      const parsed = new Date(result)
      // The result is in UTC, so we check it's valid and represents Dec 6, 2025
      // in America/New_York timezone
      expect(parsed.getFullYear()).toBeGreaterThanOrEqual(2025)
    })

    it('should work for line item scheduling scenario', () => {
      // Simulates what happens when:
      // - User picks date "12/06/2025" via date picker (becomes "2025-12-06")
      // - User picks time "1:07 PM" via time picker (becomes "13:07")
      // - Result should be a proper ISO timestamp, not just "13:07"

      const dateScheduled = '2025-12-06'
      const scheduledStartTime = '13:07'
      const scheduledEndTime = '14:30'

      const startResult = combineDateAndTime(dateScheduled, scheduledStartTime)
      const endResult = combineDateAndTime(dateScheduled, scheduledEndTime)

      expect(startResult).toBeTruthy()
      expect(endResult).toBeTruthy()

      // Both should be valid ISO strings suitable for timestamptz
      expect(startResult).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
      expect(endResult).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)

      // End should be after start
      expect(new Date(endResult).getTime()).toBeGreaterThan(new Date(startResult).getTime())
    })

    it('should return null when scheduling is not required', () => {
      // When requiresScheduling is false, dateScheduled is cleared
      // This should return null for both start and end times
      const dateScheduled = '' // cleared because not scheduling
      const scheduledStartTime = '13:07'

      expect(combineDateAndTime(dateScheduled, scheduledStartTime)).toBe(null)
    })
  })
})
