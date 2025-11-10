// src/tests/ui/promiseDate.display.test.jsx
import { describe, it, expect } from 'vitest'
import { formatPromiseDate, formatTimeWindow } from '@/utils/dateDisplay'

describe('Promise Date Display - UI Safety', () => {
  describe('formatPromiseDate', () => {
    it('should display "No promise date" for null', () => {
      expect(formatPromiseDate(null)).toBe('No promise date')
    })

    it('should display "No promise date" for undefined', () => {
      expect(formatPromiseDate(undefined)).toBe('No promise date')
    })

    it('should display "No promise date" for empty string', () => {
      expect(formatPromiseDate('')).toBe('No promise date')
    })

    it('should display "No promise date" for invalid date string', () => {
      expect(formatPromiseDate('invalid-date')).toBe('No promise date')
    })

    it('should NOT display "Invalid Date" for any input', () => {
      const testCases = [null, undefined, '', 'invalid', '2025-13-45', 'abc123']

      testCases.forEach((testCase) => {
        const result = formatPromiseDate(testCase)
        expect(result).not.toContain('Invalid Date')
        expect(result).not.toContain('Invalid')
      })
    })

    it('should format valid date string (YYYY-MM-DD)', () => {
      const result = formatPromiseDate('2025-01-15')
      expect(result).toMatch(/Jan 15, 2025/)
    })

    it('should format valid ISO datetime string', () => {
      const result = formatPromiseDate('2025-01-15T10:00:00')
      expect(result).toMatch(/Jan 15, 2025/)
    })

    it('should handle date with timezone', () => {
      const result = formatPromiseDate('2025-01-15T10:00:00Z')
      // Should still format successfully
      expect(result).not.toBe('No promise date')
      expect(result).not.toContain('Invalid')
    })
  })

  describe('formatTimeWindow', () => {
    it('should display "Not scheduled" when start is null', () => {
      expect(formatTimeWindow(null, '2025-01-15T10:00:00')).toBe('Not scheduled')
    })

    it('should display "Not scheduled" when end is null', () => {
      expect(formatTimeWindow('2025-01-15T09:00:00', null)).toBe('Not scheduled')
    })

    it('should display "Not scheduled" when both are null', () => {
      expect(formatTimeWindow(null, null)).toBe('Not scheduled')
    })

    it('should display "Not scheduled" when both are empty strings', () => {
      expect(formatTimeWindow('', '')).toBe('Not scheduled')
    })

    it('should display "Not scheduled" when start is invalid', () => {
      expect(formatTimeWindow('invalid', '2025-01-15T10:00:00')).toBe('Not scheduled')
    })

    it('should display "Not scheduled" when end is invalid', () => {
      expect(formatTimeWindow('2025-01-15T09:00:00', 'invalid')).toBe('Not scheduled')
    })

    it('should format valid time window', () => {
      const result = formatTimeWindow('2025-01-15T09:00:00', '2025-01-15T10:30:00')
      // Should contain time range (exact format may vary by locale)
      expect(result).not.toBe('Not scheduled')
      expect(result).toContain('-')
    })

    it('should NOT display "Invalid Date" for any input', () => {
      const testCases = [
        [null, null],
        ['', ''],
        ['invalid', 'invalid'],
        ['2025-13-45T99:99:99', '2025-13-45T99:99:99'],
      ]

      testCases.forEach(([start, end]) => {
        const result = formatTimeWindow(start, end)
        expect(result).not.toContain('Invalid Date')
        expect(result).not.toContain('Invalid')
      })
    })
  })

  describe('UI Integration Patterns', () => {
    it('should safely display promise date in card/list views', () => {
      // Simulate what UI components would do
      const lineItems = [
        { promised_date: null },
        { promised_date: '' },
        { promised_date: '2025-01-15' },
        { promised_date: 'invalid' },
      ]

      const displayValues = lineItems.map((item) => formatPromiseDate(item.promised_date))

      expect(displayValues[0]).toBe('No promise date')
      expect(displayValues[1]).toBe('No promise date')
      expect(displayValues[2]).toMatch(/Jan 15, 2025/)
      expect(displayValues[3]).toBe('No promise date')

      // Ensure no "Invalid Date" in any output
      displayValues.forEach((val) => {
        expect(val).not.toContain('Invalid')
      })
    })

    it('should safely display scheduled window in calendar/appointment views', () => {
      // Simulate calendar/appointment display
      const appointments = [
        { scheduled_start_time: null, scheduled_end_time: null },
        { scheduled_start_time: '', scheduled_end_time: '' },
        { scheduled_start_time: '2025-01-15T09:00:00', scheduled_end_time: '2025-01-15T10:00:00' },
        { scheduled_start_time: 'invalid', scheduled_end_time: 'invalid' },
      ]

      const displayValues = appointments.map((appt) =>
        formatTimeWindow(appt.scheduled_start_time, appt.scheduled_end_time)
      )

      expect(displayValues[0]).toBe('Not scheduled')
      expect(displayValues[1]).toBe('Not scheduled')
      expect(displayValues[2]).not.toBe('Not scheduled')
      expect(displayValues[3]).toBe('Not scheduled')

      // Ensure no "Invalid Date" in any output
      displayValues.forEach((val) => {
        expect(val).not.toContain('Invalid')
      })
    })

    it('should handle mixed valid/invalid dates in a deal', () => {
      const deal = {
        scheduled_start_time: '2025-01-15T09:00:00',
        scheduled_end_time: '',
        lineItems: [
          { promised_date: '2025-01-14' },
          { promised_date: '' },
          { promised_date: null },
        ],
      }

      const jobWindow = formatTimeWindow(deal.scheduled_start_time, deal.scheduled_end_time)
      const linePromises = deal.lineItems.map((item) => formatPromiseDate(item.promised_date))

      expect(jobWindow).toBe('Not scheduled') // end time is missing
      expect(linePromises[0]).toMatch(/Jan 14, 2025/)
      expect(linePromises[1]).toBe('No promise date')
      expect(linePromises[2]).toBe('No promise date')

      // No "Invalid Date" anywhere
      expect(jobWindow).not.toContain('Invalid')
      linePromises.forEach((p) => expect(p).not.toContain('Invalid'))
    })
  })

  describe('Edge Cases', () => {
    it('should handle whitespace-only strings', () => {
      expect(formatPromiseDate('   ')).toBe('No promise date')
      expect(formatTimeWindow('   ', '   ')).toBe('Not scheduled')
    })

    it('should handle very old dates', () => {
      const result = formatPromiseDate('1900-01-01')
      expect(result).not.toContain('Invalid')
      expect(result).toMatch(/Jan 1, 1900/)
    })

    it('should handle far future dates', () => {
      const result = formatPromiseDate('2099-12-31')
      expect(result).not.toContain('Invalid')
      expect(result).toMatch(/Dec 31, 2099/)
    })

    it('should handle dates with milliseconds', () => {
      const result = formatPromiseDate('2025-01-15T10:30:45.123Z')
      expect(result).not.toContain('Invalid')
      expect(result).toMatch(/Jan 15, 2025/)
    })
  })
})
