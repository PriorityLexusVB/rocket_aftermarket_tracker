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
// src/tests/dateTimeUtils.test.js
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  toLocalDateTimeFields,
  fromLocalDateTimeFields,
  formatScheduleRange,
  formatTime,
  formatDate,
  validateScheduleRange,
} from '../utils/dateTimeUtils'

describe('dateTimeUtils', () => {
  describe('toLocalDateTimeFields', () => {
    it('should convert ISO timestamp to datetime-local format', () => {
      // Test with a known timestamp
      const iso = '2024-01-15T14:30:00.000Z'
      const result = toLocalDateTimeFields(iso)

      // Result should be in format YYYY-MM-DDTHH:MM
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    })

    it('should return empty string for null input', () => {
      expect(toLocalDateTimeFields(null)).toBe('')
      expect(toLocalDateTimeFields(undefined)).toBe('')
      expect(toLocalDateTimeFields('')).toBe('')
    })

    it('should handle invalid dates gracefully', () => {
      const result = toLocalDateTimeFields('invalid-date')
      expect(result).toBe('')
    })
  })

  describe('fromLocalDateTimeFields', () => {
    it('should convert datetime-local to ISO timestamp', () => {
      const localValue = '2024-01-15T09:30'
      const result = fromLocalDateTimeFields(localValue)

      // Result should be a valid ISO string
      expect(result).toBeTruthy()
      expect(typeof result).toBe('string')
      expect(new Date(result).toISOString()).toBe(result)
    })

    it('should return null for empty input', () => {
      expect(fromLocalDateTimeFields(null)).toBe(null)
      expect(fromLocalDateTimeFields(undefined)).toBe(null)
      expect(fromLocalDateTimeFields('')).toBe(null)
    })

    it('should return null for invalid format', () => {
      expect(fromLocalDateTimeFields('invalid')).toBe(null)
      expect(fromLocalDateTimeFields('2024-01-15')).toBe(null)
    })

    it('should handle complete datetime-local format', () => {
      const localValue = '2024-06-15T14:45'
      const result = fromLocalDateTimeFields(localValue)

      expect(result).toBeTruthy()
      expect(new Date(result)).toBeInstanceOf(Date)
    })
  })

  describe('formatScheduleRange', () => {
    beforeEach(() => {
      // Mock current date to a known value for consistent testing
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00Z'))
    })

    it('should format range with both start and end', () => {
      const start = '2024-01-20T14:00:00Z'
      const end = '2024-01-20T16:00:00Z'
      const result = formatScheduleRange(start, end)

      // Should include date and time range
      expect(result).toBeTruthy()
      expect(result).not.toBe('—')
    })

    it('should format range with only start time', () => {
      const start = '2024-01-20T14:00:00Z'
      const result = formatScheduleRange(start, null)

      // Should include date and time
      expect(result).toBeTruthy()
      expect(result).not.toBe('—')
    })

    it('should return dash for null start', () => {
      expect(formatScheduleRange(null, null)).toBe('—')

      // Should convert back to similar format (allowing for timezone conversion)
      expect(backToLocal).toBeTruthy()
      expect(backToLocal).toMatch(/2024-06-\d{2}T\d{2}:\d{2}/)
    })
  })
})
