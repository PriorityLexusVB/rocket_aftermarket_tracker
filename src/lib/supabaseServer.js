// src/lib/supabaseServer.js (server-only usage!)
import { createClient } from '@supabase/supabase-js';

export const supabaseServer = () => {
  const url = process.env?.NEXT_PUBLIC_SUPABASE_URL;
  const service = process.env?.SUPABASE_SERVICE_KEY;
  return createClient(url, service, { auth: { persistSession: false } });
};