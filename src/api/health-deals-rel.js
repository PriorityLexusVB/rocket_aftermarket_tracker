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
    const { data, error } = await supabase.rpc('check_column_exists', {
      p_table: 'job_parts',
      p_column: 'vendor_id',
    })
    // If RPC doesn't exist, fall back to a query that would fail on missing column
    if (error?.code === '42883') {
      // Function doesn't exist, try direct query
      const { error: queryError } = await supabase
        .from('job_parts')
        .select('vendor_id')
        .limit(0)
      return !queryError
    }
    return !!data
  } catch {
    return null // Unknown
  }
}

/**
 * Check if FK constraint exists (approximation via query)
 */
async function checkFkExists() {
  try {
    // Query the foreign key - if it exists, this should work
    const { data, error } = await supabase
      .from('job_parts')
      .select('vendor_id')
      .limit(0)
    return !error
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
