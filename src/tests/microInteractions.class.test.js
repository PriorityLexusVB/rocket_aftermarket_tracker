import { describe, expect, it } from 'vitest'
import { getMicroFlashClass } from '@/utils/microInteractions'

describe('getMicroFlashClass', () => {
  it('returns the flash class when enabled and ids match', () => {
    expect(
      getMicroFlashClass({ enabled: true, activeId: 'job-1', itemId: 'job-1' })
    ).toBe('calendar-micro-flash')
  })

  it('returns empty string when disabled or ids do not match', () => {
    expect(
      getMicroFlashClass({ enabled: false, activeId: 'job-1', itemId: 'job-1' })
    ).toBe('')
    expect(
      getMicroFlashClass({ enabled: true, activeId: 'job-1', itemId: 'job-2' })
    ).toBe('')
  })
})
