/**
 * Integration test for schema drift detection
 * Tests the /api/health-deals-rel endpoint's ability to detect various schema states
 */

import { describe, it, expect, beforeAll } from 'vitest'

describe('Schema Drift Detection', () => {
  let baseUrl

  beforeAll(() => {
    // Use localhost for local testing, can be overridden by ENV
    baseUrl = process.env.TEST_BASE_URL || 'http://localhost:5173'
  })

  it('should return healthy status when schema is correct', async () => {
    const response = await fetch(`${baseUrl}/api/health-deals-rel`)
    expect(response.status).toBe(200)

    const data = await response.json()

    // Should have correct structure
    expect(data).toHaveProperty('ok')
    expect(data).toHaveProperty('classification')
    expect(data).toHaveProperty('hasColumn')
    expect(data).toHaveProperty('hasFk')
    expect(data).toHaveProperty('restQueryOk')
    expect(data).toHaveProperty('ms')

    // In a healthy state, these should all be true
    if (data.ok) {
      expect(data.classification).toBe('ok')
      expect(data.hasColumn).toBe(true)
      expect(data.hasFk).toBe(true)
      expect(data.restQueryOk).toBe(true)
      expect(data.cacheRecognized).toBe(true)
    }
  })

  it('should classify errors correctly when relationship query fails', async () => {
    const response = await fetch(`${baseUrl}/api/health-deals-rel`)
    const data = await response.json()

    // If there's an error, classification should be set
    if (!data.ok) {
      expect(['missing_column', 'missing_fk', 'stale_cache', 'other']).toContain(
        data.classification
      )
      expect(data).toHaveProperty('error')
      expect(data).toHaveProperty('advice')
    }
  })

  it('should include diagnostic information', async () => {
    const response = await fetch(`${baseUrl}/api/health-deals-rel`)
    const data = await response.json()

    // Should always include diagnostics
    expect(data.fkName).toBe('job_parts_vendor_id_fkey')

    // These fields can be boolean or null (when state is unknown)
    expect(data.hasColumn === null || typeof data.hasColumn === 'boolean').toBe(true)
    expect(data.hasFk === null || typeof data.hasFk === 'boolean').toBe(true)
    expect(typeof data.restQueryOk).toBe('boolean')
    expect(typeof data.ms).toBe('number')
  })

  it('should complete within reasonable time', async () => {
    const start = Date.now()
    const response = await fetch(`${baseUrl}/api/health-deals-rel`)
    const elapsed = Date.now() - start

    expect(response.status).toBe(200)
    const data = await response.json()

    // Should complete within 2 seconds
    expect(elapsed).toBeLessThan(2000)
    // Response should track its own timing
    expect(data.ms).toBeLessThan(2000)
  })
})
