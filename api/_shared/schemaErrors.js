// Vendored from src/utils/schemaErrorClassifier.js — Vercel serverless functions
// can't reliably resolve `../src/...` imports at runtime (FUNCTION_INVOCATION_FAILED
// observed in production). Keep this file in sync if the canonical changes.

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

export function classifySchemaError(error) {
  const msg = String(error?.message || error || '').toLowerCase()

  if (
    /column .* does not exist/i.test(msg) ||
    /pgrst.*column/i.test(msg) ||
    (/could not find/i.test(msg) && /\bcolumn\b/i.test(msg) && /schema cache/i.test(msg))
  ) {
    if (/job_parts/i.test(msg) && /scheduled_(start|end)_time/i.test(msg)) {
      return SchemaErrorCode.MISSING_JOB_PARTS_SCHEDULED_TIMES
    }
    if (/job_parts/i.test(msg) && /vendor_id/i.test(msg)) {
      return SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_ID
    }
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

  if (/could not find a relationship/i.test(msg) || /relationship.*schema cache/i.test(msg)) {
    if (/job_parts/i.test(msg) && /vendors/i.test(msg)) {
      return SchemaErrorCode.MISSING_JOB_PARTS_VENDOR_RELATIONSHIP
    }
    return SchemaErrorCode.MISSING_FK
  }

  if (
    /schema cache/i.test(msg) &&
    !/could not find a relationship/i.test(msg) &&
    !/column/i.test(msg)
  ) {
    return SchemaErrorCode.STALE_CACHE
  }

  if (/cached schema/i.test(msg)) {
    return SchemaErrorCode.STALE_CACHE
  }

  return SchemaErrorCode.GENERIC
}
