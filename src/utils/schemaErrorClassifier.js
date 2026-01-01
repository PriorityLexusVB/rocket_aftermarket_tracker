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
  MISSING_JOB_PARTS_SCHEDULED_TIMES: 'MISSING_JOB_PARTS_SCHEDULED_TIMES',
  MISSING_JOB_PARTS_VENDOR_ID: 'MISSING_JOB_PARTS_VENDOR_ID',
  MISSING_JOB_PARTS_VENDOR_RELATIONSHIP: 'MISSING_JOB_PARTS_VENDOR_RELATIONSHIP',
  GENERIC: 'GENERIC',
}

/**
 * Migration ID mappings for specific schema issues
 */
export const MigrationMapping = {
  [SchemaErrorCode.MISSING_JOB_PARTS_SCHEDULED_TIMES]: {
    migrationId: '20250117000000',
    fileName: '20250117000000_add_job_parts_scheduling_times.sql',
    description: 'Adds scheduled_start_time and scheduled_end_time columns to job_parts',
  },
  [SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_ID]: {
    migrationId: '20251106000000',
    fileName: '20251106000000_add_job_parts_vendor_id.sql',
    description: 'Adds vendor_id column to job_parts with FK to vendors',
  },
  [SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_RELATIONSHIP]: {
    migrationId: '20251107093000',
    fileName: '20251107093000_verify_job_parts_vendor_fk.sql',
    description: 'Verifies and creates FK relationship between job_parts and vendors',
  },
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
  // PostgREST schema cache: "Could not find the 'xyz' column of 'table' in the schema cache"
  // Supabase: "PGRST...column"
  if (
    /column .* does not exist/i.test(msg) ||
    /pgrst.*column/i.test(msg) ||
    (/could not find/i.test(msg) && /\bcolumn\b/i.test(msg) && /schema cache/i.test(msg))
  ) {
    // Specialized job_parts columns
    if (/job_parts/i.test(msg) && /scheduled_(start|end)_time/i.test(msg)) {
      return SchemaErrorCode.MISSING_JOB_PARTS_SCHEDULED_TIMES
    }
    if (/job_parts/i.test(msg) && /vendor_id/i.test(msg)) {
      return SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_ID
    }
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
    // Detect job_parts -> vendors relationship specifically
    if (/job_parts/i.test(msg) && /vendors/i.test(msg)) {
      return SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_RELATIONSHIP
    }
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
    code === SchemaErrorCode.MISSING_PROFILE_DISPLAY_NAME ||
    code === SchemaErrorCode.MISSING_JOB_PARTS_SCHEDULED_TIMES ||
    code === SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_ID
  )
}

/**
 * Check if an error is a missing FK/relationship error
 * @param {Error|string} error
 * @returns {boolean}
 */
export function isMissingRelationshipError(error) {
  const code = classifySchemaError(error)
  return (
    code === SchemaErrorCode.MISSING_FK ||
    code === SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_RELATIONSHIP
  )
}

/**
 * Check if an error is a stale cache error
 * @param {Error|string} error
 * @returns {boolean}
 */
export function isStaleCacheError(error) {
  return classifySchemaError(error) === SchemaErrorCode.STALE_CACHE
}

/**
 * Get remediation guidance for a schema error
 * @param {Error|string} error - The error to get guidance for
 * @returns {Object} - Remediation object with migration info and instructions
 */
export function getRemediationGuidance(error) {
  const code = classifySchemaError(error)
  const migration = MigrationMapping[code]

  const msg = String(error?.message || error || '').toLowerCase()

  // Special-case: loaner_assignments is scoped via jobs.org_id in this repo's RLS model.
  // If a caller includes org_id in a request payload (insert/update/select), PostgREST will
  // reject it when the column doesn't exist (common) or when the schema cache is stale.
  if (code === SchemaErrorCode.MISSING_COLUMN) {
    const mentionsLoaners = /\bloaner_assignments\b/i.test(msg)
    const mentionsOrgId = /\borg_id\b/i.test(msg)
    if (mentionsLoaners && mentionsOrgId) {
      return {
        code,
        instructions: [
          'Do not reference loaner_assignments.org_id in REST queries or payloads.',
          'Tenant scoping for loaner_assignments is enforced via jobs.org_id (RLS policy joins through jobs).',
          "If you recently added org_id to loaner_assignments, run: NOTIFY pgrst, 'reload schema';",
        ],
      }
    }
  }

  if (migration) {
    return {
      code,
      migrationId: migration.migrationId,
      migrationFile: migration.fileName,
      description: migration.description,
      instructions: [
        `Apply migration: supabase/migrations/${migration.fileName}`,
        `Run: NOTIFY pgrst, 'reload schema';`,
        `Verify: Check health endpoint /api/health/capabilities`,
      ],
    }
  }

  // Generic guidance for unclassified errors
  return {
    code,
    instructions: [
      'Check database connectivity',
      'Verify RLS policies are correct',
      'Ensure all migrations are applied',
      "Run: NOTIFY pgrst, 'reload schema';",
    ],
  }
}

/**
 * Extract specific column name from error message
 * @param {Error|string} error
 * @returns {string|null} - Column name or null
 */
export function extractColumnName(error) {
  const msg = String(error?.message || error || '')
  const match = msg.match(/column\s+"?(\w+)"?\s+does not exist/i)
  return match ? match[1] : null
}
