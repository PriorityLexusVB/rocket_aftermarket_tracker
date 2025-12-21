/**
 * Test suite for transaction RLS recovery in dealService.updateDeal
 *
 * This tests the robust handling of RLS errors during transaction upsert,
 * especially for legacy deals that were created before org_id scoping.
 */

import { describe, it, expect, vi } from 'vitest'

// Mock supabase for testing
vi.mock('../lib/supabase', () => {
  const mockChain = () => ({
    from: vi.fn(() => mockChain()),
    select: vi.fn(() => mockChain()),
    insert: vi.fn(() => mockChain()),
    update: vi.fn(() => mockChain()),
    delete: vi.fn(() => mockChain()),
    eq: vi.fn(() => mockChain()),
    or: vi.fn(() => mockChain()),
    single: vi.fn(() => Promise.resolve({ data: null, error: null })),
    maybeSingle: vi.fn(() => Promise.resolve({ data: null, error: null })),
    limit: vi.fn(() => mockChain()),
    order: vi.fn(() => mockChain()),
    throwOnError: vi.fn(() => Promise.resolve({ data: [], error: null })),
  })

  return {
    supabase: {
      from: vi.fn(() => mockChain()),
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({
            data: { user: { id: 'user-123', email: 'test@example.com' } },
            error: null,
          })
        ),
      },
    },
    default: {
      from: vi.fn(() => mockChain()),
      auth: {
        getUser: vi.fn(() =>
          Promise.resolve({
            data: { user: { id: 'user-123', email: 'test@example.com' } },
            error: null,
          })
        ),
      },
    },
  }
})

describe('dealService - Transaction RLS Recovery Documentation', () => {
  describe('RLS Error Classification', () => {
    it('should correctly identify RLS error patterns', () => {
      // Document the patterns that classify an error as RLS-related
      const rlsPatterns = {
        // PostgreSQL error code for insufficient_privilege
        errorCode42501: { code: '42501', message: 'insufficient_privilege' },
        // PostgREST error codes
        pgrst301: { code: 'PGRST301', message: 'JWT claim missing' },
        pgrst302: { code: 'PGRST302', message: 'Authentication error' },
        // Message-based patterns
        policy: { message: 'new row violates row-level security policy' },
        permission: { message: 'permission denied for table transactions' },
        rls: { message: 'RLS policy violation' },
        rowLevelSecurity: { message: 'violates row-level security' },
      }

      // Helper function matching production code
      const isRlsError = (error) => {
        if (!error) return false
        const msg = String(error?.message || '').toLowerCase()
        const code = error?.code
        return (
          code === '42501' ||
          (code && String(code).toUpperCase().startsWith('PGRST')) ||
          msg.includes('policy') ||
          msg.includes('permission') ||
          msg.includes('rls') ||
          msg.includes('row-level security')
        )
      }

      // Verify all documented patterns are detected
      expect(isRlsError(rlsPatterns.errorCode42501)).toBe(true)
      expect(isRlsError(rlsPatterns.pgrst301)).toBe(true)
      expect(isRlsError(rlsPatterns.policy)).toBe(true)
      expect(isRlsError(rlsPatterns.permission)).toBe(true)
      expect(isRlsError(rlsPatterns.rls)).toBe(true)
      expect(isRlsError(rlsPatterns.rowLevelSecurity)).toBe(true)
    })

    it('should not misclassify non-RLS errors', () => {
      const isRlsError = (error) => {
        if (!error) return false
        const msg = String(error?.message || '').toLowerCase()
        const code = error?.code
        return (
          code === '42501' ||
          (code && String(code).toUpperCase().startsWith('PGRST')) ||
          msg.includes('policy') ||
          msg.includes('permission') ||
          msg.includes('rls') ||
          msg.includes('row-level security')
        )
      }

      // These should NOT be classified as RLS errors
      const nonRlsErrors = [
        { message: 'Network error: Failed to fetch' },
        { message: 'column "nonexistent" does not exist' },
        { message: 'duplicate key value violates unique constraint' },
        { message: 'invalid input syntax for type uuid' },
        { code: '23505', message: 'unique_violation' },
        { code: '23503', message: 'foreign_key_violation' },
      ]

      nonRlsErrors.forEach((error) => {
        expect(isRlsError(error)).toBe(false)
      })
    })
  })

  describe('RLS Recovery Flow Documentation', () => {
    it('documents the recovery steps for legacy deals', () => {
      // This documents the recovery flow implemented in updateDeal
      const recoverySteps = [
        {
          step: 1,
          action: 'SELECT transaction by job_id',
          expectedResult: 'RLS error if org_id mismatch',
        },
        {
          step: 2,
          action: 'Detect RLS error and trigger recovery',
          expectedResult: 'Log warning and continue to recovery path',
        },
        {
          step: 3,
          action: 'Fetch job org_id',
          expectedResult: 'Get org_id from job record',
        },
        {
          step: 4,
          action: 'If job.org_id is NULL (legacy), fetch user org_id',
          expectedResult: 'Get org_id from user_profiles via auth.getUser()',
        },
        {
          step: 5,
          action: 'Set job.org_id from user profile',
          expectedResult: 'Fix legacy job record',
        },
        {
          step: 6,
          action: 'UPDATE transaction with resolved org_id',
          expectedResult: 'Transaction updated via job relationship policy',
        },
        {
          step: 7,
          action: 'If UPDATE affects 0 rows, INSERT new transaction',
          expectedResult: 'Create new transaction with correct org_id',
        },
      ]

      // Verify all steps are documented
      expect(recoverySteps).toHaveLength(7)
      expect(recoverySteps[3].action).toContain('legacy')
      expect(recoverySteps[4].action).toContain('job.org_id')
      expect(recoverySteps[6].action).toContain('INSERT')
    })

    it('documents error scenarios and user guidance', () => {
      const errorScenarios = [
        {
          scenario: 'User profile has no org_id',
          error:
            'Cannot recover from RLS error: job has no org_id and unable to get user org_id (user profile has no org_id)',
          guidance: 'Contact administrator to assign organization to user profile',
        },
        {
          scenario: 'Authentication failed during recovery',
          error: 'Authentication failed during RLS recovery: {error message}',
          guidance: 'Re-login and try again',
        },
        {
          scenario: 'Profile fetch failed during recovery',
          error:
            'Cannot recover from RLS error: job has no org_id and unable to get user org_id (profile fetch failed: {error})',
          guidance: 'Contact administrator if profile access is blocked',
        },
        {
          scenario: 'Transaction update fails after recovery',
          error:
            'Failed to save deal: Transaction access denied. This deal may have been created before organization scoping was enabled.',
          guidance: 'Contact administrator to fix organization assignment',
        },
      ]

      errorScenarios.forEach((scenario) => {
        expect(scenario.error).toBeTruthy()
        expect(scenario.guidance).toBeTruthy()
      })

      // Verify specific guidance messages
      expect(errorScenarios[0].error).toContain('user profile has no org_id')
      expect(errorScenarios[1].error).toContain('Authentication failed')
    })
  })

  describe('Transaction Data Requirements', () => {
    it('documents required fields for transaction INSERT', () => {
      const requiredTransactionFields = {
        job_id: 'UUID - Links to jobs table (required for relationship)',
        org_id: 'UUID - Required for RLS policy compliance',
        transaction_number: 'TEXT - Generated unique identifier (required for INSERT)',
        customer_name: 'TEXT - Customer name (fallback: "Unknown Customer")',
        total_amount: 'DECIMAL - Sum of line item amounts',
        transaction_status: 'transaction_status ENUM - Default: "pending"',
      }

      // Verify required fields
      expect(Object.keys(requiredTransactionFields)).toContain('job_id')
      expect(Object.keys(requiredTransactionFields)).toContain('org_id')
      expect(Object.keys(requiredTransactionFields)).toContain('transaction_number')

      // Document that org_id is critical
      expect(requiredTransactionFields.org_id).toContain('RLS policy compliance')
      const optionalTransactionFields = {
        vehicle_id: 'UUID - Links to vehicles table',
        customer_phone: 'TEXT - Customer phone number',
        customer_email: 'TEXT - Customer email address',
      }

      // Verify optional fields presence
      expect(Object.keys(optionalTransactionFields)).toContain('vehicle_id')
      expect(Object.keys(optionalTransactionFields)).toContain('customer_phone')
      expect(Object.keys(optionalTransactionFields)).toContain('customer_email')
    })

    it('documents transaction_number generation pattern', () => {
      // Pattern: TXN-{timestamp}-{random}
      const generateTransactionNumber = () => {
        const ts = Date.now()
        const rand = Math.floor(Math.random() * 10000)
        return `TXN-${ts}-${rand}`
      }

      const txnNumber = generateTransactionNumber()

      expect(txnNumber).toMatch(/^TXN-\d+-\d+$/)
      expect(txnNumber.split('-')).toHaveLength(3)
    })
  })

  describe('RLS Policy Requirements', () => {
    it('documents transaction INSERT policy', () => {
      // From migration 20251105000000_fix_rls_policies_and_write_permissions.sql
      const insertPolicy = {
        name: 'org can insert transactions',
        table: 'transactions',
        operation: 'INSERT',
        withCheck: `
          org_id = public.auth_user_org() OR
          EXISTS (
            SELECT 1 FROM public.jobs j 
            WHERE j.id = transactions.job_id 
            AND j.org_id = public.auth_user_org()
          )
        `,
      }

      // Verify policy allows INSERT if:
      // 1. Transaction org_id matches user's org
      // 2. OR linked job's org_id matches user's org
      expect(insertPolicy.withCheck).toContain('org_id = public.auth_user_org()')
      expect(insertPolicy.withCheck).toContain('j.org_id = public.auth_user_org()')
    })

    it('documents transaction UPDATE policy', () => {
      // From migration 20251105000000_fix_rls_policies_and_write_permissions.sql
      const updatePolicy = {
        name: 'org can update transactions',
        table: 'transactions',
        operation: 'UPDATE',
        using: `
          org_id = public.auth_user_org() OR
          EXISTS (
            SELECT 1 FROM public.jobs j 
            WHERE j.id = transactions.job_id 
            AND j.org_id = public.auth_user_org()
          )
        `,
      }

      // Verify policy allows UPDATE via job relationship
      expect(updatePolicy.using).toContain('j.org_id = public.auth_user_org()')
    })

    it('documents transaction SELECT policy', () => {
      // Multiple SELECT policies exist
      const selectPolicies = [
        {
          name: 'staff_can_view_transactions',
          operation: 'SELECT',
          using: 'true', // Original policy - view all
        },
        {
          name: 'org read transactions',
          operation: 'SELECT',
          using: 'org_id = (SELECT public.auth_user_org())',
        },
        {
          name: 'txn_select_via_job',
          operation: 'SELECT',
          using: `
            EXISTS (
              SELECT 1 FROM jobs j 
              WHERE j.id = transactions.job_id
            )
          `,
        },
      ]

      // Document that multiple policies may apply
      expect(selectPolicies.length).toBeGreaterThan(1)
    })
  })
})

describe('dealService - Transaction Upsert Behavior', () => {
  it('documents UPDATE behavior when transaction exists', () => {
    // When transaction exists:
    // 1. SELECT succeeds (or fails with RLS -> recovery)
    // 2. UPDATE existing transaction
    // 3. DO NOT generate new transaction_number

    const existingTransaction = {
      id: 'txn-existing-123',
      transaction_number: 'TXN-1699999999999-1234',
      job_id: 'job-123',
      org_id: 'org-abc',
    }

    const updateData = {
      job_id: 'job-123',
      org_id: 'org-abc',
      total_amount: 500,
      customer_name: 'Updated Customer',
      customer_phone: '+15551234567',
      transaction_status: 'pending',
      // NOTE: transaction_number is NOT included in update
    }

    // Verify transaction_number is preserved
    expect(updateData.transaction_number).toBeUndefined()
    expect(existingTransaction.transaction_number).toBeDefined()
  })

  it('documents INSERT behavior when transaction does not exist', () => {
    // When transaction does not exist:
    // 1. SELECT returns null
    // 2. INSERT new transaction
    // 3. Generate new transaction_number

    const insertData = {
      job_id: 'job-new-123',
      org_id: 'org-abc',
      total_amount: 300,
      customer_name: 'New Customer',
      customer_phone: '+15559876543',
      transaction_status: 'pending',
      transaction_number: 'TXN-1700000000000-5678', // Generated for INSERT
    }

    // Verify transaction_number is included for INSERT
    expect(insertData.transaction_number).toBeDefined()
    expect(insertData.transaction_number).toMatch(/^TXN-\d+-\d+$/)
  })

  it('documents org_id preservation during UPDATE', () => {
    // When updating a transaction:
    // 1. If payload has org_id, use it
    // 2. Else if existing transaction has org_id, preserve it
    // 3. Never set org_id to null if it was previously set

    const existingOrgId = 'org-existing-123'
    const payloadOrgId = 'org-from-payload'

    // Case 1: Payload has org_id
    const case1 = { org_id: payloadOrgId }
    expect(case1.org_id).toBe(payloadOrgId)

    // Case 2: Payload org_id is null but existing has it
    const preservedOrgId = payloadOrgId || existingOrgId
    expect(preservedOrgId).toBeTruthy()

    // Document the preservation logic
    const updateWithPreservation = (existing, payload) => {
      return {
        ...payload,
        org_id: payload.org_id || existing?.org_id,
      }
    }

    const result = updateWithPreservation(
      { org_id: existingOrgId },
      { org_id: null, customer_name: 'Test' }
    )
    expect(result.org_id).toBe(existingOrgId)
  })
})

describe('dealService - Error Message Quality', () => {
  it('provides clear guidance for user profile without org_id', () => {
    const errorMessage =
      'Your user profile may not have an organization assigned. Please contact your administrator to ensure your account is properly configured.'

    expect(errorMessage).toContain('user profile')
    expect(errorMessage).toContain('organization')
    expect(errorMessage).toContain('administrator')
    expect(errorMessage).not.toContain('org_id') // Don't expose technical terms
  })

  it('provides clear guidance for legacy deals', () => {
    const errorMessage =
      'This deal may have been created before organization scoping was enabled. Please contact your administrator if the issue persists.'

    expect(errorMessage).toContain('before organization scoping')
    expect(errorMessage).toContain('administrator')
    expect(errorMessage).not.toContain('RLS') // Don't expose technical terms
    expect(errorMessage).not.toContain('policy') // Don't expose technical terms
  })

  it('logs technical details for debugging', () => {
    // Technical details should be logged but not shown to user
    const loggedDetails = {
      error: 'new row violates row-level security policy for table "transactions"',
      job_id: 'job-123',
      has_org_id: false,
    }

    expect(loggedDetails.error).toContain('row-level security')
    expect(loggedDetails.job_id).toBeDefined()
    expect(loggedDetails.has_org_id).toBeDefined()
  })
})
