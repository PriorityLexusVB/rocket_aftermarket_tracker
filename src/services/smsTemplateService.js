import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

export function listSmsTemplatesByOrg(orgId, { activeOnly = true } = {}) {
  let q = supabase.from('sms_templates').select('*').order('name', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.eq('org_id', orgId)
  return safeSelect(q, 'sms_templates:listByOrg')
}

export function listSmsTemplatesGlobal({ activeOnly = true } = {}) {
  let q = supabase.from('sms_templates').select('*').order('name', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  // global: no org filter
  return safeSelect(q, 'sms_templates:listGlobal')
}

export default { listSmsTemplatesByOrg, listSmsTemplatesGlobal }
