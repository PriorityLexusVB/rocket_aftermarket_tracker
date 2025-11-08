// Vercel serverless function: /api/health-deals-rel
// Mirrors logic from src/api/health-deals-rel.js but runnable as a serverless endpoint.
// Detects jobs -> job_parts -> vendors relationship health.

import { createClient } from '@supabase/supabase-js'
import { classifySchemaError, SchemaErrorCode } from '../src/utils/schemaErrorClassifier.js'

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } })

async function checkColumnExists() {
  try {
    const { error } = await supabase.from('job_parts').select('vendor_id').limit(0)
    return !error
  } catch {
    return null
  }
}

async function checkFkExists() {
  // Heuristic: if selecting vendor_id succeeds, assume FK present or at least column exists.
  return await checkColumnExists()
}

export default async function handler(req, res) {
  const started = Date.now()
  const diagnostics = {
    hasColumn: null,
    hasFk: null,
    fkName: 'job_parts_vendor_id_fkey',
    cacheRecognized: false,
    restQueryOk: false,
  }

  diagnostics.hasColumn = await checkColumnExists()
  diagnostics.hasFk = await checkFkExists()

  try {
    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_parts(id, vendor_id, vendor:vendor_id(id, name))')
      .limit(1)

    if (error) {
      const code = classifySchemaError(error)
      const classification =
        code === SchemaErrorCode.MISSING_COLUMN
          ? 'missing_column'
          : code === SchemaErrorCode.MISSING_FK
            ? 'missing_fk'
            : code === SchemaErrorCode.STALE_CACHE
              ? 'stale_cache'
              : 'other'

      return res.status(200).json({
        ok: false,
        classification,
        ...diagnostics,
        error: error.message,
        advice:
          classification === 'missing_fk'
            ? 'Add FK & NOTIFY pgrst to reload schema'
            : classification === 'missing_column'
              ? 'Add vendor_id column to job_parts'
              : classification === 'stale_cache'
                ? 'NOTIFY pgrst, "reload schema"'
                : 'Inspect error message',
        ms: Date.now() - started,
      })
    }

    diagnostics.restQueryOk = true
    diagnostics.cacheRecognized = true
    return res.status(200).json({
      ok: true,
      classification: 'ok',
      ...diagnostics,
      rowsChecked: data?.length || 0,
      ms: Date.now() - started,
    })
  } catch (e) {
    const code = classifySchemaError(e)
    const classification =
      code === SchemaErrorCode.MISSING_COLUMN
        ? 'missing_column'
        : code === SchemaErrorCode.MISSING_FK
          ? 'missing_fk'
          : code === SchemaErrorCode.STALE_CACHE
            ? 'stale_cache'
            : 'other'
    return res.status(500).json({
      ok: false,
      classification,
      ...diagnostics,
      error: e.message,
      ms: Date.now() - started,
    })
  }
}
