import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'
import { toOptions } from '@/lib/options'
import {
  SMS_TEMPLATES_TABLE_AVAILABLE,
  disableSmsTemplatesCapability,
} from '@/utils/capabilityTelemetry'

export async function listSmsTemplatesByOrg(orgId, { activeOnly = true } = {}) {
  if (SMS_TEMPLATES_TABLE_AVAILABLE === false) return []
  let q = supabase
    .from('sms_templates')
    .select('id, name, message_template, is_active')
    .order('created_at', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  if (orgId) q = q.or(`dealer_id.eq.${orgId},dealer_id.is.null`)
  try {
    const rows = await safeSelect(q, 'sms_templates:listByOrg')
    return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase()
    if (msg.includes('sms_templates') && msg.includes('could not find the table')) {
      disableSmsTemplatesCapability()
      return []
    }
    throw e
  }
}

export async function listSmsTemplatesGlobal({ activeOnly = true } = {}) {
  if (SMS_TEMPLATES_TABLE_AVAILABLE === false) return []
  let q = supabase
    .from('sms_templates')
    .select('id, name, message_template, is_active')
    .order('created_at', { ascending: true })
  if (activeOnly) q = q.eq('is_active', true)
  // global: no org filter
  try {
    const rows = await safeSelect(q, 'sms_templates:listGlobal')
    return toOptions(rows, { labelKey: 'name', valueKey: 'id' })
  } catch (e) {
    const msg = String(e?.message || e || '').toLowerCase()
    if (msg.includes('sms_templates') && msg.includes('could not find the table')) {
      disableSmsTemplatesCapability()
      return []
    }
    throw e
  }
}

export default { listSmsTemplatesByOrg, listSmsTemplatesGlobal }
