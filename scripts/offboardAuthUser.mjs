import { randomBytes } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'

function parseArgs(argv) {
  const values = {}
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index]
    const value = argv[index + 1]
    if (!key?.startsWith('--') || value == null) throw new Error('Invalid arguments')
    values[key.slice(2)] = value
  }
  return values
}

function fail(message) {
  console.error(message)
  process.exitCode = 1
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const userId = args['user-id']
  const email = args.email?.trim().toLowerCase()
  const expectedConfirmation = `DEACTIVATE:${userId}:${email}`

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(userId || '')
  ) {
    throw new Error('A valid --user-id UUID is required')
  }
  if (!/^\S+@\S+\.\S+$/.test(email || '')) throw new Error('A valid --email is required')
  if (args.confirm !== expectedConfirmation) {
    throw new Error(`Refusing access change: --confirm must equal ${expectedConfirmation}`)
  }

  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) throw new Error('Supabase operator environment is incomplete')

  const supabase = createClient(url, serviceRoleKey, { auth: { persistSession: false } })
  const { data: profiles, error: profileError } = await supabase
    .from('user_profiles')
    .select('id,auth_user_id,email,role,is_active,dealer_id')
    .or(`id.eq.${userId},auth_user_id.eq.${userId}`)

  if (profileError || profiles?.length !== 1)
    throw new Error('Target profile was not uniquely resolved')
  const profile = profiles[0]
  if (
    profile.id !== userId ||
    profile.auth_user_id !== userId ||
    profile.email?.trim().toLowerCase() !== email ||
    !profile.dealer_id
  ) {
    throw new Error('Target identity does not match the canonical profile receipt')
  }
  if (profile.role === 'admin')
    throw new Error('This operator refuses to deactivate an administrator')

  const { data: updated, error: updateError } = await supabase
    .from('user_profiles')
    .update({ is_active: false })
    .eq('id', userId)
    .eq('email', profile.email)
    .select('id,email,is_active')

  if (updateError || updated?.length !== 1 || updated[0]?.is_active !== false) {
    throw new Error('Profile deactivation was not verified')
  }

  const replacementPassword = randomBytes(48).toString('base64url')
  const { error: lockError } = await supabase.auth.admin.updateUserById(userId, {
    password: replacementPassword,
    ban_duration: '876000h',
  })
  if (lockError) {
    throw new Error('Profile is inactive, but the Auth password/ban lock failed; retry safely')
  }

  const { data: locked, error: verifyError } = await supabase.auth.admin.getUserById(userId)
  const bannedUntil = Date.parse(locked?.user?.banned_until || '')
  if (
    verifyError ||
    locked?.user?.email?.trim().toLowerCase() !== email ||
    !Number.isFinite(bannedUntil) ||
    bannedUntil <= Date.now()
  ) {
    throw new Error('Auth lock could not be verified')
  }

  console.log(
    JSON.stringify({
      userId,
      email,
      profileActive: false,
      authBanned: true,
      passwordDiscarded: true,
    })
  )
}

main().catch((error) => fail(error?.message || 'Offboarding failed'))
