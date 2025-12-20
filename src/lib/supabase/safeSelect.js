// src/lib/supabase/safeSelect.js
/**
 * Wrap a Postgrest query and make failures loud, with graceful RLS handling.
 * @param {any} q Postgrest query builder
 * @param {string} label optional label for logging
 * @param {object} opts optional configuration { allowRLS: boolean }
 * @returns {Promise<Array>} query results or empty array on RLS denial
 */
export async function safeSelect(q, label, opts = {}) {
  const { allowRLS = true } = opts

  try {
    const res = await q.throwOnError()
    // q.throwOnError() usually returns { data, error, count }
    return res.data ?? res
  } catch (e) {
    const errorType = classifyError(e)

    // Handle RLS/permission errors gracefully if allowed
    if (allowRLS && (errorType === 'rls' || errorType === 'permission')) {
      console.warn(
        `[safeSelect] ${label ?? 'query'} encountered RLS/permission denial (returning []):`,
        e?.message
      )
      return []
    }

    // Keep an informative, searchable log for other errors

    console.error(`[safeSelect] ${label ?? 'query'} failed (${errorType}):`, e)

    // Return structured error info for capability toggles
    if (errorType === 'missing_column' || errorType === 'missing_relationship') {
      throw {
        originalError: e,
        type: errorType,
        message: e?.message,
        // Extract column/relationship name if possible
        details: extractErrorDetails(e),
      }
    }

    throw e
  }
}

/**
 * Classify PostgREST errors into categories for easier handling
 * @param {Error} error
 * @returns {string} error type: 'missing_column' | 'missing_relationship' | 'rls' | 'permission' | 'unknown'
 */
function classifyError(error) {
  const msg = String(error?.message || '').toLowerCase()
  const code = String(error?.code || '').toLowerCase()

  // Missing column errors
  if (
    /column .* does not exist/i.test(msg) ||
    /PGRST.*column/i.test(msg) ||
    /Could not find.*column.*in the schema cache/i.test(msg)
  ) {
    return 'missing_column'
  }

  // Missing relationship errors
  if (/Could not find a relationship between .* in the schema cache/i.test(msg)) {
    return 'missing_relationship'
  }

  // RLS/permission errors
  if (
    code === 'pgrst116' ||
    code === '42501' ||
    msg.includes('permission denied') ||
    msg.includes('rls') ||
    msg.includes('row-level security')
  ) {
    return 'rls'
  }

  if (msg.includes('permission')) {
    return 'permission'
  }

  return 'unknown'
}

/**
 * Extract useful details from error messages for debugging
 * @param {Error} error
 * @returns {object} extracted details
 */
function extractErrorDetails(error) {
  const msg = String(error?.message || '')

  // Extract column name from "column X does not exist"
  const colMatch = msg.match(/column\s+["']?(\w+)["']?\s+does not exist/i)
  if (colMatch) {
    return { column: colMatch[1] }
  }

  // Extract relationship from "Could not find a relationship between 'X' and 'Y'"
  const relMatch = msg.match(/relationship between\s+["'](\w+)["']\s+and\s+["'](\w+)["']/i)
  if (relMatch) {
    return { fromTable: relMatch[1], toTable: relMatch[2] }
  }

  return {}
}

export default safeSelect
