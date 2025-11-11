import { describe, it, expect } from 'vitest'
import {
  getEventColors,
  getLaneColors,
  getColorLegend,
  getStatusLegend,
  generateEventId,
} from '../utils/calendarColors'

describe('calendarColors', () => {
  describe('getEventColors', () => {
    it('should return onsite colors for onsite service type', () => {
      const colors = getEventColors('onsite', 'scheduled')

      expect(colors.bg).toBe('bg-blue-100')
      expect(colors.text).toBe('text-blue-900')
      expect(colors.hex).toBe('#3B82F6')
    })

    it('should return vendor colors for vendor service type', () => {
      const colors = getEventColors('vendor', 'scheduled')

      expect(colors.bg).toBe('bg-purple-100')
      expect(colors.text).toBe('text-purple-900')
      expect(colors.hex).toBe('#A855F7')
    })

    it('should return vendor colors for offsite service type', () => {
      const colors = getEventColors('offsite', 'scheduled')

      expect(colors.bg).toBe('bg-purple-100')
      expect(colors.text).toBe('text-purple-900')
    })

    it('should default to onsite for undefined service type', () => {
      const colors = getEventColors(null, 'scheduled')

      expect(colors.bg).toBe('bg-blue-100')
    })

    it('should include status overlay for in_progress', () => {
      const colors = getEventColors('onsite', 'in_progress')

      expect(colors.pulse).toBe(true)
      expect(colors.badge).toBe('bg-orange-500 text-white')
    })

    it('should include combined className', () => {
      const colors = getEventColors('onsite', 'scheduled')

      expect(colors.className).toContain('bg-blue-100')
      expect(colors.className).toContain('text-blue-900')
      expect(colors.className).toContain('opacity-90')
    })
  })

  describe('getLaneColors', () => {
    it('should return onsite lane colors', () => {
      const colors = getLaneColors('onsite')

      expect(colors.bg).toBe('bg-blue-100')
      expect(colors.headerGradient).toBe('from-blue-500 to-blue-600')
    })

    it('should return vendor lane colors', () => {
      const colors = getLaneColors('vendor')

      expect(colors.bg).toBe('bg-purple-100')
      expect(colors.headerGradient).toBe('from-purple-500 to-purple-600')
    })
  })

  describe('getColorLegend', () => {
    it('should return array of legend items', () => {
      const legend = getColorLegend()

      expect(Array.isArray(legend)).toBe(true)
      expect(legend.length).toBeGreaterThan(0)
    })

    it('should include onsite and vendor items', () => {
      const legend = getColorLegend()

      expect(legend.some((item) => item.label === 'Onsite Service')).toBe(true)
      expect(legend.some((item) => item.label === 'Vendor/Offsite')).toBe(true)
    })

    it('should include icon names', () => {
      const legend = getColorLegend()

      expect(legend.every((item) => item.icon)).toBe(true)
    })
  })

  describe('getStatusLegend', () => {
    it('should return array of status items', () => {
      const legend = getStatusLegend()

      expect(Array.isArray(legend)).toBe(true)
      expect(legend.length).toBeGreaterThan(0)
    })

    it('should include common job statuses', () => {
      const legend = getStatusLegend()
      const labels = legend.map((item) => item.label)

      expect(labels).toContain('Scheduled')
      expect(labels).toContain('In Progress')
      expect(labels).toContain('Completed')
    })
  })

  describe('generateEventId', () => {
    it('should generate deterministic ID from job', () => {
      const job = {
        id: 123,
        scheduled_start_time: '2025-01-15T10:00:00Z',
      }

      const id1 = generateEventId(job)
      const id2 = generateEventId(job)

      expect(id1).toBe(id2)
      expect(id1).toContain('event-123')
    })

    it('should handle job without scheduled_start_time', () => {
      const job = {
        id: 456,
        created_at: '2025-01-15T10:00:00Z',
      }

      const id = generateEventId(job)

      expect(id).toContain('event-456')
    })

    it('should return fallback for invalid job', () => {
      const id = generateEventId(null)

      expect(id).toContain('event-')
    })

    it('should generate unique IDs for different jobs', () => {
      const job1 = { id: 1, scheduled_start_time: '2025-01-15T10:00:00Z' }
      const job2 = { id: 2, scheduled_start_time: '2025-01-15T10:00:00Z' }

      const id1 = generateEventId(job1)
      const id2 = generateEventId(job2)

      expect(id1).not.toBe(id2)
    })
  })
})
