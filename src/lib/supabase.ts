import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL || 'http://localhost:54321'
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY || 'test_anon_key'

export const supabase = createClient(url, anon)
