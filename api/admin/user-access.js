import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

const ROLES = new Set(['admin', 'manager', 'staff', 'vendor'])
const SAFE_MESSAGE = 'Unable to complete that access change.'

function send(res, status, body) {
  if (typeof res.status === 'function') return res.status(status).json(body)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.end(JSON.stringify(body))
}

function profileRows(result) {
  return Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : []
}

function validText(value, maximum = 200) {
  return typeof value === 'string' && value.trim().length > 0 && value.trim().length <= maximum
}

function trustedRedirectOrigin(req) {
  const configured = process.env.ROCKET_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL
  if (configured) {
    const value = configured.startsWith('http') ? configured : `https://${configured}`
    try {
      return new URL(value).protocol === 'https:' ? new URL(value).origin : null
    } catch {
      return null
    }
  }
  if (
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production' ||
    process.env.NODE_ENV === 'test'
  )
    return null
  const origin = String(req.headers?.origin || '').replace(/\/$/, '')
  try {
    return new URL(origin).origin
  } catch {
    return null
  }
}

async function activeAdminCount(client, dealerId) {
  const { count, error } = await client
    .from('user_profiles')
    .select('id', { count: 'exact', head: true })
    .eq('dealer_id', dealerId)
    .eq('role', 'admin')
    .eq('is_active', true)
  return error ? null : count
}

function profileForUser(client, userId) {
  return client
    .from('user_profiles')
    .select('id, auth_user_id, email, full_name, role, department, phone, dealer_id, is_active')
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)
}

export function createUserAccessHandler({ createSupabaseClient = createClient } = {}) {
  return async function handler(req, res) {
    if (req.method !== 'POST') return send(res, 405, { error: SAFE_MESSAGE })

    const authorization = String(req.headers?.authorization || '')
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1]
    if (!token) return send(res, 401, { error: SAFE_MESSAGE })

    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
    const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !anonKey || !serviceRoleKey) return send(res, 503, { error: SAFE_MESSAGE })

    try {
      const anon = createSupabaseClient(url, anonKey, { auth: { persistSession: false } })
      const { data: authData, error: authError } = await anon.auth.getUser(token)
      if (authError || !authData?.user?.id) return send(res, 401, { error: SAFE_MESSAGE })

      const admin = createSupabaseClient(url, serviceRoleKey, { auth: { persistSession: false } })
      const actorResult = await profileForUser(admin, authData.user.id)
      const actors = profileRows(actorResult)
      const actor = actors.length === 1 ? actors[0] : null
      if (
        !actor ||
        !actor.is_active ||
        !actor.dealer_id ||
        !['admin', 'manager'].includes(actor.role)
      ) {
        return send(res, 403, { error: SAFE_MESSAGE })
      }

      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {}
      const { action } = body

      if (action === 'invite') {
        const { email, full_name, role, department, dealer_id, phone } = body
        if (
          !validText(email, 254) ||
          !/^\S+@\S+\.\S+$/.test(email) ||
          !validText(full_name) ||
          !ROLES.has(role) ||
          !validText(department) ||
          (phone != null && (typeof phone !== 'string' || phone.trim().length > 50)) ||
          dealer_id !== actor.dealer_id
        ) {
          return send(res, 400, { error: SAFE_MESSAGE })
        }
        if (
          (actor.role !== 'admin' && ['admin', 'manager'].includes(role)) ||
          (actor.role !== 'admin' && !['staff', 'vendor'].includes(role))
        ) {
          return send(res, 403, { error: SAFE_MESSAGE })
        }

        const normalizedEmail = email.trim().toLowerCase()
        const existing = profileRows(
          await admin
            .from('user_profiles')
            .select(
              'id, auth_user_id, email, full_name, role, department, phone, dealer_id, is_active'
            )
            .ilike('email', normalizedEmail)
        )
        let profile
        let needsInvitation = true
        if (existing.length === 0) {
          const { data: created, error: createError } = await admin
            .from('user_profiles')
            .insert([
              {
                email: normalizedEmail,
                full_name: full_name.trim(),
                role,
                department: department.trim(),
                phone: phone?.trim?.() || null,
                dealer_id: actor.dealer_id,
                is_active: false,
              },
            ])
            .select('id, is_active')
          const profiles = profileRows({ data: created })
          if (createError || profiles.length !== 1 || profiles[0]?.is_active !== false)
            return send(res, 400, { error: SAFE_MESSAGE })
          profile = profiles[0]
        } else if (
          existing.length === 1 &&
          existing[0]?.dealer_id === actor.dealer_id &&
          existing[0]?.is_active === false &&
          existing[0]?.role === role &&
          existing[0]?.department === department.trim() &&
          existing[0]?.full_name === full_name.trim()
        ) {
          profile = existing[0]
          if (!profile.auth_user_id && (profile.phone ?? null) !== (phone?.trim?.() || null)) {
            const { data: refreshed, error: phoneError } = await admin
              .from('user_profiles')
              .update({ phone: phone?.trim?.() || null })
              .eq('id', profile.id)
              .select('id, auth_user_id, is_active')
            const refreshedRows = profileRows({ data: refreshed })
            if (phoneError || refreshedRows.length !== 1 || refreshedRows[0]?.is_active !== false)
              return send(res, 400, { error: SAFE_MESSAGE })
          }
          if (profile.auth_user_id) {
            if (profile.id !== profile.auth_user_id) return send(res, 400, { error: SAFE_MESSAGE })
            const { data: linkedUser, error: linkedUserError } = await admin.auth.admin.getUserById(
              profile.auth_user_id
            )
            if (
              linkedUserError ||
              linkedUser?.user?.email?.trim().toLowerCase() !== normalizedEmail
            ) {
              return send(res, 400, { error: SAFE_MESSAGE })
            }
            const bannedUntil = linkedUser?.user?.banned_until
            const banTime = bannedUntil == null ? null : Date.parse(bannedUntil)
            if (bannedUntil != null && (!Number.isFinite(banTime) || banTime > Date.now())) {
              return send(res, 403, { error: SAFE_MESSAGE })
            }
            needsInvitation = false
          }
        } else return send(res, 400, { error: SAFE_MESSAGE })

        if (needsInvitation) {
          const origin = trustedRedirectOrigin(req)
          if (!origin) return send(res, 503, { error: SAFE_MESSAGE })
          const { error: inviteError } = await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
            redirectTo: `${origin}/reset-password`,
          })
          if (inviteError)
            return send(res, 502, {
              error:
                'Invitation could not be sent. The profile remains inactive; retry the invitation.',
            })
        }

        const linked = profileRows(
          await admin
            .from('user_profiles')
            .select('id, auth_user_id, is_active')
            .ilike('email', normalizedEmail)
        )
        if (
          linked.length !== 1 ||
          !linked[0]?.auth_user_id ||
          linked[0]?.id !== linked[0]?.auth_user_id ||
          linked[0]?.is_active !== false
        )
          return send(res, 502, {
            error: 'Invitation was sent, but the profile link is pending. Retry the invitation.',
          })
        const { data: activated, error: activateError } = await admin
          .from('user_profiles')
          .update({ is_active: true })
          .eq('id', linked[0].id)
          .select('id, is_active')
        const activatedRows = profileRows({ data: activated })
        if (activateError || activatedRows.length !== 1 || activatedRows[0]?.is_active !== true)
          return send(res, 502, { error: SAFE_MESSAGE })
        return send(res, 200, { ok: true, profileId: linked[0].id })
      }

      const targetId = body.profileId
      if (!validText(targetId, 100)) return send(res, 400, { error: SAFE_MESSAGE })
      const targetResult = await admin
        .from('user_profiles')
        .select('id, auth_user_id, email, role, dealer_id, is_active')
        .eq('id', targetId)
      const targets = profileRows(targetResult)
      const target = targets.length === 1 ? targets[0] : null
      if (!target || target.dealer_id !== actor.dealer_id)
        return send(res, 403, { error: SAFE_MESSAGE })

      if (action === 'update') {
        const forbidden = ['dealer_id', 'org_id', 'auth_user_id', 'is_active'].some((key) =>
          Object.hasOwn(body, key)
        )
        const { full_name, role, department, phone, email } = body
        if (
          forbidden ||
          !validText(full_name) ||
          !ROLES.has(role) ||
          !validText(department) ||
          (phone != null && (typeof phone !== 'string' || phone.length > 50)) ||
          (target.auth_user_id && email != null && email !== target.email)
        )
          return send(res, 400, { error: SAFE_MESSAGE })
        if ((target.auth_user_id || ['admin', 'manager'].includes(role)) && actor.role !== 'admin')
          return send(res, 403, { error: SAFE_MESSAGE })
        if (target.id === actor.id || target.auth_user_id === authData.user.id)
          return send(res, 403, { error: SAFE_MESSAGE })
        if (
          target.role === 'admin' &&
          target.is_active &&
          role !== 'admin' &&
          (await activeAdminCount(admin, actor.dealer_id)) <= 1
        )
          return send(res, 403, { error: SAFE_MESSAGE })
        const patch = {
          full_name: full_name.trim(),
          role,
          department: department.trim(),
          phone: phone?.trim?.() || null,
        }
        if (!target.auth_user_id && validText(email, 254) && /^\S+@\S+\.\S+$/.test(email))
          patch.email = email.trim().toLowerCase()
        const { data, error } = await admin
          .from('user_profiles')
          .update(patch)
          .eq('id', target.id)
          .select('id')
        if (error || profileRows({ data }).length !== 1)
          return send(res, 400, { error: SAFE_MESSAGE })
        return send(res, 200, { ok: true, profileId: target.id })
      }

      if (action === 'deactivate') {
        if (target.id === actor.id || target.auth_user_id === authData.user.id)
          return send(res, 403, { error: SAFE_MESSAGE })
        if (
          (target.auth_user_id || ['admin', 'manager'].includes(target.role)) &&
          actor.role !== 'admin'
        )
          return send(res, 403, { error: SAFE_MESSAGE })
        if (target.role === 'admin' && target.is_active) {
          if ((await activeAdminCount(admin, actor.dealer_id)) <= 1)
            return send(res, 403, { error: SAFE_MESSAGE })
        }
        const { data, error } = await admin
          .from('user_profiles')
          .update({ is_active: false })
          .eq('id', target.id)
          .select('id, is_active')
        const updated = profileRows({ data })
        if (error || updated.length !== 1 || updated[0]?.is_active !== false)
          return send(res, 400, { error: SAFE_MESSAGE })
        if (target.auth_user_id) {
          const { error: lockError } = await admin.auth.admin.updateUserById(target.auth_user_id, {
            password: randomBytes(48).toString('base64url'),
            ban_duration: '876000h',
          })
          if (lockError)
            return send(res, 502, {
              error: 'Profile was deactivated, but the login lock failed. Retry deactivation.',
            })
        }
        return send(res, 200, { ok: true, profileId: target.id })
      }

      return send(res, 400, { error: SAFE_MESSAGE })
    } catch {
      return send(res, 500, { error: SAFE_MESSAGE })
    }
  }
}

export default createUserAccessHandler()
