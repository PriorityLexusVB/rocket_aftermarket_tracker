import { supabase } from '@/lib/supabaseClient'
import { safeSelect } from '@/lib/supabase/safeSelect'

export function listStaffByOrg(orgId) {
  return safeSelect(
    supabase
      .from('staff_records')
      .select('*')
      .eq('org_id', orgId)
      .order('last_name', { ascending: true }),
    'staff:listByOrg'
  )
}

export default { listStaffByOrg }
