import { describe, it, expect } from 'vitest'
import { formatWindow, formatDate } from '@/utils/timeWindow'

describe('timeWindow utilities', () => {
  describe('formatWindow', () => {
    it('shows single time when start and end are the same', () => {
      const start = '2025-01-15T14:30:00Z'
      const end = '2025-01-15T14:30:00Z'
      const result = formatWindow(start, end)
      
      // Should show one time, not a range
      expect(result).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/)
      expect(result).not.toContain('–')
    })

    it('shows range when start and end are different', () => {
      const start = '2025-01-15T14:00:00Z'
      const end = '2025-01-15T16:00:00Z'
      const result = formatWindow(start, end)
      
      // Should show range with en-dash
      expect(result).toContain('–')
      expect(result).toMatch(/\d{1,2}:\d{2}\s[AP]M\s–\s\d{1,2}:\d{2}\s[AP]M/)
    })

    it('shows single time when only start is provided', () => {
      const start = '2025-01-15T14:30:00Z'
      const result = formatWindow(start, null)
      
      expect(result).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/)
      expect(result).not.toContain('–')
    })

    it('shows single time when only end is provided', () => {
      const end = '2025-01-15T16:30:00Z'
      const result = formatWindow(null, end)
      
      expect(result).toMatch(/^\d{1,2}:\d{2}\s[AP]M$/)
      expect(result).not.toContain('–')
    })

    it('returns empty string when neither start nor end is provided', () => {
      const result = formatWindow(null, null)
      expect(result).toBe('')
    })

    it('handles invalid date strings gracefully', () => {
      const result = formatWindow('invalid-date', 'also-invalid')
      expect(result).toBe('')
    })

    it('formats times in 12-hour format with AM/PM', () => {
      const start = '2025-01-15T09:00:00Z'
      const end = '2025-01-15T17:00:00Z'
      const result = formatWindow(start, end)
      
      // Both times should be formatted
      expect(result).toMatch(/[AP]M/)
    })
  })

  describe('formatDate', () => {
    it('formats date in short month and day format', () => {
      const date = '2025-01-15'
      const result = formatDate(date)
      
      expect(result).toMatch(/^[A-Z][a-z]{2}\s\d{1,2}$/)
    })

    it('returns empty string for null or undefined', () => {
      expect(formatDate(null)).toBe('')
      expect(formatDate(undefined)).toBe('')
      expect(formatDate('')).toBe('')
    })

    it('handles invalid date strings gracefully', () => {
      const result = formatDate('not-a-date')
      expect(result).toBe('')
    })

    it('formats ISO date-time strings correctly', () => {
      const date = '2025-03-20T10:00:00Z'
      const result = formatDate(date)
      
      expect(result).toMatch(/^[A-Z][a-z]{2}\s\d{1,2}$/)
    })
  })
})
