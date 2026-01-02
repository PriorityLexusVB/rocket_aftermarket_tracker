// src/services/realtimeService.js
// Subscribes to Supabase Realtime changes on vendors/products/user_profiles
// and clears dropdown caches to keep UI options fresh.

import { supabase } from '@/lib/supabase'
import { clearDropdownCache } from './dropdownService'

/**
 * Initialize realtime listeners that bust dropdown caches when underlying data changes.
 * Returns a cleanup function to unsubscribe.
 */
export function initDropdownCacheRealtime(orgId) {
  try {
    const channel = supabase.channel('dropdown-cache')

    const base = { event: '*', schema: 'public' }
    const orgFilter = orgId ? `dealer_id=eq.${orgId}` : undefined

    channel.on('postgres_changes', { ...base, table: 'vendors', filter: orgFilter }, () => {
      try {
        clearDropdownCache()
      } catch {}
    })

    channel.on('postgres_changes', { ...base, table: 'products', filter: orgFilter }, () => {
      try {
        clearDropdownCache()
      } catch {}
    })

    channel.on('postgres_changes', { ...base, table: 'user_profiles', filter: orgFilter }, () => {
      try {
        clearDropdownCache()
      } catch {}
    })

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.debug('[realtime] dropdown-cache subscribed', { orgId })
      }
    })

    return () => {
      try {
        supabase.removeChannel(channel)
      } catch {}
    }
  } catch (e) {
    console.warn('[realtime] init failed:', e?.message || e)
    return () => {}
  }
}
