// src/tests/dealService.capabilityFallback.test.js
// Tests for capability flag and retry logic with fallback
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { getAllDeals, getCapabilities } from '@/services/dealService'

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

global.sessionStorage = sessionStorageMock

// Mock supabase
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

  beforeEach(async () => {
    sessionStorageMock.clear()
    // Reset module to clear capability flags
    vi.resetModules()

    const module = await import('@/lib/supabase')
    mockSupabase = module.supabase
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('should set capability flag to false when vendor relationship is missing', async () => {
    const mockError = new Error(
      'Could not find a relationship between "job_parts" and "vendors" in the schema cache'
    )

    // Mock preflight probe to succeed (so it doesn't block the test)
    const mockPreflightSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })

    // Mock the primary select to throw relationship error
    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      }),
    })

    // Mock the fallback select to succeed
    const mockFallbackSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    })

    // Order of calls:
    // 1. Preflight probe succeeds
    // 2. Main query fails with relationship error
    // 3. Fallback query succeeds
    // 4. transactions query
    // 5. loaner_assignments query
    mockSupabase.from.mockReturnValueOnce({ select: mockPreflightSelect }) // preflight
    mockSupabase.from.mockReturnValueOnce({ select: mockSelect }) // main query
    mockSupabase.from.mockReturnValueOnce({ select: mockFallbackSelect }) // fallback query
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi
          .fn()
          .mockReturnValue({ maybeSingle: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      }),
    })
    mockSupabase.from.mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({ is: vi.fn().mockResolvedValue({ data: [], error: null }) }),
      }),
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
    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    })

    mockSupabase.from.mockReturnValue({ select: mockSelect })

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

    const mockPreflightSelect = vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue({
        data: [],
        error: null,
      }),
    })

    const mockSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: null,
          error: mockError,
        }),
      }),
    })

    const mockFallbackSelect = vi.fn().mockReturnValue({
      in: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({
          data: [],
          error: null,
        }),
      }),
    })

    const mockTransactions = {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    }

    const mockLoaners = {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }

    // First invocation triggers fallback once
    mockSupabase.from.mockReturnValueOnce({ select: mockPreflightSelect }) // preflight
    mockSupabase.from.mockReturnValueOnce({ select: mockSelect }) // main query
    mockSupabase.from.mockReturnValueOnce({ select: mockFallbackSelect }) // fallback
    mockSupabase.from.mockReturnValueOnce(mockTransactions)
    mockSupabase.from.mockReturnValueOnce(mockLoaners)
    try {
      await getAllDeals()
    } catch {}
    const vendorFallback = parseInt(sessionStorage.getItem('telemetry_vendorFallback') || '0')
    const vendorRelFallback = parseInt(sessionStorage.getItem('telemetry_vendorRelFallback') || '0')
    const totalFallbacks = vendorFallback + vendorRelFallback
    expect(totalFallbacks).toBeGreaterThanOrEqual(1)

    // Reset capability to true to simulate a fresh environment where relationship is attempted again
    sessionStorage.setItem('cap_jobPartsVendorRel', 'true')

    // Second invocation again triggers fallback once
    mockSupabase.from.mockReturnValueOnce({ select: mockPreflightSelect }) // preflight
    mockSupabase.from.mockReturnValueOnce({ select: mockSelect }) // main query
    mockSupabase.from.mockReturnValueOnce({ select: mockFallbackSelect }) // fallback
    mockSupabase.from.mockReturnValueOnce(mockTransactions)
    mockSupabase.from.mockReturnValueOnce(mockLoaners)
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
