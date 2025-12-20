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
    return null
  }
}

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
    return null
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

      const response = {
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
      }

      // Handle both Express-like and Node.js http response objects
      if (typeof res.status === 'function') {
        return res.status(200).json(response)
      } else {
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify(response))
      }
    }

    diagnostics.restQueryOk = true
    diagnostics.cacheRecognized = true
    
    const response = {
      ok: true,
      classification: 'ok',
      ...diagnostics,
      rowsChecked: data?.length || 0,
      ms: Date.now() - started,
    }

    // Handle both Express-like and Node.js http response objects
    if (typeof res.status === 'function') {
      return res.status(200).json(response)
    } else {
      res.statusCode = 200
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(response))
    }
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
    
    const response = {
      ok: false,
      classification,
      ...diagnostics,
      error: e.message,
      ms: Date.now() - started,
    }

    // Handle both Express-like and Node.js http response objects
    if (typeof res.status === 'function') {
      return res.status(500).json(response)
    } else {
      res.statusCode = 500
      res.setHeader('Content-Type', 'application/json')
      res.end(JSON.stringify(response))
    }
  }
}
