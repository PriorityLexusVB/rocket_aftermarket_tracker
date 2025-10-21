import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

export function listSmsTemplatesByOrg(orgId, { activeOnly = true } = {}) {
  let q = supabase.from('sms_templates').select('*').order('title', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.eq('org_id', orgId)
  return safeSelect(q, 'sms_templates:listByOrg')
}

export default { listSmsTemplatesByOrg }
