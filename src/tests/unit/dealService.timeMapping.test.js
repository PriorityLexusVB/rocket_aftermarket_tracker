// src/tests/unit/dealService.timeMapping.test.js
import { describe, it, expect } from 'vitest'
import { normalizeDealTimes, mapDbDealToForm } from '@/services/dealService'

describe('dealService - time/date normalization', () => {
  describe('normalizeDealTimes', () => {
    it('should return null if dbDeal is null', () => {
      expect(normalizeDealTimes(null)).toBeNull()
    })

    it('should return null if dbDeal is undefined', () => {
      expect(normalizeDealTimes(undefined)).toBeNull()
    })

    it('should convert empty string scheduled_start_time to null', () => {
      const deal = {
        id: '123',
        scheduled_start_time: '',
        scheduled_end_time: '2025-01-15T10:00:00',
      }

      const result = normalizeDealTimes(deal)

      expect(result.scheduled_start_time).toBeNull()
      expect(result.scheduled_end_time).toBe('2025-01-15T10:00:00')
    })

    it('should convert empty string scheduled_end_time to null', () => {
      const deal = {
        id: '123',
        scheduled_start_time: '2025-01-15T09:00:00',
        scheduled_end_time: '',
      }

      const result = normalizeDealTimes(deal)

      expect(result.scheduled_start_time).toBe('2025-01-15T09:00:00')
      expect(result.scheduled_end_time).toBeNull()
    })

    it('should preserve explicitly set scheduled times', () => {
      const deal = {
        id: '123',
        scheduled_start_time: '2025-01-15T09:00:00',
        scheduled_end_time: '2025-01-15T10:00:00',
      }

      const result = normalizeDealTimes(deal)

      expect(result.scheduled_start_time).toBe('2025-01-15T09:00:00')
      expect(result.scheduled_end_time).toBe('2025-01-15T10:00:00')
    })

    it('should clear promised_date for non-scheduling line items when empty string', () => {
      const deal = {
        id: '123',
        job_parts: [
          {
            id: '1',
            requires_scheduling: false,
            promised_date: '',
          },
        ],
      }

      const result = normalizeDealTimes(deal)

      expect(result.job_parts[0].promised_date).toBeNull()
    })

    it('should preserve promised_date for scheduling line items even if empty string becomes null', () => {
      const deal = {
        id: '123',
        job_parts: [
          {
            id: '1',
            requires_scheduling: true,
            promised_date: '',
          },
        ],
      }

      const result = normalizeDealTimes(deal)

      // Empty string becomes null even for requires_scheduling=true
      // This prevents "Invalid Date" in UI
      expect(result.job_parts[0].promised_date).toBeNull()
    })

    it('should preserve valid promised_date for scheduling line items', () => {
      const deal = {
        id: '123',
        job_parts: [
          {
            id: '1',
            requires_scheduling: true,
            promised_date: '2025-01-15',
          },
        ],
      }

      const result = normalizeDealTimes(deal)

      expect(result.job_parts[0].promised_date).toBe('2025-01-15')
    })

    it('should normalize per-line scheduled_start_time empty strings to null', () => {
      const deal = {
        id: '123',
        job_parts: [
          {
            id: '1',
            scheduled_start_time: '',
            scheduled_end_time: '2025-01-15T10:00:00',
          },
        ],
      }

      const result = normalizeDealTimes(deal)

      expect(result.job_parts[0].scheduled_start_time).toBeNull()
      expect(result.job_parts[0].scheduled_end_time).toBe('2025-01-15T10:00:00')
    })

    it('should normalize per-line scheduled_end_time empty strings to null', () => {
      const deal = {
        id: '123',
        job_parts: [
          {
            id: '1',
            scheduled_start_time: '2025-01-15T09:00:00',
            scheduled_end_time: '',
          },
        ],
      }

      const result = normalizeDealTimes(deal)

      expect(result.job_parts[0].scheduled_start_time).toBe('2025-01-15T09:00:00')
      expect(result.job_parts[0].scheduled_end_time).toBeNull()
    })

    it('should handle multiple line items with mixed states', () => {
      const deal = {
        id: '123',
        job_parts: [
          {
            id: '1',
            requires_scheduling: true,
            promised_date: '2025-01-15',
            scheduled_start_time: '2025-01-15T09:00:00',
            scheduled_end_time: '',
          },
          {
            id: '2',
            requires_scheduling: false,
            promised_date: '',
            scheduled_start_time: '',
            scheduled_end_time: '',
          },
          {
            id: '3',
            requires_scheduling: true,
            promised_date: '',
            scheduled_start_time: '',
            scheduled_end_time: '2025-01-16T15:00:00',
          },
        ],
      }

      const result = normalizeDealTimes(deal)

      // First line item
      expect(result.job_parts[0].promised_date).toBe('2025-01-15')
      expect(result.job_parts[0].scheduled_start_time).toBe('2025-01-15T09:00:00')
      expect(result.job_parts[0].scheduled_end_time).toBeNull()

      // Second line item
      expect(result.job_parts[1].promised_date).toBeNull()
      expect(result.job_parts[1].scheduled_start_time).toBeNull()
      expect(result.job_parts[1].scheduled_end_time).toBeNull()

      // Third line item
      expect(result.job_parts[2].promised_date).toBeNull()
      expect(result.job_parts[2].scheduled_start_time).toBeNull()
      expect(result.job_parts[2].scheduled_end_time).toBe('2025-01-16T15:00:00')
    })

    it('should handle deals without job_parts', () => {
      const deal = {
        id: '123',
        scheduled_start_time: '',
        scheduled_end_time: '',
      }

      const result = normalizeDealTimes(deal)

      expect(result.scheduled_start_time).toBeNull()
      expect(result.scheduled_end_time).toBeNull()
      expect(result.job_parts).toBeUndefined()
    })

    it('should handle empty job_parts array', () => {
      const deal = {
        id: '123',
        job_parts: [],
      }

      const result = normalizeDealTimes(deal)

      expect(result.job_parts).toEqual([])
    })

    it('should not mutate original deal object', () => {
      const deal = {
        id: '123',
        scheduled_start_time: '',
        job_parts: [
          {
            id: '1',
            promised_date: '',
          },
        ],
      }

      const originalDeal = JSON.parse(JSON.stringify(deal))
      normalizeDealTimes(deal)

      expect(deal).toEqual(originalDeal)
    })
  })

  describe('mapDbDealToForm with normalizeDealTimes integration', () => {
    it('should apply normalizeDealTimes before mapping', () => {
      const dbDeal = {
        id: '123',
        job_number: 'JOB-001',
        title: '2020 Honda Accord',
        scheduled_start_time: '',
        scheduled_end_time: '',
        job_parts: [
          {
            id: '1',
            product_id: 'prod-1',
            requires_scheduling: false,
            promised_date: '',
            scheduled_start_time: '',
            scheduled_end_time: '',
          },
        ],
      }

      const result = mapDbDealToForm(dbDeal)

      // Job-level times should be empty string (form default), but normalized internally
      expect(result.scheduled_start_time).toBe('')
      expect(result.scheduled_end_time).toBe('')

      // Line item should have normalized times
      expect(result.lineItems[0].promised_date).toBe('')
      expect(result.lineItems[0].scheduled_start_time).toBe('')
      expect(result.lineItems[0].scheduled_end_time).toBe('')
    })

    it('should preserve valid scheduled times', () => {
      const dbDeal = {
        id: '123',
        job_number: 'JOB-001',
        scheduled_start_time: '2025-01-15T09:00:00',
        scheduled_end_time: '2025-01-15T10:00:00',
        job_parts: [],
      }

      const result = mapDbDealToForm(dbDeal)

      expect(result.scheduled_start_time).toBe('2025-01-15T09:00:00')
      expect(result.scheduled_end_time).toBe('2025-01-15T10:00:00')
    })

    it('should handle null promised_date gracefully', () => {
      const dbDeal = {
        id: '123',
        job_parts: [
          {
            id: '1',
            promised_date: null,
          },
        ],
      }

      const result = mapDbDealToForm(dbDeal)

      // mapDbDealToForm converts null to '' for form compatibility
      expect(result.lineItems[0].promised_date).toBe('')
      expect(result.lineItems[0].promisedDate).toBe('')
    })

    it('should coexist: job scheduled_* and line promised_date both persist', () => {
      const dbDeal = {
        id: '123',
        scheduled_start_time: '2025-01-15T09:00:00',
        scheduled_end_time: '2025-01-15T10:00:00',
        job_parts: [
          {
            id: '1',
            requires_scheduling: true,
            promised_date: '2025-01-14',
            scheduled_start_time: '',
            scheduled_end_time: '',
          },
        ],
      }

      const result = mapDbDealToForm(dbDeal)

      // Job-level scheduled times preserved
      expect(result.scheduled_start_time).toBe('2025-01-15T09:00:00')
      expect(result.scheduled_end_time).toBe('2025-01-15T10:00:00')

      // Line-level promised_date preserved
      expect(result.lineItems[0].promised_date).toBe('2025-01-14')
      expect(result.lineItems[0].requires_scheduling).toBe(true)
    })
  })
})
