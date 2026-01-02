// src/tests/snapshotView.filtering.test.js
import { describe, it, expect } from 'vitest'
import {
  filterAndSort,
  detectConflicts,
  splitSnapshotItems,
  splitNeedsSchedulingItems,
} from '@/pages/currently-active-appointments/components/SnapshotView'
import {
  createUndoEntry,
  canUndo,
} from '@/pages/currently-active-appointments/components/undoHelpers'

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

  it('detectConflicts returns empty set when no overlaps', () => {
    const rows = [
      {
        id: 'a',
        job_status: 'scheduled',
        scheduled_start_time: '2025-11-11T09:00:00Z',
        scheduled_end_time: '2025-11-11T10:00:00Z',
        vendor: { id: 'v1' },
      },
      {
        id: 'b',
        job_status: 'scheduled',
        scheduled_start_time: '2025-11-11T10:00:00Z',
        scheduled_end_time: '2025-11-11T11:00:00Z',
        vendor: { id: 'v1' },
      },
    ]
    expect(detectConflicts(rows).size).toBe(0)
  })

  it('detectConflicts flags overlapping jobs for same vendor', () => {
    const rows = [
      {
        id: 'a',
        job_status: 'scheduled',
        scheduled_start_time: '2025-11-11T09:00:00Z',
        scheduled_end_time: '2025-11-11T10:30:00Z',
        vendor: { id: 'v1' },
      },
      {
        id: 'b',
        job_status: 'scheduled',
        scheduled_start_time: '2025-11-11T10:00:00Z',
        scheduled_end_time: '2025-11-11T11:00:00Z',
        vendor: { id: 'v1' },
      },
      {
        id: 'c',
        job_status: 'scheduled',
        scheduled_start_time: '2025-11-11T12:00:00Z',
        scheduled_end_time: '2025-11-11T13:00:00Z',
        vendor: { id: 'v2' },
      },
    ]
    const conflicts = detectConflicts(rows)
    expect(conflicts.has('a')).toBe(true)
    expect(conflicts.has('b')).toBe(true)
    expect(conflicts.has('c')).toBe(false)
  })
})

describe('SnapshotView.undoHelpers', () => {
  it('createUndoEntry creates entry with job id and previous status', () => {
    const entry = createUndoEntry('job-123', 'in_progress')
    expect(entry.jobId).toBe('job-123')
    expect(entry.prevStatus).toBe('in_progress')
    expect(entry.timeoutId).toBe(null)
  })

  it('canUndo returns true when undo entry exists', () => {
    const undoMap = new Map()
    undoMap.set('job-1', { prevStatus: 'scheduled', timeoutId: 123 })
    expect(canUndo(undoMap, 'job-1')).toBe(true)
  })

  it('canUndo returns false when undo entry does not exist', () => {
    const undoMap = new Map()
    expect(canUndo(undoMap, 'job-1')).toBe(false)
  })

  it('canUndo returns false for empty map', () => {
    const undoMap = new Map()
    expect(canUndo(undoMap, 'any-id')).toBe(false)
  })
})

describe('SnapshotView.splitSnapshotItems (unscheduled bucket)', () => {
  it('includes unscheduled in-house in_progress in controlled bucket', () => {
    const now = new Date('2025-11-11T12:00:00Z')
    const items = [
      {
        id: 'u1',
        scheduledStart: null,
        scheduledEnd: null,
        scheduleState: 'unscheduled',
        locationType: 'In-House',
        raw: { job_status: 'in_progress', service_type: 'onsite' },
      },
    ]
    const out = splitSnapshotItems(items, { now })
    expect(out.unscheduledInProgress.map((j) => j.id)).toEqual(['u1'])
    expect(out.upcoming).toEqual([])
  })

  it('excludes unscheduled items that are not in_progress/quality_check', () => {
    const now = new Date('2025-11-11T12:00:00Z')
    const items = [
      {
        id: 'u2',
        scheduledStart: null,
        scheduledEnd: null,
        scheduleState: 'unscheduled',
        locationType: 'In-House',
        raw: { job_status: 'pending', service_type: 'onsite' },
      },
    ]
    const out = splitSnapshotItems(items, { now })
    expect(out.unscheduledInProgress).toEqual([])
  })

  it('excludes unscheduled items that are not in-house/on-site', () => {
    const now = new Date('2025-11-11T12:00:00Z')
    const items = [
      {
        id: 'u3',
        scheduledStart: null,
        scheduledEnd: null,
        scheduleState: 'unscheduled',
        locationType: 'Off-Site',
        raw: { job_status: 'quality_check', service_type: 'vendor' },
      },
    ]
    const out = splitSnapshotItems(items, { now })
    expect(out.unscheduledInProgress).toEqual([])
  })
})

describe('SnapshotView.splitNeedsSchedulingItems', () => {
  it('splits by promisedAt relative to today start', () => {
    const now = new Date('2025-11-11T12:00:00Z')
    const items = [
      { id: 'a', promisedAt: '2025-11-10T00:00:00Z', raw: {} },
      { id: 'b', promisedAt: '2025-11-11T00:00:00Z', raw: {} },
      { id: 'c', promisedAt: '2025-11-12T00:00:00Z', raw: {} },
    ]
    const out = splitNeedsSchedulingItems(items, { now })
    expect(out.overdue.map((x) => x.id)).toEqual(['a'])
    expect(out.upcoming.map((x) => x.id)).toEqual(['b', 'c'])
  })

  it('ignores items without a parseable promise', () => {
    const now = new Date('2025-11-11T12:00:00Z')
    const items = [{ id: 'x', promisedAt: null, raw: {} }]
    const out = splitNeedsSchedulingItems(items, { now })
    expect(out.overdue).toEqual([])
    expect(out.upcoming).toEqual([])
  })
})
