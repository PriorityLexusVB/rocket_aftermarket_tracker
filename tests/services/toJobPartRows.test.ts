// tests/services/toJobPartRows.test.ts
// Verifies vendor_id and scheduled_* gating logic in toJobPartRows.

import { toJobPartRows } from '../../src/services/dealService.js'

// NOTE: dealService.js holds capability flags in module scope; we cannot import them directly for mutation
// without editing the service. Instead we simulate gating by controlling opts.includeTimes and ensuring vendor_id
// is only present when capability would be true. For vendor_id omission the service now conditionally spreads
// vendor_id only when JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE is true. To test both states without refactoring,
// we mock the behavior by inspecting produced rows when vendor_id is undefined vs provided.

// In future we can expose a test helper: __setCapabilities({ vendorId: boolean, times: boolean })
// For now we assert structural expectations on typical data.

describe('toJobPartRows gating', () => {
  const jobId = 'test-job-id'

  it('includes scheduled_* when includeTimes=true', () => {
    const rows = toJobPartRows(
      jobId,
      [
        {
          product_id: 'p1',
          vendor_id: 'v1',
          scheduled_start_time: '2025-11-09T08:00:00Z',
          scheduled_end_time: '2025-11-09T10:00:00Z',
          requiresScheduling: true,
        },
      ],
      { includeTimes: true }
    )

    expect(rows[0]).toHaveProperty('scheduled_start_time')
    expect(rows[0]).toHaveProperty('scheduled_end_time')
  })

  it('omits scheduled_* when includeTimes=false', () => {
    const rows = toJobPartRows(
      jobId,
      [
        {
          product_id: 'p1',
          vendor_id: 'v1',
          scheduled_start_time: '2025-11-09T08:00:00Z',
          scheduled_end_time: '2025-11-09T10:00:00Z',
          requiresScheduling: true,
        },
      ],
      { includeTimes: false }
    )

    expect(rows[0]).not.toHaveProperty('scheduled_start_time')
    expect(rows[0]).not.toHaveProperty('scheduled_end_time')
  })

  it('includes vendor_id when provided and capability assumed true', () => {
    const rows = toJobPartRows(
      jobId,
      [{ product_id: 'p1', vendor_id: 'v1', requiresScheduling: true }],
      { includeTimes: false }
    )
    expect(rows[0]).toHaveProperty('vendor_id', 'v1')
  })

  it('does not include vendor_id when item lacks it (simulating capability false scenario)', () => {
    const rows = toJobPartRows(
      jobId,
      [
        { product_id: 'p1', requiresScheduling: true }, // vendor_id intentionally absent
      ],
      { includeTimes: false }
    )
    expect(rows[0]).not.toHaveProperty('vendor_id')
  })
})
