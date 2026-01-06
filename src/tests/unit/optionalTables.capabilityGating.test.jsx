import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ userProfile: { dealer_id: 'test-org' } }),
}))

describe('Optional table capability gating', () => {
  beforeEach(() => {
    sessionStorage.clear()
    vi.resetModules()
  })

  it('disables sms_templates after missing-table and short-circuits subsequent safeSelect calls', async () => {
    const err = {
      code: 'PGRST205',
      message: "Could not find the table 'public.sms_templates' in the schema cache",
    }

    const q = {
      throwOnError: vi.fn().mockRejectedValueOnce(err),
    }

    const safe = await import('../../lib/supabase/safeSelect')
    const cap = await import('../../utils/capabilityTelemetry')

    const first = await safe.safeSelect(q, 'sms_templates:test')
    expect(first).toEqual([])
    expect(cap.SMS_TEMPLATES_TABLE_AVAILABLE).toBe(false)

    const second = await safe.safeSelect(q, 'sms_templates:test')
    expect(second).toEqual([])

    expect(q.throwOnError).toHaveBeenCalledTimes(1)
  })

  it('disables notification_outbox after missing-table and short-circuits subsequent safeSelect calls', async () => {
    const err = {
      code: 'PGRST205',
      message: "Could not find the table 'public.notification_outbox' in the schema cache",
    }

    const q = {
      throwOnError: vi.fn().mockRejectedValueOnce(err),
    }

    const safe = await import('../../lib/supabase/safeSelect')
    const cap = await import('../../utils/capabilityTelemetry')

    const first = await safe.safeSelect(q, 'notification_outbox:test')
    expect(first).toEqual([])
    expect(cap.NOTIFICATION_OUTBOX_TABLE_AVAILABLE).toBe(false)

    const second = await safe.safeSelect(q, 'notification_outbox:test')
    expect(second).toEqual([])

    expect(q.throwOnError).toHaveBeenCalledTimes(1)
  })

  it('renders an unavailable state for SmsTemplateManager when sms_templates capability is disabled', async () => {
    sessionStorage.setItem('cap_smsTemplatesTable', 'false')
    vi.resetModules()

    const mod =
      await import('../../pages/administrative-configuration-center/components/SmsTemplateManager')

    render(<mod.default />)

    expect(screen.getByText(/SMS Templates unavailable/i)).toBeInTheDocument()
  })
})
