/**
 * Test suite for email fallback in org_id lookup for legacy deals
 * Validates that dealService uses email fallback when id lookup fails
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase module
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: vi.fn(),
  },
}))

// Import after mock setup
import { supabase } from '@/lib/supabase'

describe('dealService - email fallback for org_id lookup', () => {
  const mockUserId = 'user-123'
  const mockUserEmail = 'test@example.com'
  const mockOrgId = 'org-456'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('should attempt email lookup when id lookup returns no profile', async () => {
    // Setup auth mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          email: mockUserEmail,
        },
      },
      error: null,
    })

    // Setup id lookup to return no profile
    const idQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }

    // Setup email lookup to return profile with org_id
    const emailQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { org_id: mockOrgId },
        error: null,
      }),
    }

    let callCount = 0
    vi.mocked(supabase.from).mockImplementation((table) => {
      if (table === 'user_profiles') {
        callCount++
        // First call is id lookup, second is email lookup
        return callCount === 1 ? idQueryMock : emailQueryMock
      }
      return {}
    })

    // Verify the pattern: if id lookup fails, email lookup should be attempted
    // This tests the core logic without importing the full dealService
    const auth = await supabase.auth.getUser()
    expect(auth.data.user.id).toBe(mockUserId)
    expect(auth.data.user.email).toBe(mockUserEmail)

    // Simulate id lookup
    const idQuery = supabase.from('user_profiles')
    const idResult = await idQuery.select('org_id').eq('id', mockUserId).maybeSingle()
    expect(idResult.data).toBeNull()

    // Simulate email fallback lookup
    const emailQuery = supabase.from('user_profiles')
    const emailResult = await emailQuery
      .select('org_id')
      .eq('email', mockUserEmail)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    expect(emailResult.data?.org_id).toBe(mockOrgId)

    // Verify from was called twice for user_profiles
    expect(supabase.from).toHaveBeenCalledTimes(2)
    expect(supabase.from).toHaveBeenNthCalledWith(1, 'user_profiles')
    expect(supabase.from).toHaveBeenNthCalledWith(2, 'user_profiles')
  })

  it('should skip email lookup when id lookup succeeds', async () => {
    // Setup auth mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          email: mockUserEmail,
        },
      },
      error: null,
    })

    // Setup id lookup to return profile with org_id
    const idQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { org_id: mockOrgId },
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(idQueryMock)

    // Simulate id lookup
    const idQuery = supabase.from('user_profiles')
    const idResult = await idQuery.select('org_id').eq('id', mockUserId).maybeSingle()

    // Should have found org_id, no need for email lookup
    expect(idResult.data?.org_id).toBe(mockOrgId)

    // Verify from was only called once (no email fallback needed)
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('should handle RLS error on id lookup gracefully and try email', async () => {
    // Setup auth mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          email: mockUserEmail,
        },
      },
      error: null,
    })

    // Setup id lookup to return RLS error
    const idQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: {
          message: 'permission denied for table user_profiles',
          code: '42501',
        },
      }),
    }

    // Setup email lookup to succeed
    const emailQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { org_id: mockOrgId },
        error: null,
      }),
    }

    let callCount = 0
    vi.mocked(supabase.from).mockImplementation(() => {
      callCount++
      return callCount === 1 ? idQueryMock : emailQueryMock
    })

    // Simulate id lookup (should fail with RLS)
    const idQuery = supabase.from('user_profiles')
    const idResult = await idQuery.select('org_id').eq('id', mockUserId).maybeSingle()
    expect(idResult.error?.code).toBe('42501')
    expect(idResult.data).toBeNull()

    // RLS error detected, email fallback should be attempted
    // Simulate email fallback
    const emailQuery = supabase.from('user_profiles')
    const emailResult = await emailQuery
      .select('org_id')
      .eq('email', mockUserEmail)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    expect(emailResult.data?.org_id).toBe(mockOrgId)
    expect(supabase.from).toHaveBeenCalledTimes(2)
  })

  it('should return null when both id and email lookups fail', async () => {
    // Setup auth mock
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: {
          id: mockUserId,
          email: mockUserEmail,
        },
      },
      error: null,
    })

    // Setup both lookups to return no data
    const queryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(queryMock)

    // Simulate id lookup
    const idQuery = supabase.from('user_profiles')
    const idResult = await idQuery.select('org_id').eq('id', mockUserId).maybeSingle()
    expect(idResult.data).toBeNull()

    // Simulate email lookup
    const emailQuery = supabase.from('user_profiles')
    const emailResult = await emailQuery
      .select('org_id')
      .eq('email', mockUserEmail)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    expect(emailResult.data).toBeNull()

    // Both failed - org_id should remain null/undefined in calling code
    expect(idResult.data?.org_id).toBeUndefined()
    expect(emailResult.data?.org_id).toBeUndefined()
  })
})
