import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import { toOptions } from '@/lib/options'

export async function listSmsTemplatesByOrg(orgId, { activeOnly = true } = {}) {
  let q = supabase
    .from('sms_templates')
    .select('id, name, message_template, is_active')
    .order('created_at', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.or(`org_id.eq.${orgId},org_id.is.null`)
  const rows = await safeSelect(q, 'sms_templates:listByOrg')
  return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
}

export async function listSmsTemplatesGlobal({ activeOnly = true } = {}) {
  let q = supabase
    .from('sms_templates')
    .select('id, name, message_template, is_active')
    .order('created_at', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  // global: no org filter
  const rows = await safeSelect(q, 'sms_templates:listGlobal')
  return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
}

export default { listSmsTemplatesByOrg, listSmsTemplatesGlobal }
