// src/tests/calendarAgenda.overlapFilter.test.js
// Verifies agenda uses date-range overlap logic and derives windows from job_parts schedule.

import { describe, it, expect } from 'vitest'
import { applyFilters } from '@/pages/calendar-agenda'

function makeJob({
  id = 'job-1',
  job_status = 'pending',
  jobScheduledStart = null,
  jobScheduledEnd = null,
  partScheduledStart = null,
  partScheduledEnd = null,
} = {}) {
  return {
    id,
    job_status,
    scheduled_start_time: jobScheduledStart,
    scheduled_end_time: jobScheduledEnd,
    job_parts: partScheduledStart
      ? [
          {
            id: 'part-1',
            scheduled_start_time: partScheduledStart,
            scheduled_end_time: partScheduledEnd,
          },
        ]
      : [],
  }
}

describe('calendar agenda filtering', () => {
  it('includes a job when only job_parts has scheduled window (not job-level)', () => {
    const rows = [
      makeJob({
        jobScheduledStart: null,
        partScheduledStart: '2025-12-31T15:00:00.000Z',
        partScheduledEnd: '2025-12-31T16:00:00.000Z',
      }),
    ]

    const now = new Date('2025-12-31T12:00:00.000Z')
    const out = applyFilters(rows, { dateRange: 'today', now })
    expect(out.map((r) => r.id)).toEqual(['job-1'])
  })

  it('uses overlap logic (appointment spanning into range is included)', () => {
    const rows = [
      makeJob({
        id: 'job-2',
        // Spans midnight ET: 11:30pm ET (12/30) -> 1:30am ET (12/31)
        partScheduledStart: '2025-12-31T04:30:00.000Z',
        partScheduledEnd: '2025-12-31T06:30:00.000Z',
      }),
    ]

    const now = new Date('2025-12-31T12:00:00.000Z')
    const out = applyFilters(rows, { dateRange: 'today', now })
    expect(out.map((r) => r.id)).toEqual(['job-2'])
  })

  it('does not include when there is no overlap', () => {
    const rows = [
      makeJob({
        id: 'job-3',
        partScheduledStart: '2025-12-29T15:00:00.000Z',
        partScheduledEnd: '2025-12-29T16:00:00.000Z',
      }),
    ]

    const now = new Date('2025-12-31T12:00:00.000Z')
    const out = applyFilters(rows, { dateRange: 'today', now })
    expect(out.map((r) => r.id)).toEqual([])
  })
})
