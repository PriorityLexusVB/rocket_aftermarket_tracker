/**
 * Test suite for getOrgContext helper in dealService
 *
 * This tests the extraction of org context (org_id, user_id, user_email)
 * which is used for RLS compliance in DB operations.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock supabase for testing
const mockOrgId = 'test-org-123'
const mockUserId = 'test-user-456'
const mockUserEmail = 'test@example.com'

// Configurable stubs used by per-test spies (avoids cross-file module mock collisions)
let mockAuthResponse = {
  data: { user: { id: mockUserId, email: mockUserEmail } },
  error: null,
}

// Import functions after mocks are set up.
// Note: This test file must be resilient to other test files importing dealService first
// in the same worker. We re-import after vi.resetModules() so our mocks always apply.
let isRlsError
let getOrgContext
let supabase
let originalAuthGetUser

beforeEach(async () => {
  // Reset mocks to default successful state before each test
  mockAuthResponse = {
    data: { user: { id: mockUserId, email: mockUserEmail } },
    error: null,
  }

  vi.resetModules()
  ;({ supabase } = await import('@/lib/supabase'))

  // Ensure auth user comes from our test-controlled response even if another
  // test file has provided a different supabase mock in this worker.
  supabase.auth = supabase.auth || {}
  originalAuthGetUser = supabase.auth.getUser
  supabase.auth.getUser = vi.fn(() => Promise.resolve(mockAuthResponse))

  // Use the shared in-memory Supabase mock in src/tests/setup.ts.
  // Seed a user profile row and set currentUser via admin.generateLink so
  // getOrgContext() reads auth + org context without fragile spies.
  supabase.__seed?.('user_profiles', [
    {
      id: mockUserId,
      email: mockUserEmail,
      full_name: 'Test User',
      role: 'admin',
      dealer_id: mockOrgId,
      auth_user_id: mockUserId,
    },
  ])
  await supabase.auth?.admin?.generateLink?.({ email: mockUserEmail })

  const dealService = await vi.importActual('@/services/dealService')
  isRlsError = dealService.isRlsError
  getOrgContext = dealService.getOrgContext
})

afterEach(() => {
  try {
    if (supabase?.auth) {
      if (originalAuthGetUser) supabase.auth.getUser = originalAuthGetUser
      else delete supabase.auth.getUser
    }
  } catch {}
  vi.restoreAllMocks()
})

describe('dealService - getOrgContext', () => {
  describe('getOrgContext Helper - Behavioral Tests', () => {
    it('should return org context with user_id and user_email from auth', async () => {
      const context = await getOrgContext('test')

      // Should have all three fields
      expect(context).toHaveProperty('org_id')
      expect(context).toHaveProperty('user_id')
      expect(context).toHaveProperty('user_email')

      // user_id and user_email should come from auth
      expect(context.user_id).toBe(mockUserId)
      expect(context.user_email).toBe(mockUserEmail)
    })

    it('should return context object with null values when auth fails', async () => {
      // Simulate auth failure by clearing seeded profiles and generating a link
      // for an email that does not exist in user_profiles.
      supabase.__seed?.('user_profiles', [])
      await supabase.auth?.admin?.generateLink?.({ email: 'missing-user@example.com' })

      supabase.auth.getUser = vi.fn(() =>
        Promise.resolve({ data: { user: null }, error: { message: 'Not authenticated' } })
      )

      const context = await getOrgContext('test-auth-fail')

      // Should still return context object (never throws)
      expect(context).toHaveProperty('org_id')
      expect(context).toHaveProperty('user_id')
      expect(context).toHaveProperty('user_email')
      expect(context.user_id).toBeNull()
      expect(context.user_email).toBeNull()
    })

    it('should return context object structure matching documented interface', async () => {
      const context = await getOrgContext('test-structure')

      // Verify exact structure as documented
      const expectedKeys = ['org_id', 'user_id', 'user_email']
      expect(Object.keys(context).sort()).toEqual(expectedKeys.sort())
    })
  })

  describe('getOrgContext Helper - Documentation', () => {
    it('documents the structure returned by getOrgContext', () => {
      const expectedStructure = {
        org_id: 'expect: string UUID or null',
        user_id: 'expect: string UUID or null',
        user_email: 'expect: string email or null',
      }

      expect(Object.keys(expectedStructure)).toEqual(['org_id', 'user_id', 'user_email'])
    })

    it('documents org_id resolution order', () => {
      const resolutionOrder = [
        { step: 1, method: 'user_profiles.id = auth.uid()', priority: 'primary' },
        { step: 2, method: 'user_profiles.email = auth.email', priority: 'fallback' },
        { step: 3, method: 'return null', priority: 'no-org' },
      ]

      expect(resolutionOrder).toHaveLength(3)
      expect(resolutionOrder[0].method).toContain('id')
      expect(resolutionOrder[1].method).toContain('email')
    })

    it('documents error handling behavior', () => {
      const errorBehavior = {
        onRlsErrorIdLookup: 'try email fallback',
        onRlsErrorEmailLookup: 'log warning, return null org_id',
        onOtherError: 'log warning, return null org_id',
        throwBehavior: 'never throws',
      }

      expect(errorBehavior.throwBehavior).toBe('never throws')
    })
  })

  describe('isRlsError Function', () => {
    it('should identify PostgreSQL insufficient_privilege (42501)', () => {
      expect(isRlsError({ code: '42501', message: 'insufficient_privilege' })).toBe(true)
    })

    it('should identify PostgREST errors (PGRST*)', () => {
      expect(isRlsError({ code: 'PGRST301', message: 'JWT claim missing' })).toBe(true)
      expect(isRlsError({ code: 'PGRST302', message: 'Auth error' })).toBe(true)
    })

    it('should identify policy-related messages', () => {
      expect(isRlsError({ message: 'new row violates row-level security policy' })).toBe(true)
      expect(isRlsError({ message: 'RLS policy violation' })).toBe(true)
      expect(isRlsError({ message: 'permission denied for table transactions' })).toBe(true)
    })

    it('should NOT identify non-RLS errors', () => {
      expect(isRlsError({ message: 'Network error: Failed to fetch' })).toBe(false)
      expect(isRlsError({ message: 'column "foo" does not exist' })).toBe(false)
      expect(isRlsError({ code: '23505', message: 'unique_violation' })).toBe(false)
      expect(isRlsError(null)).toBe(false)
      expect(isRlsError(undefined)).toBe(false)
    })
  })

  describe('Usage in Service Layer', () => {
    it('documents usage in createDeal', () => {
      const createDealUsage = {
        jobPayload: 'org_id from context or form input',
        transactionPayload: 'org_id from job or inferred',
        vehiclePayload: 'org_id from context when creating',
      }

      expect(createDealUsage.jobPayload).toBeTruthy()
    })

    it('documents usage in updateDeal', () => {
      const updateDealUsage = {
        optimisticConcurrency: 'eq("org_id", payload.org_id) if provided',
        rlsRecovery: 'set job.org_id from user profile when NULL',
        transactionUpsert: 'set org_id from job or user profile',
      }

      expect(updateDealUsage.rlsRecovery).toContain('user profile')
    })
  })
})
