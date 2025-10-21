import { supabase } from '@/lib/supabaseClient'
import { safeSelect } from '@/lib/supabase/safeSelect'

export function listProductsByOrg(orgId) {
  return safeSelect(
    supabase.from('products').select('*').eq('org_id', orgId).order('name', { ascending: true }),
    'products:listByOrg'
  )
}

export default { listProductsByOrg }
// src/services/productService.js
import { supabase } from '../lib/supabaseClient'

export const productService = {
  async getAllActive() {
    const { data, error } = await supabase
      ?.from('products')
      ?.select('*')
      ?.eq('is_active', true)
      ?.order('name', { ascending: true })
    if (error) {
      console.error('Error fetching products:', error)
      return []
    }
    return data || []
  },
}
