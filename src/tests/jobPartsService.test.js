/**
 * Tests for centralized job_parts service
 *
 * This test suite ensures that replaceJobPartsForJob:
 * 1. Always does DELETE then INSERT (no duplicates)
 * 2. Handles retry logic for missing columns
 * 3. Works correctly across multiple saves
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Track calls
let upsertCallCount = 0
let insertedRows = []
let lastOnConflict = null

// Mock supabase at module level
vi.mock('../lib/supabase', () => {
  return {
    supabase: {
      from: vi.fn(() => ({
        delete: vi.fn(() => ({
          eq: vi.fn(() => Promise.resolve({ error: null })),
        })),
        upsert: vi.fn((rows, opts) => {
          upsertCallCount++
          lastOnConflict = opts?.onConflict || null
          insertedRows.push(...(Array.isArray(rows) ? rows : [rows]))
          return {
            select: vi.fn(() => Promise.resolve({ error: null })),
          }
        }),
      })),
    },
  }
})

// Mock capabilities
vi.mock('../utils/capabilityTelemetry', () => ({
  JOB_PARTS_HAS_PER_LINE_TIMES: true,
  JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE: true,
  disableJobPartsVendorIdCapability: vi.fn(),
  disableJobPartsTimeCapability: vi.fn(),
  incrementTelemetry: vi.fn(),
  TelemetryKey: {
    VENDOR_ID_FALLBACK: 'vendor_id_fallback',
    SCHEDULED_TIMES_FALLBACK: 'scheduled_times_fallback',
  },
}))

// Import after mocks are set up
import {
  replaceJobPartsForJob,
  toJobPartRows,
  buildJobPartsPayload,
} from '../services/jobPartsService'

describe('jobPartsService - replaceJobPartsForJob', () => {
  beforeEach(() => {
    // Reset tracking
    upsertCallCount = 0
    insertedRows = []
    lastOnConflict = null
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should upsert new parts once', async () => {
    const jobId = 'job-123'
    const lineItems = [
      {
        product_id: 'prod-1',
        unit_price: 100,
        quantity_used: 1,
      },
    ]

    await replaceJobPartsForJob(jobId, lineItems)

    // Verify UPSERT was called once
    expect(upsertCallCount).toBe(1)

    // Verify exactly 1 row was inserted
    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0].job_id).toBe(jobId)
    expect(insertedRows[0].product_id).toBe('prod-1')
  })

  it('should upsert on repeat saves without accumulation', async () => {
    const jobId = 'job-123'
    const lineItems = [
      {
        product_id: 'prod-1',
        unit_price: 100,
        quantity_used: 1,
      },
    ]

    // First save
    await replaceJobPartsForJob(jobId, lineItems)
    const firstUpsertCount = upsertCallCount
    const firstInsertedCount = insertedRows.length

    expect(firstUpsertCount).toBe(1)
    expect(firstInsertedCount).toBe(1)

    // Reset tracking
    upsertCallCount = 0
    insertedRows = []

    // Second save (simulating edit)
    await replaceJobPartsForJob(jobId, lineItems)

    // Verify UPSERT called again
    expect(upsertCallCount).toBe(1)

    // Verify still exactly 1 row (not accumulated)
    expect(insertedRows).toHaveLength(1)
  })

  it('should handle empty line items array', async () => {
    const jobId = 'job-123'

    await replaceJobPartsForJob(jobId, [])

    // UPSERT should NOT be called for empty array
    expect(upsertCallCount).toBe(0)
  })

  it('should handle multiple line items', async () => {
    const jobId = 'job-123'
    const lineItems = [
      { product_id: 'prod-1', unit_price: 100, quantity_used: 1 },
      { product_id: 'prod-2', unit_price: 200, quantity_used: 1 },
      { product_id: 'prod-3', unit_price: 300, quantity_used: 1 },
    ]

    await replaceJobPartsForJob(jobId, lineItems)

    // Verify UPSERT called once
    expect(upsertCallCount).toBe(1)

    // Verify exactly 3 rows inserted
    expect(insertedRows).toHaveLength(3)
    expect(insertedRows[0].product_id).toBe('prod-1')
    expect(insertedRows[1].product_id).toBe('prod-2')
    expect(insertedRows[2].product_id).toBe('prod-3')
  })

  it('toJobPartRows should handle both camelCase and snake_case', () => {
    const jobId = 'job-123'

    // Test with camelCase (as used by the form/UI)
    const camelCaseItems = [
      {
        product_id: 'prod-1', // product_id is always snake_case
        price: 100, // Maps to unit_price via 'price' fallback
        requiresScheduling: true,
        isOffSite: false,
      },
    ]

    const camelRows = toJobPartRows(jobId, camelCaseItems)
    expect(camelRows).toHaveLength(1)
    expect(camelRows[0].product_id).toBe('prod-1')
    expect(camelRows[0].unit_price).toBe(100)

    // Test with snake_case (as stored in DB)
    const snakeCaseItems = [
      {
        product_id: 'prod-1',
        unit_price: 100,
        requires_scheduling: true,
        is_off_site: false,
      },
    ]

    const snakeRows = toJobPartRows(jobId, snakeCaseItems)
    expect(snakeRows).toHaveLength(1)
    expect(snakeRows[0].product_id).toBe('prod-1')
    expect(snakeRows[0].unit_price).toBe(100)
  })

  it('should throw error if jobId is missing', async () => {
    await expect(replaceJobPartsForJob(null, [])).rejects.toThrow(
      'jobId is required for replaceJobPartsForJob'
    )
  })

  // NEW TESTS FOR DEDUPLICATION GUARDRAIL

  it('should deduplicate identical line items without inserting duplicates', async () => {
    const jobId = 'job-123'
    const lineItems = [
      { product_id: 'prod-1', vendor_id: 'vend-1', unit_price: 100, quantity_used: 2 },
      { product_id: 'prod-1', vendor_id: 'vend-1', unit_price: 100, quantity_used: 2 },
      { product_id: 'prod-1', vendor_id: 'vend-1', unit_price: 100, quantity_used: 2 },
    ]

    await replaceJobPartsForJob(jobId, lineItems)

    // Verify UPSERT called once
    expect(upsertCallCount).toBe(1)

    // Verify only ONE row inserted (duplicates removed)
    expect(insertedRows).toHaveLength(1)

    // Verify the payload retains a single entry
    expect(insertedRows[0].quantity_used).toBe(6)
    expect(insertedRows[0].product_id).toBe('prod-1')
    expect(insertedRows[0].vendor_id).toBe('vend-1')
  })

  it('should ignore blank line items without a product', async () => {
    const jobId = 'job-123'
    const lineItems = [
      { product_id: null, unit_price: 50, quantity_used: 1 },
      { product_id: undefined, unit_price: 60, quantity_used: 1 },
      { product_id: 'prod-keep', unit_price: 70, quantity_used: 2 },
    ]

    await replaceJobPartsForJob(jobId, lineItems)

    expect(upsertCallCount).toBe(1)
    expect(insertedRows).toHaveLength(1)
    expect(insertedRows[0].product_id).toBe('prod-keep')
    expect(insertedRows[0].quantity_used).toBe(2)
  })

  it('should NOT merge line items with different products', async () => {
    const jobId = 'job-123'
    const lineItems = [
      { product_id: 'prod-1', vendor_id: 'vend-1', unit_price: 100, quantity_used: 2 },
      { product_id: 'prod-2', vendor_id: 'vend-1', unit_price: 100, quantity_used: 3 },
    ]

    await replaceJobPartsForJob(jobId, lineItems)

    // Should have 2 distinct rows (different products)
    expect(insertedRows).toHaveLength(2)
    expect(insertedRows[0].product_id).toBe('prod-1')
    expect(insertedRows[0].quantity_used).toBe(2)
    expect(insertedRows[1].product_id).toBe('prod-2')
    expect(insertedRows[1].quantity_used).toBe(3)
  })

  it('should NOT merge line items with different vendors', async () => {
    const jobId = 'job-123'
    const lineItems = [
      { product_id: 'prod-1', vendor_id: 'vend-1', unit_price: 100, quantity_used: 2 },
      { product_id: 'prod-1', vendor_id: 'vend-2', unit_price: 100, quantity_used: 3 },
    ]

    await replaceJobPartsForJob(jobId, lineItems)

    // Should have 2 distinct rows (different vendors)
    expect(insertedRows).toHaveLength(2)
    expect(insertedRows[0].vendor_id).toBe('vend-1')
    expect(insertedRows[0].quantity_used).toBe(2)
    expect(insertedRows[1].vendor_id).toBe('vend-2')
    expect(insertedRows[1].quantity_used).toBe(3)
  })

  it('should NOT merge line items with different scheduled times', async () => {
    const jobId = 'job-123'
    const lineItems = [
      {
        product_id: 'prod-1',
        vendor_id: 'vend-1',
        unit_price: 100,
        quantity_used: 2,
        scheduledStartTime: '2024-01-01T09:00:00Z',
        scheduledEndTime: '2024-01-01T10:00:00Z',
      },
      {
        product_id: 'prod-1',
        vendor_id: 'vend-1',
        unit_price: 100,
        quantity_used: 3,
        scheduledStartTime: '2024-01-01T11:00:00Z',
        scheduledEndTime: '2024-01-01T12:00:00Z',
      },
    ]

    await replaceJobPartsForJob(jobId, lineItems)

    // Should have 2 distinct rows (different times)
    expect(insertedRows).toHaveLength(2)
    expect(insertedRows[0].scheduled_start_time).toBe('2024-01-01T09:00:00Z')
    expect(insertedRows[0].quantity_used).toBe(2)
    expect(insertedRows[1].scheduled_start_time).toBe('2024-01-01T11:00:00Z')
    expect(insertedRows[1].quantity_used).toBe(3)
  })

  it('buildJobPartsPayload keeps rows distinct when promised_date differs', () => {
    const payload = buildJobPartsPayload(
      'job-abc',
      [
        {
          product_id: 'prod-1',
          vendor_id: 'vend-1',
          promised_date: '2025-01-01',
          scheduled_start_time: '2025-01-02T10:00:00Z',
          scheduled_end_time: '2025-01-02T11:00:00Z',
        },
        {
          product_id: 'prod-1',
          vendor_id: 'vend-1',
          promised_date: '2025-01-03',
          scheduled_start_time: '2025-01-02T10:00:00Z',
          scheduled_end_time: '2025-01-02T11:00:00Z',
        },
      ],
      { includeTimes: true, includeVendor: true }
    )

    expect(payload).toHaveLength(2)
    expect(payload[0].promised_date).toBe('2025-01-01')
    expect(payload[1].promised_date).toBe('2025-01-03')
  })

  it('should prevent accumulation across three consecutive saves', async () => {
    const jobId = 'job-123'
    const lineItems = [
      { product_id: 'prod-1', vendor_id: 'vend-1', unit_price: 100, quantity_used: 1 },
    ]

    // First save
    await replaceJobPartsForJob(jobId, lineItems)
    expect(upsertCallCount).toBe(1)
    expect(insertedRows).toHaveLength(1)

    // Reset tracking
    upsertCallCount = 0
    insertedRows = []

    // Second save
    await replaceJobPartsForJob(jobId, lineItems)
    expect(upsertCallCount).toBe(1)
    expect(insertedRows).toHaveLength(1) // Still 1, not 2

    // Reset tracking again
    upsertCallCount = 0
    insertedRows = []

    // Third save
    await replaceJobPartsForJob(jobId, lineItems)
    expect(upsertCallCount).toBe(1)
    expect(insertedRows).toHaveLength(1) // Still 1, not 3

    // Verify the quantity hasn't accumulated (still 1, not 3)
    expect(insertedRows[0].quantity_used).toBe(1)
  })

  it('buildJobPartsPayload dedupes rows with null times and empty vendor', () => {
    const payload = buildJobPartsPayload(
      'job-xyz',
      [
        {
          product_id: 'prod-1',
          vendor_id: null,
          scheduled_start_time: null,
          scheduled_end_time: null,
        },
        {
          product_id: 'prod-1',
          vendor_id: '',
          scheduled_start_time: null,
          scheduled_end_time: null,
        },
      ],
      { includeTimes: true, includeVendor: true }
    )

    expect(payload).toHaveLength(1)
    expect(payload[0].vendor_id).toBeNull()
    expect(payload[0].scheduled_start_time).toBeNull()
    expect(payload[0].scheduled_end_time).toBeNull()
  })

  it('buildJobPartsPayload normalizes Date times to ISO strings', () => {
    const start = new Date('2025-01-01T10:00:00Z')
    const end = new Date('2025-01-01T12:00:00Z')

    const payload = buildJobPartsPayload(
      'job-abc',
      [{ product_id: 'prod-1', scheduled_start_time: start, scheduled_end_time: end }],
      { includeTimes: true, includeVendor: false }
    )

    expect(payload).toHaveLength(1)
    expect(payload[0].scheduled_start_time).toBe('2025-01-01T10:00:00Z')
    expect(payload[0].scheduled_end_time).toBe('2025-01-01T12:00:00Z')
  })

  it('uses conflict key with vendor and times when available', async () => {
    const jobId = 'job-999'
    const lineItems = [
      {
        product_id: 'prod-1',
        vendor_id: 'vend-1',
        promised_date: '2025-02-01',
        scheduledStartTime: '2025-02-02T10:00:00Z',
        scheduledEndTime: '2025-02-02T11:00:00Z',
      },
    ]

    await replaceJobPartsForJob(jobId, lineItems)

    expect(lastOnConflict).toBe(
      'job_id,product_id,vendor_id,promised_date,scheduled_start_time,scheduled_end_time'
    )
  })

  it('uses conflict key without vendor/time when capabilities are disabled', async () => {
    const jobId = 'job-888'
    const lineItems = [
      {
        product_id: 'prod-1',
        promised_date: '2025-03-01',
      },
    ]

    await replaceJobPartsForJob(jobId, lineItems, { includeVendor: false, includeTimes: false })

    expect(lastOnConflict).toBe('job_id,product_id,promised_date')
  })
})
