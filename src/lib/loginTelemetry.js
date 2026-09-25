import { supabase } from './supabase'

export const recordSuccessfulLogin = async (
  { authUserId, profileId, occurredAt = new Date().toISOString() },
  client = supabase
) => {
  if (!authUserId || !profileId) return { recorded: false, reason: 'missing_identity' }

  try {
    const { error } = await client
      .from('user_profiles')
      .update({ last_login_at: occurredAt })
      .eq('id', profileId)
      .eq('auth_user_id', authUserId)

    if (error) {
      console.warn('Unable to record Rocket login telemetry:', error?.message || error)
      return { recorded: false, reason: 'database_error' }
    }

    return { recorded: true, occurredAt }
  } catch (error) {
    console.warn('Unable to record Rocket login telemetry:', error?.message || error)
    return { recorded: false, reason: 'unexpected_error' }
  }
}
