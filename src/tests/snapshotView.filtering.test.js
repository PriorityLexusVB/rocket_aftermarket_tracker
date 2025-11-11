// src/tests/snapshotView.filtering.test.js
import { describe, it, expect } from 'vitest'
import { filterAndSort } from '@/pages/currently-active-appointments/components/SnapshotView'

describe('SnapshotView.filterAndSort', () => {
  it('filters to scheduled and in_progress with start time', () => {
    const jobs = [
      { id: '1', job_status: 'scheduled', scheduled_start_time: '2025-11-11T10:00:00Z' },
      { id: '2', job_status: 'in_progress', scheduled_start_time: '2025-11-11T09:00:00Z' },
      { id: '3', job_status: 'completed', scheduled_start_time: '2025-11-11T08:00:00Z' },
      { id: '4', job_status: 'scheduled', scheduled_start_time: null },
    ]
    const out = filterAndSort(jobs)
    expect(out.map((j) => j.id)).toEqual(['2', '1'])
  })

  it('handles empty arrays', () => {
    expect(filterAndSort([])).toEqual([])
  })

  it('sorts ascending by start time with ties stable enough', () => {
    const jobs = [
      { id: 'a', job_status: 'scheduled', scheduled_start_time: '2025-11-11T09:00:00Z' },
      { id: 'b', job_status: 'scheduled', scheduled_start_time: '2025-11-11T09:00:00Z' },
      { id: 'c', job_status: 'scheduled', scheduled_start_time: '2025-11-11T10:00:00Z' },
    ]
    const out = filterAndSort(jobs)
    expect(out.map((j) => j.id)).toEqual(['a', 'b', 'c'])
  })

  it('ignores items without scheduled_start_time', () => {
    const jobs = [
      { id: 'x', job_status: 'scheduled' },
      { id: 'y', job_status: 'in_progress', scheduled_start_time: '2025-11-11T11:00:00Z' },
    ]
    const out = filterAndSort(jobs)
    expect(out.map((j) => j.id)).toEqual(['y'])
  })
})
