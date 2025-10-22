import { supabase } from '@/lib/supabase'

export async function pingSupabase() {
  // Loud, lightweight reachability ping; treat permission errors as reachable
  try {
    const { count } = await supabase
      .from('user_profiles')
      .select('id', { count: 'exact', head: true })
      .throwOnError()
    return { ok: true, error: null, count: count ?? 0 }
  } catch (error) {
    const msg = String(error?.message || '').toLowerCase()
    if (msg.includes('permission') || msg.includes('rls')) {
      // Endpoint reachable, but protected — still OK for ping purposes
      return { ok: true, error: null, count: 0 }
    }
    return { ok: false, error }
  }
}
