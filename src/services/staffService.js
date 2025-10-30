import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

// Prefer user_profiles as the authoritative staff source
export function listStaffByOrg(orgId, { activeOnly = true } = {}) {
  let q = supabase.from('user_profiles').select('*').order('full_name', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  // Include global (unscoped) staff rows where org_id is NULL, like vendors/products services do
  if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
  return safeSelect(q, 'staff:listByOrg')
}

export default { listStaffByOrg }
