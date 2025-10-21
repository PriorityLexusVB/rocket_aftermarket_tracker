import { supabase } from '@/lib/supabaseClient'
import { safeSelect } from '@/lib/supabase/safeSelect'

export function listSmsTemplatesByOrg(orgId) {
  return safeSelect(
    supabase
      .from('sms_templates')
      .select('*')
      .eq('org_id', orgId)
      .order('title', { ascending: true }),
    'sms_templates:listByOrg'
  )
}

export default { listSmsTemplatesByOrg }
