import { describe, expect, it } from 'vitest'

import { getEffectiveJobStatus, getUncompleteTargetStatus } from '@/utils/jobStatusTimeRules.js'

describe('jobStatusTimeRules', () => {
  describe('getEffectiveJobStatus', () => {
    it('keeps scheduled when start time is in the future', () => {
      const job = { job_status: 'scheduled', scheduled_start_time: '2026-01-22T18:00:00Z' }
      const now = new Date('2026-01-22T12:00:00Z')
      expect(getEffectiveJobStatus(job, { now })).toBe('scheduled')
    })

    it('promotes scheduled to in_progress when start time hits', () => {
      const job = { job_status: 'scheduled', scheduled_start_time: '2026-01-22T12:00:00Z' }
      const now = new Date('2026-01-22T12:00:01Z')
      expect(getEffectiveJobStatus(job, { now })).toBe('in_progress')
    })

    it('promotes booked to in_progress when start time hits', () => {
      const job = { job_status: 'booked', scheduled_start_time: '2026-01-22T12:00:00Z' }
      const now = new Date('2026-01-22T12:00:01Z')
      expect(getEffectiveJobStatus(job, { now })).toBe('in_progress')
    })

    it('promotes date-only scheduled_start_time based on ET day', () => {
      const job = { job_status: 'scheduled', scheduled_start_time: '2026-01-22' }
      expect(getEffectiveJobStatus(job, { now: new Date('2026-01-21T23:00:00Z') })).toBe(
        'scheduled'
      )
      expect(getEffectiveJobStatus(job, { now: new Date('2026-01-22T15:00:00Z') })).toBe(
        'in_progress'
      )
    })

    it('does not auto-change completed', () => {
      const job = { job_status: 'completed', scheduled_start_time: '2026-01-22T12:00:00Z' }
      const now = new Date('2026-01-22T13:00:00Z')
      expect(getEffectiveJobStatus(job, { now })).toBe('completed')
    })
  })

  describe('getUncompleteTargetStatus', () => {
    it('returns scheduled when schedule is still in the future', () => {
      const job = { scheduled_start_time: '2026-01-22T18:00:00Z' }
      const now = new Date('2026-01-22T12:00:00Z')
      expect(getUncompleteTargetStatus(job, { now })).toBe('scheduled')
    })

    it('returns in_progress when schedule time has hit', () => {
      const job = { scheduled_start_time: '2026-01-22T12:00:00Z' }
      const now = new Date('2026-01-22T12:00:01Z')
      expect(getUncompleteTargetStatus(job, { now })).toBe('in_progress')
    })

    it('treats date-only schedule as scheduled until that ET day arrives', () => {
      const job = { scheduled_start_time: '2026-01-22' }
      expect(getUncompleteTargetStatus(job, { now: new Date('2026-01-21T23:00:00Z') })).toBe(
        'scheduled'
      )
      expect(getUncompleteTargetStatus(job, { now: new Date('2026-01-22T15:00:00Z') })).toBe(
        'in_progress'
      )
    })

    it('defaults to in_progress when schedule is missing', () => {
      expect(getUncompleteTargetStatus({}, { now: new Date('2026-01-22T12:00:00Z') })).toBe(
        'in_progress'
      )
    })
  })
})
