// /api/health/deals-rel
// Purpose: Validate critical deals-related nested relationships (jobs -> job_parts -> vendors)
// Returns JSON status indicating whether the vendor relationship is operational.
// This helps quickly detect PostgREST schema cache drift or missing FK constraints.
// Enhanced with granular diagnostics for troubleshooting.

import { supabase } from '@/lib/supabase'
import { classifySchemaError, SchemaErrorCode } from '@/utils/schemaErrorClassifier'

/**
 * Check if column exists in database schema
 */
async function checkColumnExists() {
  try {
    // Try to select the column - if it doesn't exist, we'll get a PGRST error
    const { error } = await supabase.from('job_parts').select('vendor_id').limit(0)
    
    if (!error) return true
    
    // Check if it's a column not found error.
    // Prefer the structured PostgREST error code and only fall back to message inspection.
    // Relies on PostgREST v11+ error code PGRST204 ("Column not found").
    if (error.code === 'PGRST204') {
      return false
    }
    
    // Fallback: Check message only if code is not specific
    if (error.message && (error.message.includes('column') || error.message.includes('vendor_id'))) {
      return false
    }
    
    return null // Unknown - other error
  } catch {
    return null // Unknown
  }
}

/**
 * Check if FK constraint exists (approximation via query)
 */
async function checkFkExists() {
  try {
    // Try to use the FK relationship - if FK doesn't exist, this will fail
    const { error } = await supabase
      .from('job_parts')
      .select('vendor:vendor_id(id)')
      .limit(0)
    
    if (!error) return true
    
    // Prefer structured PostgREST error codes over brittle message matching.
    // Based on PostgREST v11+ error codes, a missing relationship or FK can surface
    // as a PGRST2xx error. We treat known relationship/FK-related codes here first
    // and only fall back to message inspection if the code is missing or unknown.
    if (error.code === 'PGRST201') {
      // Relationship not found between tables (e.g., could not find relationship job_parts -> vendors)
      return false
    }
    
    // Fallback: Check if it's a relationship/FK error by message when code is not specific.
    if (
      error.message?.includes('relationship') ||
      error.message?.includes('foreign key') ||
      error.message?.includes('vendor_id')
    ) {
      return false
    }
    
    return null // Unknown - other error
  } catch {
    return null // Unknown
  }
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

  try {
    // Step 1: Check column existence (best effort)
    diagnostics.hasColumn = await checkColumnExists()

    // Step 2: Check FK existence (best effort)
    diagnostics.hasFk = await checkFkExists()

    // Step 3: Test REST API relationship query (the real test)
    const { data, error } = await supabase
      .from('jobs')
      .select('id, job_parts(id, vendor_id, vendor:vendor_id(id, name))')
      .limit(1)

    if (error) {
      const errorCode = classifySchemaError(error)
      const classification =
        errorCode === SchemaErrorCode.MISSING_COLUMN
          ? 'missing_column'
          : errorCode === SchemaErrorCode.MISSING_FK
            ? 'missing_fk'
            : errorCode === SchemaErrorCode.STALE_CACHE
              ? 'stale_cache'
              : 'other'

      diagnostics.restQueryOk = false
      diagnostics.cacheRecognized = false

      return res?.status(200)?.json({
        ok: false,
        classification,
        ...diagnostics,
        error: error?.message,
        advice:
          classification === 'missing_fk'
            ? 'Run verify-schema-cache.sh then apply vendor_id FK migration or NOTIFY pgrst, "reload schema"'
            : classification === 'missing_column'
              ? 'Run migration to add vendor_id column to job_parts table'
              : classification === 'stale_cache'
                ? 'Execute NOTIFY pgrst, "reload schema" to refresh PostgREST cache'
                : 'Check error message for details',
        ms: Date.now() - started,
      })
    }

    // Success: relationship is working
    diagnostics.restQueryOk = true
    diagnostics.cacheRecognized = true

    return res?.status(200)?.json({
      ok: true,
      classification: 'ok',
      ...diagnostics,
      rowsChecked: data?.length ?? 0,
      ms: Date.now() - started,
    })
  } catch (error) {
    diagnostics.restQueryOk = false
    const errorCode = classifySchemaError(error)
    const classification =
      errorCode === SchemaErrorCode.MISSING_COLUMN
        ? 'missing_column'
        : errorCode === SchemaErrorCode.MISSING_FK
          ? 'missing_fk'
          : errorCode === SchemaErrorCode.STALE_CACHE
            ? 'stale_cache'
            : 'other'

    return res?.status(500)?.json({
      ok: false,
      classification,
      ...diagnostics,
      error: error?.message,
      ms: Date.now() - started,
    })
  }
}
