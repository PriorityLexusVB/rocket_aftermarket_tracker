// src/tests/calendarAgenda.deliveryCoordinatorFilter.test.js
// Verifies agenda date-range filtering, independent of delivery coordinator assignment.

import { describe, it, expect } from 'vitest'
import { applyFilters } from '@/pages/calendar-agenda'

function makeJob({
  id = 'job-1',
  job_status = 'scheduled',
  delivery_coordinator_id = null,
  partScheduledStart = '2025-12-31T15:00:00.000Z',
  partScheduledEnd = '2025-12-31T16:00:00.000Z',
} = {}) {
  return {
    id,
    job_status,
    delivery_coordinator_id,
    scheduled_start_time: null,
    scheduled_end_time: null,
    job_parts: [
      {
        id: 'part-1',
        scheduled_start_time: partScheduledStart,
        scheduled_end_time: partScheduledEnd,
      },
    ],
  }
}

describe('calendar agenda delivery coordinator filter', () => {
  it('does not filter by delivery coordinator (assignment removed)', () => {
    const rows = [
      makeJob({ id: 'job-a', delivery_coordinator_id: 'dc-1' }),
      makeJob({ id: 'job-b', delivery_coordinator_id: 'dc-2' }),
    ]

    const now = new Date('2025-12-31T12:00:00.000Z')
    const out = applyFilters(rows, {
      dateRange: 'today',
      now,
    })

    expect(out.map((r) => r.id)).toEqual(['job-a', 'job-b'])
  })

  it('supports next3days dateRange', () => {
    const now = new Date('2025-12-31T12:00:00.000Z')

    const rows = [
      // +2 days (included)
      makeJob({
        id: 'job-in',
        delivery_coordinator_id: 'dc-1',
        partScheduledStart: '2026-01-02T15:00:00.000Z',
        partScheduledEnd: '2026-01-02T16:00:00.000Z',
      }),
      // +4 days (excluded)
      makeJob({
        id: 'job-out',
        delivery_coordinator_id: 'dc-1',
        partScheduledStart: '2026-01-04T15:00:00.000Z',
        partScheduledEnd: '2026-01-04T16:00:00.000Z',
      }),
    ]

    const out = applyFilters(rows, {
      dateRange: 'next3days',
      now,
    })

    expect(out.map((r) => r.id)).toEqual(['job-in'])
  })

  it('includes promised-only items (no scheduled time) in day ranges', () => {
    const now = new Date('2025-01-01T12:00:00.000Z')
    const rows = [
      {
        id: 'p1',
        raw: { promised_date: '2025-01-02' },
        scheduledStart: null,
        scheduledEnd: null,
      },
      {
        id: 'p2',
        raw: { promised_date: '2025-02-01' },
        scheduledStart: null,
        scheduledEnd: null,
      },
    ]

    const filtered = applyFilters(rows, { dateRange: 'next3days', now })
    expect(filtered.map((r) => r.id)).toEqual(['p1'])
  })
})
