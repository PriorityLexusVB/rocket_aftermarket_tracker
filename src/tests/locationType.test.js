import { describe, it, expect } from 'vitest'
import { isJobOnSite, getJobLocationType } from '../utils/locationType'

describe('locationType — getJobLocationType', () => {
  it('returns Mixed when job has both on-site and off-site parts', () => {
    const job = {
      job_parts: [
        { is_off_site: true },
        { is_off_site: false },
      ],
    }
    expect(getJobLocationType(job)).toBe('Mixed')
  })

  it('returns Off-Site when all parts are off-site', () => {
    expect(
      getJobLocationType({ job_parts: [{ is_off_site: true }] })
    ).toBe('Off-Site')
  })

  it('returns In-House when all parts are on-site', () => {
    expect(
      getJobLocationType({ job_parts: [{ is_off_site: false }] })
    ).toBe('In-House')
  })

  it('falls back to job.location/vendor_id when job_parts is empty', () => {
    expect(getJobLocationType({ location: 'on_site' })).toBe('In-House')
    expect(getJobLocationType({ vendor_id: 'abc' })).toBe('Off-Site')
    expect(getJobLocationType({})).toBe(null)
  })
})

describe('locationType — isJobOnSite (Wave XXX-H fix)', () => {
  // Before Wave XXX-H, isJobOnSite read job.location FIRST and returned true
  // for any job with location='on_site' — even multi-vendor Mixed jobs. After
  // the fix, isJobOnSite defers to getJobLocationType so Mixed correctly
  // classifies as NOT on-site (it has at least one off-site line item).
  it('returns false for Mixed jobs even when job.location is on_site', () => {
    const mixedJob = {
      location: 'on_site',
      job_parts: [
        { is_off_site: true },
        { is_off_site: false },
      ],
    }
    expect(isJobOnSite(mixedJob)).toBe(false)
  })

  it('returns true for purely In-House jobs', () => {
    expect(
      isJobOnSite({ job_parts: [{ is_off_site: false }] })
    ).toBe(true)
  })

  it('returns false for purely Off-Site jobs', () => {
    expect(
      isJobOnSite({ job_parts: [{ is_off_site: true }] })
    ).toBe(false)
  })

  it('falls back to legacy logic when no job_parts signal is present', () => {
    expect(isJobOnSite({ location: 'on_site' })).toBe(true)
    expect(isJobOnSite({ location: 'off_site' })).toBe(false)
    expect(isJobOnSite({ vendor_id: 'abc' })).toBe(false)
    expect(isJobOnSite({})).toBe(true) // no vendor_id, no location → in-house
  })
})
