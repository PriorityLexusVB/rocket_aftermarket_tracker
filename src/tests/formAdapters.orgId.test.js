/**
 * Test suite for org_id preservation in form adapters
 * Validates that org_id is preserved through the adapter layer for RLS compliance
 */

import { describe, it, expect } from 'vitest'
import {
  entityToDraft,
  draftToCreatePayload,
  draftToUpdatePayload,
} from '../components/deals/formAdapters'

describe('formAdapters - org_id preservation', () => {
  it('draftToCreatePayload should preserve org_id', () => {
    const draft = {
      customer_name: 'John Doe',
      job_number: 'JOB-123',
      org_id: '123e4567-e89b-12d3-a456-426614174000',
      lineItems: [],
    }

    const payload = draftToCreatePayload(draft)

    expect(payload.org_id).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(payload.org_id).toBeDefined()
    expect(payload.org_id).not.toBeNull()
  })

  it('draftToUpdatePayload should preserve org_id', () => {
    const original = { id: 'deal-1' }
    const draft = {
      customer_name: 'John Doe',
      job_number: 'JOB-123',
      org_id: '123e4567-e89b-12d3-a456-426614174000',
      lineItems: [],
    }

    const payload = draftToUpdatePayload(original, draft)

    expect(payload.org_id).toBe('123e4567-e89b-12d3-a456-426614174000')
    expect(payload.org_id).toBeDefined()
    expect(payload.org_id).not.toBeNull()
  })

  it('draftToCreatePayload should handle missing org_id gracefully', () => {
    const draft = {
      customer_name: 'John Doe',
      job_number: 'JOB-123',
      lineItems: [],
    }

    const payload = draftToCreatePayload(draft)

    // org_id should be undefined (not stripped), allowing fallback logic in service layer
    expect(payload.org_id).toBeUndefined()
  })

  it('draftToUpdatePayload should handle missing org_id gracefully', () => {
    const original = { id: 'deal-1' }
    const draft = {
      customer_name: 'John Doe',
      job_number: 'JOB-123',
      lineItems: [],
    }

    const payload = draftToUpdatePayload(original, draft)

    // org_id should be undefined (not stripped), allowing fallback logic in service layer
    expect(payload.org_id).toBeUndefined()
  })

  it('draftToCreatePayload should not strip org_id when null', () => {
    const draft = {
      customer_name: 'John Doe',
      job_number: 'JOB-123',
      org_id: null,
      lineItems: [],
    }

    const payload = draftToCreatePayload(draft)

    // org_id should be explicitly null if provided as null
    expect(payload.org_id).toBeNull()
  })

  it('entityToDraft should preserve org_id from entity', () => {
    const entity = {
      id: 'job-123',
      org_id: '123e4567-e89b-12d3-a456-426614174000',
      job_number: 'JOB-123',
      customer_name: 'John Doe',
      job_parts: [],
    }

    const draft = entityToDraft(entity)

    expect(draft.org_id).toBe('123e4567-e89b-12d3-a456-426614174000')
  })

  it('entityToDraft should handle null org_id gracefully', () => {
    const entity = {
      id: 'job-123',
      org_id: null,
      job_number: 'JOB-123',
      job_parts: [],
    }

    const draft = entityToDraft(entity)

    expect(draft.org_id).toBeNull()
  })

  it('entityToDraft should handle undefined org_id gracefully', () => {
    const entity = {
      id: 'job-123',
      job_number: 'JOB-123',
      job_parts: [],
    }

    const draft = entityToDraft(entity)

    expect(draft.org_id).toBeUndefined()
  })
})
