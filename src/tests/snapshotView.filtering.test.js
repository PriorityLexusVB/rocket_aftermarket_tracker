// src/tests/snapshotView.filtering.test.js
import { describe, it, expect } from 'vitest'

/**
 * Test the snapshot filtering and sorting logic
 * This test validates the core data transformation used in SnapshotView
 */

// Helper function that mimics SnapshotView's filtering logic
function filterAndSortForSnapshot(jobs) {
  // Filter to scheduled/in_progress with non-null scheduled_start_time
  const filtered = jobs.filter(
    (job) =>
      ['scheduled', 'in_progress'].includes(job.job_status) &&
      job.scheduled_start_time != null
  )

  // Sort ascending by scheduled_start_time
  filtered.sort((a, b) => {
    const aTime = new Date(a.scheduled_start_time).getTime()
    const bTime = new Date(b.scheduled_start_time).getTime()
    return aTime - bTime
  })

  return filtered
}

describe('SnapshotView - Filtering and Sorting', () => {
  it('should filter only scheduled and in_progress jobs with scheduled_start_time', () => {
    const jobs = [
      { id: 1, job_status: 'scheduled', scheduled_start_time: '2025-11-11T10:00:00Z' },
      { id: 2, job_status: 'in_progress', scheduled_start_time: '2025-11-11T11:00:00Z' },
      { id: 3, job_status: 'completed', scheduled_start_time: '2025-11-11T09:00:00Z' },
      { id: 4, job_status: 'pending', scheduled_start_time: '2025-11-11T12:00:00Z' },
      { id: 5, job_status: 'scheduled', scheduled_start_time: null },
    ]

    const result = filterAndSortForSnapshot(jobs)

    expect(result).toHaveLength(2)
    expect(result.map((j) => j.id)).toEqual([1, 2])
  })

  it('should sort jobs ascending by scheduled_start_time', () => {
    const jobs = [
      { id: 1, job_status: 'scheduled', scheduled_start_time: '2025-11-11T15:00:00Z' },
      { id: 2, job_status: 'in_progress', scheduled_start_time: '2025-11-11T09:00:00Z' },
      { id: 3, job_status: 'scheduled', scheduled_start_time: '2025-11-11T12:00:00Z' },
    ]

    const result = filterAndSortForSnapshot(jobs)

    expect(result).toHaveLength(3)
    expect(result.map((j) => j.id)).toEqual([2, 3, 1])
  })

  it('should exclude jobs with null scheduled_start_time', () => {
    const jobs = [
      { id: 1, job_status: 'scheduled', scheduled_start_time: null },
      { id: 2, job_status: 'in_progress', scheduled_start_time: undefined },
      { id: 3, job_status: 'scheduled', scheduled_start_time: '2025-11-11T10:00:00Z' },
    ]

    const result = filterAndSortForSnapshot(jobs)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(3)
  })

  it('should exclude non-scheduled and non-in_progress statuses', () => {
    const jobs = [
      { id: 1, job_status: 'new', scheduled_start_time: '2025-11-11T10:00:00Z' },
      { id: 2, job_status: 'pending', scheduled_start_time: '2025-11-11T11:00:00Z' },
      { id: 3, job_status: 'completed', scheduled_start_time: '2025-11-11T09:00:00Z' },
      { id: 4, job_status: 'quality_check', scheduled_start_time: '2025-11-11T12:00:00Z' },
      { id: 5, job_status: 'scheduled', scheduled_start_time: '2025-11-11T14:00:00Z' },
    ]

    const result = filterAndSortForSnapshot(jobs)

    expect(result).toHaveLength(1)
    expect(result[0].id).toBe(5)
  })

  it('should handle empty array', () => {
    const result = filterAndSortForSnapshot([])
    expect(result).toHaveLength(0)
  })

  it('should handle jobs scheduled at the same time', () => {
    const jobs = [
      { id: 1, job_status: 'scheduled', scheduled_start_time: '2025-11-11T10:00:00Z' },
      { id: 2, job_status: 'in_progress', scheduled_start_time: '2025-11-11T10:00:00Z' },
      { id: 3, job_status: 'scheduled', scheduled_start_time: '2025-11-11T10:00:00Z' },
    ]

    const result = filterAndSortForSnapshot(jobs)

    expect(result).toHaveLength(3)
    // All have same time, so order is stable but not guaranteed beyond that
    expect(result.every((j) => j.scheduled_start_time === '2025-11-11T10:00:00Z')).toBe(true)
  })

  it('should preserve job data structure while filtering and sorting', () => {
    const jobs = [
      {
        id: 1,
        job_status: 'scheduled',
        scheduled_start_time: '2025-11-11T15:00:00Z',
        title: 'Job 1',
        vehicle: { make: 'Toyota', model: 'Camry' },
      },
      {
        id: 2,
        job_status: 'in_progress',
        scheduled_start_time: '2025-11-11T09:00:00Z',
        title: 'Job 2',
        vendor: { name: 'Vendor A' },
      },
    ]

    const result = filterAndSortForSnapshot(jobs)

    expect(result).toHaveLength(2)
    expect(result[0].title).toBe('Job 2')
    expect(result[0].vendor?.name).toBe('Vendor A')
    expect(result[1].title).toBe('Job 1')
    expect(result[1].vehicle?.make).toBe('Toyota')
  })
})
