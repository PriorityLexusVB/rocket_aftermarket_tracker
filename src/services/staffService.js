import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

// Prefer user_profiles as the authoritative staff source
export function listStaffByOrg(orgId, { activeOnly = true } = {}) {
  let q = supabase.from('user_profiles').select('*').order('full_name', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.eq('org_id', orgId)
  return safeSelect(q, 'staff:listByOrg')
}

export default { listStaffByOrg }
