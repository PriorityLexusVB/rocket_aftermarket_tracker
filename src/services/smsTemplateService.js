import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

export function listSmsTemplatesByOrg(orgId, { activeOnly = true } = {}) {
  let q = supabase.from('sms_templates').select('*').order('created_at', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
  return safeSelect(q, 'sms_templates:listByOrg')
}

export function listSmsTemplatesGlobal({ activeOnly = true } = {}) {
  let q = supabase.from('sms_templates').select('*').order('created_at', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  // global: no org filter
  return safeSelect(q, 'sms_templates:listGlobal')
}

export default { listSmsTemplatesByOrg, listSmsTemplatesGlobal }
