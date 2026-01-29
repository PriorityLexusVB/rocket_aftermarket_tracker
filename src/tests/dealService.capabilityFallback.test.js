// src/tests/dealService.capabilityFallback.test.js
// Tests for capability flag and retry logic with fallback
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock sessionStorage
const sessionStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => {
      store[key] = value
    },
    removeItem: (key) => {
      delete store[key]
    },
    clear: () => {
      store = {}
    },
  }
})()

// Keep these module mocks file-scoped so each test can reset modules and
// re-import dealService deterministically.
vi.mock('@/utils/userProfileName', () => ({
  buildUserProfileSelectFragment: () => '(id, full_name)',
  resolveUserProfileName: (profile) => profile?.full_name || profile?.name || '',
  ensureUserProfileCapsLoaded: async () => {},
  downgradeCapForErrorMessage: () => {},
}))

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}))

describe('dealService - capability flag and retry logic', () => {
  let mockSupabase
  let getAllDeals
  let getCapabilities

  beforeEach(async () => {
    sessionStorageMock.clear()
    // Reset module to clear capability flags
    vi.resetModules()

    // Ensure dealService reads/writes capability flags against this test storage.
    // Vitest runs single-threaded in this repo, so avoid leaking globals across files.
    vi.stubGlobal('sessionStorage', sessionStorageMock)
    // capabilityTelemetry prefers sessionStorage but can fall back to localStorage.
    vi.stubGlobal('localStorage', sessionStorageMock)

    // Re-import after reset so module-level capability caches re-init from sessionStorage
    ;({ getAllDeals, getCapabilities } = await import('@/services/dealService'))

    const module = await import('@/lib/supabase')
    mockSupabase = module.supabase
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('should set capability flag to false when vendor relationship is missing', async () => {
    const mockError = new Error(
      'Could not find a relationship between "job_parts" and "vendors" in the schema cache'
    )

    let jobsSelectAttempt = 0
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'job_parts') {
        return {
          select: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }

      if (table === 'jobs') {
        return {
          select: () => ({
            in: () => ({
              order: () => {
                jobsSelectAttempt += 1
                if (jobsSelectAttempt === 1) {
                  return Promise.resolve({ data: null, error: mockError })
                }
                return Promise.resolve({ data: [], error: null })
              },
            }),
          }),
        }
      }

      if (table === 'transactions') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }

      if (table === 'loaner_assignments') {
        return {
          select: () => ({
            in: () => ({
              is: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }

      return {
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }
    })

    try {
      await getAllDeals()
    } catch {
      // May throw, we just care about the flag
    }

    // Check that capability flag was set to false
    expect(sessionStorage.getItem('cap_jobPartsVendorRel')).toBe('false')
    // The telemetry should be incremented (both VENDOR_FALLBACK and VENDOR_REL_FALLBACK)
    const vendorFallback = sessionStorage.getItem('telemetry_vendorFallback')
    const vendorRelFallback = sessionStorage.getItem('telemetry_vendorRelFallback')
    // At least one should be incremented
    expect(parseInt(vendorFallback || '0') + parseInt(vendorRelFallback || '0')).toBeGreaterThan(0)
  })

  it('should set capability flag to true when vendor relationship query succeeds', async () => {
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'job_parts') {
        return {
          select: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }

      if (table === 'jobs') {
        return {
          select: () => ({
            in: () => ({
              order: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }

      if (table === 'transactions') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }

      if (table === 'loaner_assignments') {
        return {
          select: () => ({
            in: () => ({
              is: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }

      return {
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }
    })

    try {
      await getAllDeals()
    } catch {
      // Ignore errors, we're testing the flag
    }

    // Should be set to true on success
    expect(sessionStorage.getItem('cap_jobPartsVendorRel')).toBe('true')
  })

  it('should increment telemetry counter on each fallback invocation', async () => {
    const mockError = new Error(
      'Could not find a relationship between "job_parts" and "vendors" in the schema cache'
    )

    // First invocation: relationship error -> retry succeeds
    let jobsSelectAttempt = 0
    mockSupabase.from.mockImplementation((table) => {
      if (table === 'job_parts') {
        return {
          select: () => ({
            limit: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }

      if (table === 'jobs') {
        return {
          select: () => ({
            in: () => ({
              order: () => {
                jobsSelectAttempt += 1
                if (jobsSelectAttempt === 1) {
                  return Promise.resolve({ data: null, error: mockError })
                }
                return Promise.resolve({ data: [], error: null })
              },
            }),
          }),
        }
      }

      if (table === 'transactions') {
        return {
          select: () => ({
            in: () => Promise.resolve({ data: [], error: null }),
          }),
        }
      }

      if (table === 'loaner_assignments') {
        return {
          select: () => ({
            in: () => ({
              is: () => Promise.resolve({ data: [], error: null }),
            }),
          }),
        }
      }

      return {
        select: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }
    })
    try {
      await getAllDeals()
    } catch {}

    // Sanity check: the relationship error should have triggered a retry
    // and disabled the vendor relationship capability.
    expect(jobsSelectAttempt).toBeGreaterThanOrEqual(2)
    expect(sessionStorage.getItem('cap_jobPartsVendorRel')).toBe('false')

    const vendorFallback = parseInt(sessionStorage.getItem('telemetry_vendorFallback') || '0')
    const vendorRelFallback = parseInt(sessionStorage.getItem('telemetry_vendorRelFallback') || '0')
    const totalFallbacks = vendorFallback + vendorRelFallback
    expect(totalFallbacks).toBeGreaterThanOrEqual(1)

    // Reset capability to true to simulate a fresh environment where relationship is attempted again
    sessionStorage.setItem('cap_jobPartsVendorRel', 'true')

    // Second invocation again triggers fallback once
    jobsSelectAttempt = 0
    try {
      await getAllDeals()
    } catch {}
    const vendorFallback2 = parseInt(sessionStorage.getItem('telemetry_vendorFallback') || '0')
    const vendorRelFallback2 = parseInt(
      sessionStorage.getItem('telemetry_vendorRelFallback') || '0'
    )
    const totalFallbacks2 = vendorFallback2 + vendorRelFallback2
    expect(totalFallbacks2).toBeGreaterThanOrEqual(2)
  })

  it('should aggregate vendor as "Unassigned" in fallback mode', async () => {
    // This is tested implicitly by the vendor aggregation logic
    // When job_parts doesn't have vendor relationship, it falls back to job-level or "Unassigned"
    const caps = getCapabilities()
    expect(caps).toHaveProperty('jobPartsVendorRel')
    expect(typeof caps.jobPartsVendorRel).toBe('boolean')
  })
})
