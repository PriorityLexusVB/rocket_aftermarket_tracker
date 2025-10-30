// src/lib/safeSelect.js
// Legacy shim: re-export the canonical safeSelect from src/lib/supabase/safeSelect
// This keeps older imports working while we standardize on '@/lib/supabase/safeSelect'.
export { safeSelect as default, safeSelect } from '@/lib/supabase/safeSelect'
