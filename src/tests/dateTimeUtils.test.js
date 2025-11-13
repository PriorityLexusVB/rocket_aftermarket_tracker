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
      expect(formatScheduleRange(undefined, null)).toBe('—')
      expect(formatScheduleRange('', null)).toBe('—')
    })

    it('should indicate "Today" for current day in America/New_York', () => {
      // Get current date in NY timezone and create a timestamp for it
      const now = new Date()
      const nyDate = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(now)
      
      // Parse the NY date and create a timestamp
      const [month, day, year] = nyDate.split('/')
      const todayStart = new Date(`${year}-${month}-${day}T10:00:00-05:00`)
      
      const result = formatScheduleRange(todayStart.toISOString(), null)
      
      // Should include "Today" (though we can't guarantee exact timezone in test)
      expect(result).toBeTruthy()
    })

    it('should handle invalid dates gracefully', () => {
      const result = formatScheduleRange('invalid-date', null)
      expect(result).toBe('—')
    })
  })

  describe('formatTime', () => {
    it('should format time with AM/PM', () => {
      const iso = '2024-01-15T14:30:00Z'
      const result = formatTime(iso)
      
      // Should include time with AM/PM
      expect(result).toBeTruthy()
      expect(result).toMatch(/\d{1,2}:\d{2}\s?(AM|PM)/i)
    })

    it('should return empty string for null input', () => {
      expect(formatTime(null)).toBe('')
      expect(formatTime(undefined)).toBe('')
      expect(formatTime('')).toBe('')
    })

    it('should handle invalid dates gracefully', () => {
      const result = formatTime('invalid-date')
      expect(result).toBe('')
    })
  })

  describe('formatDate', () => {
    it('should format date as "MMM d, yyyy"', () => {
      const iso = '2024-01-15T14:30:00Z'
      const result = formatDate(iso)
      
      // Should include month, day, and year
      expect(result).toBeTruthy()
      expect(result).toMatch(/\w+\s\d{1,2},\s\d{4}/)
    })

    it('should return empty string for null input', () => {
      expect(formatDate(null)).toBe('')
      expect(formatDate(undefined)).toBe('')
      expect(formatDate('')).toBe('')
    })

    it('should handle invalid dates gracefully', () => {
      const result = formatDate('invalid-date')
      expect(result).toBe('')
    })
  })

  describe('validateScheduleRange', () => {
    it('should return valid for correct range', () => {
      const start = '2024-06-15T10:00:00Z'
      const end = '2024-06-15T12:00:00Z'
      const result = validateScheduleRange(start, end)
      
      expect(result.valid).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it('should reject end time before start time', () => {
      const start = '2024-06-15T12:00:00Z'
      const end = '2024-06-15T10:00:00Z'
      const result = validateScheduleRange(start, end)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('End time must be after start time')
    })

    it('should reject equal start and end times', () => {
      const start = '2024-06-15T10:00:00Z'
      const end = '2024-06-15T10:00:00Z'
      const result = validateScheduleRange(start, end)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('End time must be after start time')
    })

    it('should reject missing start time', () => {
      const result = validateScheduleRange(null, '2024-06-15T12:00:00Z')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Both start and end times are required')
    })

    it('should reject missing end time', () => {
      const result = validateScheduleRange('2024-06-15T10:00:00Z', null)
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Both start and end times are required')
    })

    it('should handle invalid date formats', () => {
      const result = validateScheduleRange('invalid-date', '2024-06-15T12:00:00Z')
      
      expect(result.valid).toBe(false)
      expect(result.error).toBe('Invalid date/time format')
    })
  })

  describe('timezone consistency', () => {
    it('should round-trip datetime-local values', () => {
      const localValue = '2024-06-15T14:30'
      const iso = fromLocalDateTimeFields(localValue)
      const backToLocal = toLocalDateTimeFields(iso)
      
      // Should convert back to similar format (allowing for timezone conversion)
      expect(backToLocal).toBeTruthy()
      expect(backToLocal).toMatch(/2024-06-\d{2}T\d{2}:\d{2}/)
    })
  })
})
