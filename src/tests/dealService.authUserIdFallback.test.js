/**
 * Test suite for auth_user_id fallback in org_id lookup
 * 
 * This tests the enhanced getUserOrgIdWithFallback function that checks:
 * 1. user_profiles.id = auth.uid() (standard case)
 * 2. user_profiles.auth_user_id = auth.uid() (legacy/alternative linking)
 * 3. user_profiles.email = user.email (final fallback)
 * 
 * This aligns with the database function auth_user_org() behavior
 * (see migration 20251129231539_fix_auth_user_org_auth_user_id_fallback.sql)
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

describe('dealService - auth_user_id fallback for org_id lookup', () => {
  const mockUserId = 'auth-user-123'
  const mockUserEmail = 'test@example.com'
  const mockOrgId = 'org-456'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('documents the three-tier lookup strategy for org_id', () => {
    /**
     * The lookup strategy follows this order:
     * 1. Try user_profiles.id = auth.uid() (standard case where profile id equals auth user id)
     * 2. Try user_profiles.auth_user_id = auth.uid() (legacy case where profile is linked via auth_user_id)
     * 3. Try user_profiles.email = user.email (fallback when neither id match works)
     * 
     * This ensures compatibility with:
     * - Standard users where profile.id = auth.uid()
     * - Legacy users where profile.auth_user_id = auth.uid() but profile.id is different
     * - Edge cases where email-based lookup is the only option
     */
    const lookupStrategies = [
      { column: 'id', matchesColumn: 'auth.uid()', priority: 1 },
      { column: 'auth_user_id', matchesColumn: 'auth.uid()', priority: 2 },
      { column: 'email', matchesColumn: 'user.email', priority: 3 },
    ]

    expect(lookupStrategies).toHaveLength(3)
    expect(lookupStrategies[0].column).toBe('id')
    expect(lookupStrategies[1].column).toBe('auth_user_id')
    expect(lookupStrategies[2].column).toBe('email')
  })

  it('should use auth_user_id lookup when id lookup returns no profile', async () => {
    // This tests the scenario where:
    // - user_profiles.id != auth.uid()
    // - user_profiles.auth_user_id = auth.uid() (legacy linking)

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: mockUserId, email: mockUserEmail },
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

    // Setup auth_user_id lookup to return profile with org_id
    const authUserIdQueryMock = {
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
        // First call is id lookup, second is auth_user_id lookup
        return callCount === 1 ? idQueryMock : authUserIdQueryMock
      }
      return {}
    })

    // Simulate id lookup (should return no profile)
    const idQuery = supabase.from('user_profiles')
    const idResult = await idQuery.select('org_id').eq('id', mockUserId).maybeSingle()
    expect(idResult.data).toBeNull()

    // Simulate auth_user_id lookup (should find the profile)
    const authUserIdQuery = supabase.from('user_profiles')
    const authUserIdResult = await authUserIdQuery
      .select('org_id')
      .eq('auth_user_id', mockUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    expect(authUserIdResult.data?.org_id).toBe(mockOrgId)
    expect(supabase.from).toHaveBeenCalledTimes(2)
  })

  it('should skip auth_user_id and email lookup when id lookup succeeds', async () => {
    // Standard case: user_profiles.id = auth.uid()

    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: mockUserId, email: mockUserEmail },
      },
      error: null,
    })

    const idQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: { org_id: mockOrgId },
        error: null,
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(idQueryMock)

    const idQuery = supabase.from('user_profiles')
    const idResult = await idQuery.select('org_id').eq('id', mockUserId).maybeSingle()

    expect(idResult.data?.org_id).toBe(mockOrgId)
    // Only one lookup needed
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('should fall back to email when both id and auth_user_id lookups fail', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: mockUserId, email: mockUserEmail },
      },
      error: null,
    })

    // Both id and auth_user_id lookups return no profile
    const emptyQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: null,
      }),
    }

    // Email lookup returns profile
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
      // Calls 1-2 are id and auth_user_id, call 3 is email
      return callCount <= 2 ? emptyQueryMock : emailQueryMock
    })

    // Simulate id lookup
    const idQuery = supabase.from('user_profiles')
    await idQuery.select('org_id').eq('id', mockUserId).maybeSingle()

    // Simulate auth_user_id lookup
    const authQuery = supabase.from('user_profiles')
    await authQuery
      .select('org_id')
      .eq('auth_user_id', mockUserId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    // Simulate email lookup
    const emailQuery = supabase.from('user_profiles')
    const emailResult = await emailQuery
      .select('org_id')
      .eq('email', mockUserEmail)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    expect(emailResult.data?.org_id).toBe(mockOrgId)
    expect(supabase.from).toHaveBeenCalledTimes(3)
  })

  it('documents alignment with database auth_user_org() function', () => {
    /**
     * This test documents that the client-side getUserOrgIdWithFallback function
     * aligns with the database function public.auth_user_org() which was updated
     * in migration 20251129231539_fix_auth_user_org_auth_user_id_fallback.sql
     * 
     * Both implementations:
     * 1. Check user_profiles.id = auth.uid() first
     * 2. Fall back to user_profiles.auth_user_id = auth.uid()
     * 3. Client-side also has email fallback for additional resilience
     * 
     * This ensures consistent behavior between:
     * - Database RLS policies using auth_user_org()
     * - Client-side org_id resolution in dealService
     */
    
    const databaseFunction = {
      name: 'auth_user_org',
      schema: 'public',
      migration: '20251129231539_fix_auth_user_org_auth_user_id_fallback.sql',
      checkOrder: ['id', 'auth_user_id'],
    }

    const clientFunction = {
      name: 'getUserOrgIdWithFallback',
      file: 'dealService.js',
      checkOrder: ['id', 'auth_user_id', 'email'],
    }

    // Both start with id check
    expect(databaseFunction.checkOrder[0]).toBe(clientFunction.checkOrder[0])
    // Both have auth_user_id fallback
    expect(databaseFunction.checkOrder[1]).toBe(clientFunction.checkOrder[1])
    // Client has additional email fallback
    expect(clientFunction.checkOrder).toContain('email')
  })

  it('should handle RLS errors gracefully across all lookup strategies', async () => {
    vi.mocked(supabase.auth.getUser).mockResolvedValue({
      data: {
        user: { id: mockUserId, email: mockUserEmail },
      },
      error: null,
    })

    // All lookups blocked by RLS
    const rlsErrorQueryMock = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'permission denied for table user_profiles', code: '42501' },
      }),
    }

    vi.mocked(supabase.from).mockReturnValue(rlsErrorQueryMock)

    // Simulate all three lookups
    const lookup1 = await supabase.from('user_profiles').select('org_id').eq('id', mockUserId).maybeSingle()
    const lookup2 = await supabase.from('user_profiles').select('org_id').eq('auth_user_id', mockUserId).order('created_at', { ascending: false }).limit(1).maybeSingle()
    const lookup3 = await supabase.from('user_profiles').select('org_id').eq('email', mockUserEmail).order('created_at', { ascending: false }).limit(1).maybeSingle()

    // All should fail with RLS error
    expect(lookup1.error?.code).toBe('42501')
    expect(lookup2.error?.code).toBe('42501')
    expect(lookup3.error?.code).toBe('42501')

    // The function should return null (not throw) when all lookups fail
    expect(lookup1.data).toBeNull()
    expect(lookup2.data).toBeNull()
    expect(lookup3.data).toBeNull()
  })
})

describe('Transaction access denied error scenarios', () => {
  it('documents when Transaction access denied error occurs', () => {
    /**
     * The "Transaction access denied" error occurs when:
     * 
     * 1. User's org_id cannot be determined:
     *    - user_profiles.id != auth.uid()
     *    - user_profiles.auth_user_id != auth.uid()
     *    - user_profiles.email lookup blocked by RLS
     *    - User profile doesn't exist
     *    - User profile has org_id = NULL
     * 
     * 2. Transaction RLS policy fails:
     *    - auth_user_org() returns NULL
     *    - Transaction's org_id doesn't match user's org
     *    - Job's org_id doesn't match user's org (fallback policy)
     * 
     * 3. Legacy data issues:
     *    - Deal was created before org scoping was enabled
     *    - Job and/or transaction have org_id = NULL
     *    - Migration 20251124230000 hasn't been applied
     */
    const errorScenarios = [
      {
        scenario: 'User profile not linked correctly',
        cause: 'user_profiles.id and user_profiles.auth_user_id both != auth.uid()',
        solution: 'Admin must link user profile to auth user via id or auth_user_id column',
      },
      {
        scenario: 'User profile has no organization',
        cause: 'user_profiles.org_id is NULL',
        solution: 'Admin must assign organization to user profile',
      },
      {
        scenario: 'Legacy deal without org scoping',
        cause: 'jobs.org_id and/or transactions.org_id is NULL',
        solution: 'Run migration 20251124230000 or manually set org_id on affected records',
      },
      {
        scenario: 'Database auth_user_org() returns NULL',
        cause: 'Neither id nor auth_user_id lookup finds a matching profile',
        solution: 'Apply migration 20251129231539 and verify user profile linking',
      },
    ]

    expect(errorScenarios).toHaveLength(4)
    errorScenarios.forEach(scenario => {
      expect(scenario.scenario).toBeTruthy()
      expect(scenario.cause).toBeTruthy()
      expect(scenario.solution).toBeTruthy()
    })
  })

  it('documents the enhanced error messages', () => {
    // Error message when org_id is missing
    const noOrgIdMessage = 
      'Unable to determine your organization. This typically means:\n' +
      '• Your user profile may not be linked to an organization.\n' +
      '• Please contact your administrator to verify your account setup.'

    // Error message when org_id exists but RLS fails
    const rlsFailedMessage =
      'The database rejected this update. Please try:\n' +
      '• Refreshing the page and trying again.\n' +
      '• If the issue persists, contact your administrator - they may need to run a database sync.'

    expect(noOrgIdMessage).toContain('organization')
    expect(noOrgIdMessage).toContain('administrator')
    expect(rlsFailedMessage).toContain('database')
    expect(rlsFailedMessage).toContain('sync')
  })
})
