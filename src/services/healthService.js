import { supabase } from '../lib/supabaseClient';

export async function pingSupabase() {
  // lightweight table/view you always can read
  const { error } = await supabase?.from('user_profiles')?.select('id')?.limit(1);
  return { ok: !error, error };
}