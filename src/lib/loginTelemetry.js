import { supabase } from './supabase'

const RECORD_LOGIN_RPC = 'record_successful_login_self'

export const recordSuccessfulLogin = async (_identity, client = supabase) => {
  try {
    const { data, error } = await client.rpc(RECORD_LOGIN_RPC)

    if (error) {
      console.warn('Unable to record Rocket login telemetry:', error?.message || error)
      return { recorded: false, reason: 'database_error' }
    }

    if (data !== true) {
      return { recorded: false, reason: 'not_recorded' }
    }

    return { recorded: true }
  } catch (error) {
    console.warn('Unable to record Rocket login telemetry:', error?.message || error)
    return { recorded: false, reason: 'unexpected_error' }
  }
}

export const recordSuccessfulLoginInBackground = (identity, client = supabase) => {
  void recordSuccessfulLogin(identity, client)
  return { queued: true }
}
