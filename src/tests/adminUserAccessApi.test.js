import { afterEach, describe, expect, it, vi } from 'vitest'
import { createUserAccessHandler } from '../../api/admin/user-access.js'

const originalEnv = { ...process.env }
afterEach(() => {
  process.env = { ...originalEnv }
})
const env = () =>
  Object.assign(process.env, {
    SUPABASE_URL: 'https://example.supabase.co',
    SUPABASE_ANON_KEY: 'anon',
    SUPABASE_SERVICE_ROLE_KEY: 'service',
    ROCKET_APP_URL: 'https://app.rocket.test',
  })
const response = () => ({
  statusCode: 0,
  body: null,
  setHeader: vi.fn(),
  end(value) {
    this.body = JSON.parse(value)
  },
})

function query(result) {
  const normalized = Array.isArray(result) ? { data: result, error: null } : result
  const chain = {
    select: vi.fn(() => chain),
    update: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    ilike: vi.fn(() => chain),
    or: vi.fn(() => chain),
    then(resolve, reject) {
      return Promise.resolve(normalized).then(resolve, reject)
    },
  }
  return chain
}

function setup(results) {
  const anon = {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: 'actor-auth' } }, error: null })),
      resetPasswordForEmail: vi.fn(async () => ({ error: null })),
    },
  }
  const admin = {
    from: vi.fn(() => query(results.shift())),
    auth: {
      admin: {
        inviteUserByEmail: vi.fn(async () => ({ error: null })),
        updateUserById: vi.fn(async () => ({ error: null })),
        getUserById: vi.fn(async (id) => ({
          data: { user: { id, email: 'new@example.com' } },
          error: null,
        })),
      },
    },
  }
  return { admin, anon, create: vi.fn().mockReturnValueOnce(anon).mockReturnValue(admin) }
}

const actor = { id: 'actor', dealer_id: 'dealer', role: 'admin', is_active: true }
const request = (body, origin = 'https://evil.example') => ({
  method: 'POST',
  headers: { authorization: 'Bearer token', origin },
  body,
})

describe('admin user-access API authorization', () => {
  it('rejects a manager editing an Auth-linked profile', async () => {
    env()
    const manager = { ...actor, role: 'manager' }
    const target = {
      id: 'target',
      dealer_id: 'dealer',
      role: 'staff',
      auth_user_id: 'linked',
      email: 'staff@example.com',
    }
    const { create, admin } = setup([[manager], [target], [target]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'update',
        profileId: 'target',
        full_name: 'Staff',
        role: 'staff',
        department: 'Sales',
      }),
      res
    )
    expect(res.statusCode).toBe(403)
    expect(admin.from).toHaveBeenCalledTimes(2)
  })

  it('rejects immutable tenant or Auth linkage fields', async () => {
    env()
    const target = {
      id: 'target',
      dealer_id: 'dealer',
      role: 'staff',
      auth_user_id: null,
      email: 'staff@example.com',
    }
    const { create } = setup([[actor], [target], [target]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'update',
        profileId: 'target',
        full_name: 'Staff',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'other',
      }),
      res
    )
    expect(res.statusCode).toBe(400)
  })

  it('reuses exactly one inactive unlinked same-dealer preprofile and ignores a hostile Origin', async () => {
    env()
    const preprofile = {
      id: 'pre',
      email: 'new@example.com',
      full_name: 'New User',
      role: 'staff',
      department: 'Sales',
      dealer_id: 'dealer',
      is_active: false,
      auth_user_id: null,
    }
    const linked = { id: 'new-auth', is_active: false, auth_user_id: 'new-auth' }
    const activated = { id: 'new-auth', is_active: true }
    const { create, admin } = setup([[actor], [preprofile], [linked], [activated]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'invite',
        email: 'new@example.com',
        full_name: 'New User',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'dealer',
      }),
      res
    )
    expect(res.statusCode).toBe(200)
    expect(res.body.profileId).toBe('new-auth')
    expect(admin.auth.admin.inviteUserByEmail).toHaveBeenCalledWith('new@example.com', {
      redirectTo: 'https://app.rocket.test/reset-password',
    })
  })

  it('stores a validated staff phone in a new inactive preprofile before invite', async () => {
    env()
    const created = { id: 'pre', is_active: false }
    const linked = { id: 'new-auth', is_active: false, auth_user_id: 'new-auth' }
    const activated = { id: 'new-auth', is_active: true }
    const { create, admin } = setup([[actor], [], [created], [linked], [activated]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'invite',
        email: 'new@example.com',
        full_name: 'New User',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'dealer',
        phone: ' 555-0100 ',
      }),
      res
    )
    expect(res.statusCode).toBe(200)
    expect(admin.from.mock.results[2].value.insert).toHaveBeenCalledWith([
      expect.objectContaining({ phone: '555-0100', is_active: false }),
    ])
  })

  it('updates the phone on a reusable unlinked inactive preprofile', async () => {
    env()
    const preprofile = {
      id: 'pre',
      email: 'new@example.com',
      full_name: 'New User',
      role: 'staff',
      department: 'Sales',
      dealer_id: 'dealer',
      is_active: false,
      auth_user_id: null,
      phone: 'old',
    }
    const refreshed = { id: 'pre', is_active: false, auth_user_id: null }
    const linked = { id: 'new-auth', is_active: false, auth_user_id: 'new-auth' }
    const activated = { id: 'new-auth', is_active: true }
    const { create, admin } = setup([[actor], [preprofile], [refreshed], [linked], [activated]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'invite',
        email: 'new@example.com',
        full_name: 'New User',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'dealer',
        phone: 'new',
      }),
      res
    )
    expect(res.statusCode).toBe(200)
    expect(admin.from.mock.results[2].value.update).toHaveBeenCalledWith({ phone: 'new' })
  })

  it('keeps the profile inactive when the invite has not linked Auth yet', async () => {
    env()
    const preprofile = {
      id: 'pre',
      email: 'new@example.com',
      full_name: 'New User',
      role: 'staff',
      department: 'Sales',
      dealer_id: 'dealer',
      is_active: false,
      auth_user_id: null,
    }
    const { create, admin } = setup([
      [actor],
      [preprofile],
      [{ id: 'pre', is_active: false, auth_user_id: null }],
    ])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'invite',
        email: 'new@example.com',
        full_name: 'New User',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'dealer',
      }),
      res
    )
    expect(res.statusCode).toBe(502)
    expect(admin.from).toHaveBeenCalledTimes(3)
  })

  it('rejects a split linked identity rather than activating it', async () => {
    env()
    const preprofile = {
      id: 'pre',
      email: 'new@example.com',
      full_name: 'New User',
      role: 'staff',
      department: 'Sales',
      dealer_id: 'dealer',
      is_active: false,
      auth_user_id: null,
    }
    const split = { id: 'pre', is_active: false, auth_user_id: 'new-auth' }
    const { create } = setup([[actor], [preprofile], [split]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'invite',
        email: 'new@example.com',
        full_name: 'New User',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'dealer',
      }),
      res
    )
    expect(res.statusCode).toBe(502)
  })

  it('resumes activation for an already-linked inactive invitation without sending another invite', async () => {
    env()
    const linkedProfile = {
      id: 'new-auth',
      email: 'new@example.com',
      full_name: 'New User',
      role: 'staff',
      department: 'Sales',
      dealer_id: 'dealer',
      is_active: false,
      auth_user_id: 'new-auth',
    }
    const activated = { id: 'new-auth', is_active: true }
    const { create, admin } = setup([[actor], [linkedProfile], [linkedProfile], [activated]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'invite',
        email: 'new@example.com',
        full_name: 'New User',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'dealer',
      }),
      res
    )
    expect(res.statusCode).toBe(200)
    expect(admin.auth.admin.getUserById).toHaveBeenCalledWith('new-auth')
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('fails closed for a future-banned linked profile instead of reactivating it', async () => {
    env()
    const linkedProfile = {
      id: 'new-auth',
      email: 'new@example.com',
      full_name: 'New User',
      role: 'staff',
      department: 'Sales',
      dealer_id: 'dealer',
      is_active: false,
      auth_user_id: 'new-auth',
    }
    const { create, admin } = setup([[actor], [linkedProfile]])
    admin.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: 'new-auth',
          email: 'new@example.com',
          banned_until: '2099-01-01T00:00:00.000Z',
        },
      },
      error: null,
    })
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'invite',
        email: 'new@example.com',
        full_name: 'New User',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'dealer',
      }),
      res
    )
    expect(res.statusCode).toBe(403)
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled()
    expect(admin.from).toHaveBeenCalledTimes(2)
  })

  it('does not let a safe-looking retry activate a preprofile with a stronger stored role', async () => {
    env()
    const manager = { ...actor, role: 'manager' }
    const stronger = {
      id: 'pre',
      email: 'new@example.com',
      full_name: 'New User',
      role: 'admin',
      department: 'Sales',
      dealer_id: 'dealer',
      is_active: false,
      auth_user_id: null,
    }
    const { create, admin } = setup([[manager], [stronger]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'invite',
        email: 'new@example.com',
        full_name: 'New User',
        role: 'staff',
        department: 'Sales',
        dealer_id: 'dealer',
      }),
      res
    )
    expect(res.statusCode).toBe(400)
    expect(admin.auth.admin.inviteUserByEmail).not.toHaveBeenCalled()
  })

  it('prevents demoting the last active admin', async () => {
    env()
    const target = {
      id: 'other-admin',
      dealer_id: 'dealer',
      role: 'admin',
      auth_user_id: 'other-auth',
      email: 'other@example.com',
      is_active: true,
    }
    const { create } = setup([[actor], [target], { data: null, error: null, count: 1 }])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(
      request({
        action: 'update',
        profileId: 'other-admin',
        full_name: 'Other',
        role: 'staff',
        department: 'Sales',
        email: 'other@example.com',
      }),
      res
    )
    expect(res.statusCode).toBe(403)
  })

  it('accepts only POST requests', async () => {
    const res = response()
    await createUserAccessHandler()({ method: 'GET', headers: {} }, res)
    expect(res.statusCode).toBe(405)
  })
})

describe('admin user-access API reset_password', () => {
  const linkedTarget = {
    id: 'target',
    dealer_id: 'dealer',
    role: 'staff',
    auth_user_id: 'linked',
    email: 'stale@example.com',
    is_active: true,
  }
  const resetRequest = () => request({ action: 'reset_password', profileId: 'target' })

  it('sends to the CANONICAL auth email, not the stored profile email', async () => {
    env()
    const { create, anon } = setup([[actor], [linkedTarget]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(resetRequest(), res)
    expect(res.statusCode).toBe(200)
    expect(anon.auth.resetPasswordForEmail).toHaveBeenCalledTimes(1)
    // getUserById stub resolves to new@example.com — the stale profile email must NOT be used.
    expect(anon.auth.resetPasswordForEmail).toHaveBeenCalledWith('new@example.com', {
      redirectTo: 'https://app.rocket.test/reset-password',
    })
  })

  it('ignores a hostile Origin header for the reset redirect', async () => {
    env()
    const { create, anon } = setup([[actor], [linkedTarget]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(resetRequest(), res)
    expect(anon.auth.resetPasswordForEmail).toHaveBeenCalledWith(
      'new@example.com',
      expect.objectContaining({ redirectTo: expect.stringContaining('https://app.rocket.test') })
    )
  })

  it('rejects a manager resetting an Auth-linked profile', async () => {
    env()
    const manager = { ...actor, role: 'manager' }
    const { create, anon } = setup([[manager], [linkedTarget]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(resetRequest(), res)
    expect(res.statusCode).toBe(403)
    expect(anon.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('rejects a target in another dealer', async () => {
    env()
    const foreign = { ...linkedTarget, dealer_id: 'other-dealer' }
    const { create, anon } = setup([[actor], [foreign]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(resetRequest(), res)
    expect(res.statusCode).toBe(403)
    expect(anon.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('rejects an inactive target', async () => {
    env()
    const inactive = { ...linkedTarget, is_active: false }
    const { create, anon } = setup([[actor], [inactive]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(resetRequest(), res)
    expect(res.statusCode).toBe(403)
    expect(anon.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })

  it('rejects a directory profile with no linked login', async () => {
    env()
    const unlinked = { ...linkedTarget, auth_user_id: null }
    const { create, anon } = setup([[actor], [unlinked]])
    const res = response()
    await createUserAccessHandler({ createSupabaseClient: create })(resetRequest(), res)
    expect(res.statusCode).toBe(400)
    expect(anon.auth.resetPasswordForEmail).not.toHaveBeenCalled()
  })
})
