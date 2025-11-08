import { supabase } from '@/lib/supabase'
import { setProfileCaps } from '@/utils/userProfileName'

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

// Best-effort client-side preflight to set capability flags before first heavy query.
// - Disables job_parts↔vendors relationship capability if health endpoint indicates missing FK/relationship
// - Initializes user_profiles column capabilities based on serverless probe
export async function preflightCapabilities() {
  // Deals relationship health
  try {
    const resp = await fetch('/api/health-deals-rel', { method: 'GET' })
    if (resp?.ok) {
      const json = await resp.json().catch(() => null)
      const classification = json?.classification || ''
      const hasFk = json?.hasFk
      const cacheRecognized = json?.restQueryOk
      // If FK missing or REST cannot expand, disable capability upfront
      if (
        classification === 'missing_fk' ||
        classification === 'missing_column' ||
        hasFk === false ||
        cacheRecognized === false ||
        json?.ok === false
      ) {
        try {
          sessionStorage?.setItem('cap_jobPartsVendorRel', 'false')
        } catch (_) {}
      }
    }
  } catch (_) {
    // ignore network errors
  }

  // User profiles column health
  try {
    const resp = await fetch('/api/health-user-profiles', { method: 'GET' })
    if (resp?.ok) {
      const json = await resp.json().catch(() => null)
      if (json?.columns && typeof setProfileCaps === 'function') {
        setProfileCaps({
          name: !!json.columns.name,
          full_name: !!json.columns.full_name,
          display_name: !!json.columns.display_name,
        })
      }
    }
  } catch (_) {
    // ignore
  }
}
