import { describe, expect, it } from 'vitest'
import { formatEtDateLabel } from '@/utils/scheduleDisplay'
import { toDateInputValue } from '@/utils/dateTimeUtils'

describe('date-only + midnight ISO handling (ET-safe)', () => {
  it('toDateInputValue normalizes date-only + midnight ISO variants without day shift', () => {
    const inputs = [
      '2026-01-14',
      '2026-01-14T00:00:00Z',
      '2026-01-14T00:00:00.000Z',
      '2026-01-14T00:00:00+00:00',
    ]

    for (const v of inputs) {
      expect(toDateInputValue(v)).toBe('2026-01-14')
    }
  })

  it('formatEtDateLabel renders the intended day for midnight ISO values', () => {
    const label = formatEtDateLabel('2026-01-14T00:00:00.000Z')
    expect(label).toContain('Jan')
    expect(label).toContain('14')
  })
})
