// src/lib/supabaseClient.js
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  // Don't crash the app; just warn so UI can still render console.warn('Missing Supabase env (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).');
}

export const supabase = createClient(SUPABASE_URL || '', SUPABASE_ANON_KEY || '');
export default supabase;
