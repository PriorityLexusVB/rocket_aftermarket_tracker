import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  recordSuccessfulLogin,
  recordSuccessfulLoginInBackground,
} from '../lib/loginTelemetry'

const createClient = ({ data = true, error = null, rejects = null } = {}) => {
  const rpc = vi.fn(() => (rejects ? Promise.reject(rejects) : Promise.resolve({ data, error })))
  const from = vi.fn()

  return { client: { rpc, from }, rpc, from }
}

describe('recordSuccessfulLogin', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the self-only RPC with no identity argument', async () => {
    const db = createClient({ data: true })

    await expect(
      recordSuccessfulLogin({ authUserId: 'auth-user-id', profileId: 'profile-id' }, db.client)
    ).resolves.toEqual({ recorded: true })

    expect(db.rpc).toHaveBeenCalledTimes(1)
    expect(db.rpc).toHaveBeenCalledWith('record_successful_login_self')
  })

  it('never falls back to a direct user_profiles table update', async () => {
    const db = createClient({ data: true })

    await recordSuccessfulLogin({ authUserId: 'auth-user-id', profileId: 'profile-id' }, db.client)

    expect(db.from).not.toHaveBeenCalled()
  })

  it('truthfully reports recorded:false when the RPC reports false', async () => {
    const db = createClient({ data: false })

    await expect(
      recordSuccessfulLogin({ authUserId: 'auth-user-id', profileId: 'profile-id' }, db.client)
    ).resolves.toEqual({ recorded: false, reason: 'not_recorded' })
  })

  it('does not turn a telemetry write failure into a login failure', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = createClient({ data: null, error: { message: 'write blocked' } })

    await expect(
      recordSuccessfulLogin({ authUserId: 'auth-user-id', profileId: 'profile-id' }, db.client)
    ).resolves.toEqual({ recorded: false, reason: 'database_error' })

    expect(warning).toHaveBeenCalledWith(
      'Unable to record Rocket login telemetry:',
      'write blocked'
    )
  })

  it('contains an unexpected rejection instead of throwing', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = createClient({ rejects: new Error('network down') })

    await expect(
      recordSuccessfulLogin({ authUserId: 'auth-user-id', profileId: 'profile-id' }, db.client)
    ).resolves.toEqual({ recorded: false, reason: 'unexpected_error' })

    expect(warning).toHaveBeenCalledWith(
      'Unable to record Rocket login telemetry:',
      'network down'
    )
  })

  it('returns immediately when the telemetry RPC never settles', () => {
    const rpc = vi.fn(() => new Promise(() => {}))
    const client = { rpc, from: vi.fn() }

    expect(
      recordSuccessfulLoginInBackground(
        { authUserId: 'auth-user-id', profileId: 'profile-id' },
        client
      )
    ).toEqual({ queued: true })

    expect(rpc).toHaveBeenCalledWith('record_successful_login_self')
  })
})
