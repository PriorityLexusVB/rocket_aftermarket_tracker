import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import {
  resolveUserProfileName,
  ensureUserProfileCapsLoaded,
  getProfileCaps,
} from '@/utils/userProfileName'

// Prefer user_profiles as the authoritative staff source
export async function listStaffByOrg(orgId, { activeOnly = true } = {}) {
  await ensureUserProfileCapsLoaded()
  const caps = getProfileCaps()
  const nameCol = caps.name
    ? 'name'
    : caps.full_name
      ? 'full_name'
      : caps.display_name
        ? 'display_name'
        : 'email'
  let q = supabase
    .from('user_profiles')
    .select(['id', nameCol, 'email', 'role', 'department', 'is_active'].filter(Boolean).join(', '))
    .order(nameCol, { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)
  const rows = await safeSelect(q, 'staff:listByOrg')
  return (rows || []).map((r) => ({
    ...r,
    display_name: resolveUserProfileName(r) ?? r[nameCol] ?? r.email ?? String(r.id),
  }))
}

export default { listStaffByOrg }
