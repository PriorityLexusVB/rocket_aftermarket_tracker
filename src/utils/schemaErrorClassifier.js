// src/utils/schemaErrorClassifier.js
// Error classification utility for schema-related issues
// Centralizes detection of PostgREST/Supabase error types

/**
 * Error classification codes
 */
export const SchemaErrorCode = {
  MISSING_COLUMN: 'MISSING_COLUMN',
  MISSING_FK: 'MISSING_FK',
  STALE_CACHE: 'STALE_CACHE',
  MISSING_PROFILE_NAME: 'MISSING_PROFILE_NAME',
  MISSING_PROFILE_FULL_NAME: 'MISSING_PROFILE_FULL_NAME',
  MISSING_PROFILE_DISPLAY_NAME: 'MISSING_PROFILE_DISPLAY_NAME',
  GENERIC: 'GENERIC',
}

/**
 * Classify a schema-related error based on PostgREST/Supabase error messages
 * @param {Error|string} error - The error object or message to classify
 * @returns {string} - One of SchemaErrorCode values
 */
export function classifySchemaError(error) {
  const msg = String(error?.message || error || '').toLowerCase()

  // Check for missing column errors
  // PostgREST: "column \"xyz\" does not exist"
  // Supabase: "PGRST...column"
  if (/column .* does not exist/i.test(msg) || /pgrst.*column/i.test(msg)) {
    // Specialized user_profiles columns
    if (/user_profiles.*\bname\b/i.test(msg) && !/full_name|display_name/i.test(msg)) {
      return SchemaErrorCode.MISSING_PROFILE_NAME
    }
    if (/user_profiles.*full_name/i.test(msg)) {
      return SchemaErrorCode.MISSING_PROFILE_FULL_NAME
    }
    if (/user_profiles.*display_name/i.test(msg)) {
      return SchemaErrorCode.MISSING_PROFILE_DISPLAY_NAME
    }
    return SchemaErrorCode.MISSING_COLUMN
  }

  // Check for missing relationship/FK errors
  // PostgREST: "Could not find a relationship between 'table1' and 'table2' in the schema cache"
  if (/could not find a relationship/i.test(msg) || /relationship.*schema cache/i.test(msg)) {
    return SchemaErrorCode.MISSING_FK
  }

  // Check for stale cache signatures
  // This is a heuristic: REST expansion fails but SQL checks would pass
  // Typically seen when FK exists in DB but PostgREST cache is stale
  if (
    /schema cache/i.test(msg) &&
    !/could not find a relationship/i.test(msg) &&
    !/column/i.test(msg)
  ) {
    return SchemaErrorCode.STALE_CACHE
  }

  // Also check for generic cache-related issues
  if (/cached schema/i.test(msg)) {
    return SchemaErrorCode.STALE_CACHE
  }

  // Generic error (network, timeout, permission, etc.)
  return SchemaErrorCode.GENERIC
}

/**
 * Check if an error is a missing column error
 * @param {Error|string} error
 * @returns {boolean}
 */
export function isMissingColumnError(error) {
  const code = classifySchemaError(error)
  return (
    code === SchemaErrorCode.MISSING_COLUMN ||
    code === SchemaErrorCode.MISSING_PROFILE_NAME ||
    code === SchemaErrorCode.MISSING_PROFILE_FULL_NAME ||
    code === SchemaErrorCode.MISSING_PROFILE_DISPLAY_NAME
  )
}

/**
 * Check if an error is a missing FK/relationship error
 * @param {Error|string} error
 * @returns {boolean}
 */
export function isMissingRelationshipError(error) {
  return classifySchemaError(error) === SchemaErrorCode.MISSING_FK
}

/**
 * Check if an error is a stale cache error
 * @param {Error|string} error
 * @returns {boolean}
 */
export function isStaleCacheError(error) {
  return classifySchemaError(error) === SchemaErrorCode.STALE_CACHE
}
