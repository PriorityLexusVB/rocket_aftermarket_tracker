import { describe, it, expect } from 'vitest'
import { calendarQueryMatches } from '@/utils/calendarQueryMatch'

describe('calendarQueryMatches', () => {
  it('matches on top-level job fields', () => {
    const job = {
      job_number: 'STK-221',
      title: 'Window tint',
      customer_name: 'Jane Smith',
      customer_phone: '555-0101',
    }

    expect(calendarQueryMatches(job, 'stk-221')).toBe(true)
    expect(calendarQueryMatches(job, 'jane')).toBe(true)
    expect(calendarQueryMatches(job, '555')).toBe(true)
  })

  it('matches on raw nested fields', () => {
    const job = {
      raw: {
        job_number: 'JOB-9',
        title: 'Ceramic coat',
        vehicle: { owner_name: 'Alex Doe' },
      },
      vehicleLabel: '2020 Ranger',
    }

    expect(calendarQueryMatches(job, 'alex')).toBe(true)
    expect(calendarQueryMatches(job, 'ranger')).toBe(true)
  })

  it('returns false when there is no match', () => {
    const job = { job_number: 'ABC-1', title: 'Detail' }

    expect(calendarQueryMatches(job, 'widget')).toBe(false)
  })

  it('returns true for empty queries', () => {
    const job = { job_number: 'ABC-1', title: 'Detail' }

    expect(calendarQueryMatches(job, '')).toBe(true)
    expect(calendarQueryMatches(job, '   ')).toBe(true)
  })
})
