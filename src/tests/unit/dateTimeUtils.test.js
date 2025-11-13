// src/tests/unit/dateTimeUtils.test.js
import { describe, it, expect } from 'vitest'
import {
  toLocalDateTimeFields,
  fromLocalDateTimeFields,
  formatScheduleRange,
  validateScheduleRange,
} from '../../utils/dateTimeUtils'

describe('dateTimeUtils', () => {
  describe('toLocalDateTimeFields', () => {
    it('should convert UTC ISO string to local datetime-local format', () => {
      const result = toLocalDateTimeFields('2024-01-15T14:30:00Z')
      // Result depends on timezone, but should be in YYYY-MM-DDTHH:mm format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
    })

    it('should return empty string for null input', () => {
      expect(toLocalDateTimeFields(null)).toBe('')
      expect(toLocalDateTimeFields('')).toBe('')
      expect(toLocalDateTimeFields(undefined)).toBe('')
    })

    it('should handle invalid ISO strings gracefully', () => {
      expect(toLocalDateTimeFields('invalid-date')).toBe('')
    })
  })

  describe('fromLocalDateTimeFields', () => {
    it('should convert local datetime to UTC ISO string', () => {
      const result = fromLocalDateTimeFields('2024-01-15T14:30')
      expect(result).toBeTruthy()
      expect(result).toContain('2024-01-15')
    })

    it('should return null for empty input', () => {
      expect(fromLocalDateTimeFields(null)).toBe(null)
      expect(fromLocalDateTimeFields('')).toBe(null)
      expect(fromLocalDateTimeFields(undefined)).toBe(null)
    })

    it('should handle invalid datetime strings', () => {
      expect(fromLocalDateTimeFields('invalid')).toBe(null)
    })
  })

  describe('formatScheduleRange', () => {
    it('should format single time without date', () => {
      const result = formatScheduleRange('2024-01-15T14:30:00Z', null)
      expect(result).toMatch(/\d{1,2}:\d{2} [AP]M/)
    })

    it('should format time range without date', () => {
      const result = formatScheduleRange('2024-01-15T14:30:00Z', '2024-01-15T16:30:00Z')
      expect(result).toMatch(/\d{1,2}:\d{2} [AP]M–\d{1,2}:\d{2} [AP]M/)
    })

    it('should format with date when includeDate is true', () => {
      const result = formatScheduleRange('2024-01-15T14:30:00Z', '2024-01-15T16:30:00Z', {
        includeDate: true,
      })
      expect(result).toContain('Jan 15')
      expect(result).toContain('•')
    })

    it('should return em dash for null start time', () => {
      expect(formatScheduleRange(null, null)).toBe('—')
      expect(formatScheduleRange('', '')).toBe('—')
    })

    it('should handle same start and end times', () => {
      const same = '2024-01-15T14:30:00Z'
      const result = formatScheduleRange(same, same)
      // Should not duplicate the time
      expect(result).not.toContain('–')
    })

    it('should handle invalid ISO strings', () => {
      expect(formatScheduleRange('invalid', 'invalid')).toBe('—')
    })
  })

  describe('validateScheduleRange', () => {
    it('should return true when end is after start', () => {
      const start = '2024-01-15T14:00:00Z'
      const end = '2024-01-15T16:00:00Z'
      expect(validateScheduleRange(start, end)).toBe(true)
    })

    it('should return false when end is before start', () => {
      const start = '2024-01-15T16:00:00Z'
      const end = '2024-01-15T14:00:00Z'
      expect(validateScheduleRange(start, end)).toBe(false)
    })

    it('should return false when times are equal', () => {
      const same = '2024-01-15T14:00:00Z'
      expect(validateScheduleRange(same, same)).toBe(false)
    })

    it('should return true for empty inputs', () => {
      expect(validateScheduleRange(null, null)).toBe(true)
      expect(validateScheduleRange('', '')).toBe(true)
      expect(validateScheduleRange(null, '2024-01-15T14:00:00Z')).toBe(true)
    })

    it('should handle invalid ISO strings', () => {
      expect(validateScheduleRange('invalid', 'invalid')).toBe(false)
    })
  })
})
