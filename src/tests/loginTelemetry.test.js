import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  recordSuccessfulLogin,
  recordSuccessfulLoginInBackground,
} from '../lib/loginTelemetry'

const createClient = ({ error = null, rejects = null } = {}) => {
  const secondEq = vi.fn(() => (rejects ? Promise.reject(rejects) : Promise.resolve({ error })))
  const firstEq = vi.fn(() => ({ eq: secondEq }))
  const update = vi.fn(() => ({ eq: firstEq }))
  const from = vi.fn(() => ({ update }))

  return { client: { from }, from, update, firstEq, secondEq }
}

describe('recordSuccessfulLogin', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('records an explicit login against both the profile and linked Auth identity', async () => {
    const db = createClient()
    const occurredAt = '2026-09-25T05:15:00.000Z'

    await expect(
      recordSuccessfulLogin(
        { authUserId: 'auth-user-id', profileId: 'profile-id', occurredAt },
        db.client
      )
    ).resolves.toEqual({ recorded: true, occurredAt })

    expect(db.from).toHaveBeenCalledWith('user_profiles')
    expect(db.update).toHaveBeenCalledWith({ last_login_at: occurredAt })
    expect(db.firstEq).toHaveBeenCalledWith('id', 'profile-id')
    expect(db.secondEq).toHaveBeenCalledWith('auth_user_id', 'auth-user-id')
  })

  it('does not turn a telemetry write failure into a login failure', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = createClient({ error: { message: 'write blocked' } })

    await expect(
      recordSuccessfulLogin(
        {
          authUserId: 'auth-user-id',
          profileId: 'profile-id',
          occurredAt: '2026-09-25T05:15:00.000Z',
        },
        db.client
      )
    ).resolves.toEqual({ recorded: false, reason: 'database_error' })

    expect(warning).toHaveBeenCalledWith(
      'Unable to record Rocket login telemetry:',
      'write blocked'
    )
  })

  it('returns immediately when the telemetry request never settles', () => {
    const secondEq = vi.fn(() => new Promise(() => {}))
    const firstEq = vi.fn(() => ({ eq: secondEq }))
    const update = vi.fn(() => ({ eq: firstEq }))
    const client = { from: vi.fn(() => ({ update })) }

    expect(
      recordSuccessfulLoginInBackground(
        { authUserId: 'auth-user-id', profileId: 'profile-id' },
        client
      )
    ).toEqual({ queued: true })

    expect(secondEq).toHaveBeenCalledWith('auth_user_id', 'auth-user-id')
  })

  it('skips the database when either identity is missing', async () => {
    const db = createClient()

    await expect(
      recordSuccessfulLogin({ authUserId: null, profileId: 'profile-id' }, db.client)
    ).resolves.toEqual({ recorded: false, reason: 'missing_identity' })

    expect(db.from).not.toHaveBeenCalled()
  })
})
