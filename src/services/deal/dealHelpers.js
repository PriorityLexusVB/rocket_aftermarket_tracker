// src/services/deal/dealHelpers.js
// Shared helpers, constants, capability detection, and session cap management
import { supabase } from '@/lib/supabase'
import {
  classifySchemaError,
  isMissingColumnError,
  isMissingRelationshipError,
  getRemediationGuidance,
} from '@/utils/schemaErrorClassifier'
import { incrementTelemetry, TelemetryKey } from '@/utils/capabilityTelemetry'

export { supabase }
export { classifySchemaError, isMissingColumnError, isMissingRelationshipError, getRemediationGuidance }
export { incrementTelemetry, TelemetryKey }

export const IS_TEST_ENV =
  typeof import.meta !== 'undefined' &&
  import.meta?.env &&
  (import.meta.env?.MODE === 'test' || import.meta.env?.VITEST)

export const SHOULD_LOG_SCHEMA_WARNINGS =
  (typeof import.meta !== 'undefined' && import.meta?.env?.DEV) || IS_TEST_ENV

export function warnSchema(...args) {
  if (!SHOULD_LOG_SCHEMA_WARNINGS) return
  console.warn(...args)
}

// Some environments may not have loaner_assignments.dealer_id yet.
// Cache the capability after first detection so we don't repeatedly trigger
// PostgREST 400 responses on subsequent loaner saves.
// null = unknown, true = present, false = missing
export let loanerAssignmentsHasDealerId = null
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_loanerAssignmentsDealerId')
  if (stored === 'false') loanerAssignmentsHasDealerId = false
  if (stored === 'true') loanerAssignmentsHasDealerId = true
}

export function setLoanerAssignmentsDealerIdCapability(value) {
  loanerAssignmentsHasDealerId = value
  if (typeof sessionStorage !== 'undefined') {
    if (value === true) sessionStorage.setItem('cap_loanerAssignmentsDealerId', 'true')
    if (value === false) sessionStorage.setItem('cap_loanerAssignmentsDealerId', 'false')
  }
}

export function readSessionCap(key) {
  if (typeof sessionStorage === 'undefined') return null
  const stored = sessionStorage.getItem(key)
  if (stored === 'false') return false
  if (stored === 'true') return true
  return null
}

export function writeSessionCap(key, value) {
  if (typeof sessionStorage === 'undefined') return
  if (value === true) sessionStorage.setItem(key, 'true')
  if (value === false) sessionStorage.setItem(key, 'false')
}

// Some environments may not have loaner_assignments.returned_at yet.
// Cache after first detection to avoid repeated 400s on every page load.
export let loanerAssignmentsHasReturnedAt = readSessionCap('cap_loanerAssignmentsReturnedAt')
export function setLoanerAssignmentsReturnedAtCapability(value) {
  loanerAssignmentsHasReturnedAt = value
  writeSessionCap('cap_loanerAssignmentsReturnedAt', value)
}

// Some environments may not have jobs.next_promised_iso yet.
export let jobsHasNextPromisedIso = readSessionCap('cap_jobsNextPromisedIso')
export function setJobsNextPromisedIsoCapability(value) {
  jobsHasNextPromisedIso = value
  writeSessionCap('cap_jobsNextPromisedIso', value)
}

// Some environments have job_status as an enum that does NOT include "draft".
export let jobsJobStatusSupportsDraft = readSessionCap('cap_jobsJobStatusDraft')
export function setJobsJobStatusDraftCapability(value) {
  jobsJobStatusSupportsDraft = value
  writeSessionCap('cap_jobsJobStatusDraft', value)
}

export function applyReturnedAtIsNullFilter(q) {
  if (!q) return q
  if (loanerAssignmentsHasReturnedAt === false) return q
  return typeof q.is === 'function' ? q.is('returned_at', null) : q
}

// --- helpers -------------------------------------------------------------

/**
 * Check if an error is an RLS (Row Level Security) permission error.
 * Used to gracefully handle access denied scenarios without failing operations.
 * @param {Error|Object} error - The error from Supabase/PostgREST
 * @returns {boolean} - True if the error is an RLS permission error
 */
export function isRlsError(error) {
  if (!error) return false
  const errMsg = String(error?.message || '').toLowerCase()
  const errCode = error?.code
  // Check for common RLS/permission error codes and messages
  // 42501: insufficient_privilege (PostgreSQL)
  // PGRST*: PostgREST errors
  return (
    errCode === '42501' ||
    (errCode && String(errCode).toUpperCase().startsWith('PGRST')) ||
    errMsg.includes('policy') ||
    errMsg.includes('permission') ||
    errMsg.includes('rls') ||
    errMsg.includes('row-level security')
  )
}

export function isMissingReturnedAtError(error) {
  return isMissingColumnError(error) && /\breturned_at\b/i.test(String(error?.message || ''))
}

// Safely sum job_parts when transactions are unavailable (e.g., RLS blocks read)
export function sumJobParts(parts = []) {
  return (parts || []).reduce((sum, part) => {
    const qty = Number(part?.quantity_used ?? part?.quantity ?? 0) || 0
    const price = Number(part?.unit_price ?? part?.price ?? 0) || 0
    return sum + qty * price
  }, 0)
}

/**
 * Get the current user's org_id with multiple fallback strategies.
 * Attempts to find org_id by:
 * 1. user_profiles.id = auth.uid() (standard case)
 * 2. user_profiles.auth_user_id = auth.uid() (legacy/alternative linking)
 * 3. user_profiles.email = user.email (final fallback)
 *
 * This aligns with the database function auth_user_org() which also checks
 * both id and auth_user_id columns (see migration 20251129231539).
 *
 * @param {string} label - Label for logging (e.g., 'create', 'update')
 * @returns {Promise<string|null>} - The org_id or null if not found
 */
export async function getUserOrgIdWithFallback(label = 'operation') {
  try {
    const { data: auth } = await supabase?.auth?.getUser?.()
    const userId = auth?.user?.id
    const userEmail = auth?.user?.email

    // Strategy 1: Try to find profile by id (standard case: user_profiles.id = auth.uid())
    if (userId) {
      const { data: prof, error: profErr } = await supabase
        ?.from('user_profiles')
        ?.select('dealer_id')
        ?.eq('id', userId)
        ?.maybeSingle()

      const tenantId = prof?.dealer_id
      if (tenantId) {
        return tenantId
      }
      if (profErr && isRlsError(profErr)) {
        console.warn(
          `[dealService:${label}] RLS blocked profile lookup by id, trying auth_user_id fallback`
        )
      }
    }

    // Strategy 2: Try to find profile by auth_user_id (legacy/alternative linking)
    // This handles cases where user_profiles.id != auth.uid() but auth_user_id = auth.uid()
    // Aligns with database function auth_user_org() behavior (migration 20251129231539)
    if (userId) {
      const { data: profByAuthUserId, error: authUserIdErr } = await supabase
        ?.from('user_profiles')
        ?.select('dealer_id')
        ?.eq('auth_user_id', userId)
        ?.order('created_at', { ascending: false })
        ?.limit(1)
        ?.maybeSingle()

      const tenantId = profByAuthUserId?.dealer_id
      if (tenantId) {
        console.info(`[dealService:${label}] Found tenant id via auth_user_id lookup`)
        return tenantId
      }
      if (authUserIdErr && isRlsError(authUserIdErr)) {
        console.warn(
          `[dealService:${label}] RLS blocked profile lookup by auth_user_id, trying email fallback`
        )
      }
    }

    // Strategy 3: Try to find profile by email (final fallback)
    if (userEmail) {
      const { data: profByEmail, error: emailErr } = await supabase
        ?.from('user_profiles')
        ?.select('dealer_id')
        ?.eq('email', userEmail)
        ?.order('created_at', { ascending: false }) // Order by created_at descending to select most recently created profile when multiple exist
        ?.limit(1)
        ?.maybeSingle()

      const tenantId = profByEmail?.dealer_id
      if (tenantId) {
        console.info(`[dealService:${label}] Found tenant id via email fallback`)
        return tenantId
      }
      if (emailErr && isRlsError(emailErr)) {
        console.warn(
          `[dealService:${label}] RLS blocked profile lookup by email:`,
          emailErr?.message
        )
      }
    }

    return null
  } catch (e) {
    console.warn(`[dealService:${label}] Unable to get user org_id:`, e?.message)
    return null
  }
}

// Only pass columns we're confident exist on your `jobs` table.
// Add more keys here if you confirm additional columns.
export const JOB_COLS = [
  'job_number',
  'title',
  'description',
  // NOTE: 'notes' column does not exist in DB schema yet - UI "Notes" maps to description
  'vehicle_id',
  'vendor_id',
  'job_status',
  'priority',
  'location',
  'scheduled_start_time',
  'scheduled_end_time',
  'estimated_hours',
  'estimated_cost',
  'actual_cost',
  'customer_needs_loaner', // ✅ CONFIRMED: This column exists
  'service_type',
  'delivery_coordinator_id',
  'finance_manager_id', // ✅ ADDED: Missing from previous list
  'assigned_to',
  // Optional multi-tenant scoping when present
  'dealer_id',
]

export function pick(obj, keys) {
  const out = {}
  keys?.forEach((k) => {
    if (obj?.[k] !== undefined) out[k] = obj?.[k]
  })
  return out
}

export function sanitizeDealPayload(input) {
  const out = pick(input || {}, JOB_COLS)
  // Generic: coerce empty-string primitives to null so DB types (uuid/timestamp/numeric) don't error
  Object.keys(out).forEach((k) => {
    if (out[k] === '') out[k] = null
  })
  return out
}

// Generate a readable unique-ish transaction number
export function generateTransactionNumber() {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 1_0000)
  return `TXN-${ts}-${rand}`
}

// NOTE: Error classification functions now imported from @/utils/schemaErrorClassifier
// This provides centralized error detection and remediation guidance

// Helper: Generic title detection pattern
export const GENERIC_TITLE_PATTERN = /^(Deal\s+[\w-]+|Untitled Deal)$/i

// Helper: Derive vehicle description from title or vehicle fields
export function deriveVehicleDescription(title, vehicle) {
  let vehicleDescription = ''
  const titleStr = title || ''
  const isGenericTitle = GENERIC_TITLE_PATTERN.test(titleStr.trim())

  if (titleStr && !isGenericTitle) {
    vehicleDescription = titleStr
  } else if (vehicle) {
    const parts = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean)
    if (parts.length > 0) {
      vehicleDescription = parts.join(' ')
    }
  }
  return vehicleDescription
}

// Helper: Aggregate vendor from line items
export function aggregateVendor(jobParts, jobLevelVendorName) {
  const offSiteLineItems = (jobParts || []).filter((p) => p?.is_off_site)

  // Get effective vendor names: prefer line item vendor_id, fallback to product vendor_id
  const lineVendors = offSiteLineItems
    .map((p) => {
      // Priority: p.vendor?.name (from vendor_id), then p.product?.vendor relationship name
      return p?.vendor?.name || null
    })
    .filter(Boolean)

  const uniqueVendors = [...new Set(lineVendors)]

  if (uniqueVendors.length === 1) {
    return uniqueVendors[0]
  }
  if (uniqueVendors.length > 1) {
    return 'Mixed'
  }
  // No line item vendors, fall back to job-level vendor or show unassigned
  return jobLevelVendorName || 'Unassigned'
}

/**
 * Map permission errors to friendly, actionable guidance.
 * Specifically handles "permission denied for table users" which occurs when
 * RLS policies incorrectly reference auth.users instead of public.user_profiles.
 *
 * @param {Error} err - The error from Supabase/PostgREST
 * @throws {Error} - Throws a new error with friendly guidance if pattern matches, otherwise re-throws original
 */
export function mapPermissionError(err) {
  const msg = String(err?.message || '').toLowerCase()

  // Pattern: "permission denied for table users" or "permission denied for relation users"
  if (/permission denied for (table |relation )?users/i.test(msg)) {
    throw new Error(
      'Failed to save: RLS prevented update on auth.users. ' +
        'Likely a policy references auth.users. ' +
        "Remediation: NOTIFY pgrst, 'reload schema' then retry; " +
        'update policy to reference public.user_profiles or tenant-scoped conditions. ' +
        'See docs/MCP-NOTES.md and .artifacts/mcp-introspect/INTROSPECTION.md for details.'
    )
  }

  // Re-throw original error if not a known permission pattern
  throw err
}

// Helper: wrap common PostgREST permission errors with actionable guidance
// This function uses mapPermissionError internally for consistency
export function wrapDbError(error, actionLabel = 'operation') {
  const raw = String(error?.message || error || '')
  if (/permission denied for (table |relation )?users/i.test(raw)) {
    // Use the new mapPermissionError for consistent messaging
    try {
      mapPermissionError(error)
    } catch (mappedErr) {
      // Prepend the action label
      return new Error(`Failed to ${actionLabel}: ${mappedErr.message}`)
    }
  }
  return new Error(`Failed to ${actionLabel}: ${error?.message || error}`)
}

// --- Capability detection for job_parts per-line time windows -------------
// Default to true, but can be disabled if the environment lacks scheduled_start_time/scheduled_end_time columns
export let JOB_PARTS_HAS_PER_LINE_TIMES = true

// Initialize from sessionStorage on module load
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_jobPartsTimes')
  if (stored === 'false') {
    JOB_PARTS_HAS_PER_LINE_TIMES = false
  }
}

// Mark capability as unavailable and persist to sessionStorage
export function disableJobPartsTimeCapability() {
  JOB_PARTS_HAS_PER_LINE_TIMES = false
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_jobPartsTimes', 'false')
  }
}

// --- Capability detection for job_parts ↔ vendors relationship -------------
// Default to true, assume relationship exists unless proven otherwise
export let JOB_PARTS_VENDOR_REL_AVAILABLE = true

// Initialize from sessionStorage on module load
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_jobPartsVendorRel')
  if (stored === 'false') {
    JOB_PARTS_VENDOR_REL_AVAILABLE = false
  }
}

// Mark vendor relationship capability as unavailable and persist to sessionStorage
export function disableJobPartsVendorRelCapability() {
  JOB_PARTS_VENDOR_REL_AVAILABLE = false
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_jobPartsVendorRel', 'false')
  }
}

// Mark vendor relationship capability as available (after successful query)
export function enableJobPartsVendorRelCapability() {
  JOB_PARTS_VENDOR_REL_AVAILABLE = true
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_jobPartsVendorRel', 'true')
  }
}

// Direct setter for JOB_PARTS_VENDOR_REL_AVAILABLE (used by getAllDeals sessionStorage refresh)
export function setJobPartsVendorRelAvailable(value) {
  JOB_PARTS_VENDOR_REL_AVAILABLE = value
}

// --- Capability detection for job_parts.vendor_id column --------------------
// Some pre-migration environments may not yet have per-line vendor_id.
// We degrade gracefully by omitting vendor_id and any per-line vendor relationship when missing.
export let JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE = true
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_jobPartsVendorId')
  if (stored === 'false') JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE = false
}
export function disableJobPartsVendorIdCapability() {
  JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE = false
  // Also disable vendor relationship because it depends on vendor_id
  disableJobPartsVendorRelCapability()
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_jobPartsVendorId', 'false')
  }
}
// (enable helper reserved for future positive detections)

// Increment fallback telemetry counter (legacy support)
export function incrementFallbackTelemetry() {
  incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
}

/**
 * Get the complete org context (legacy) for tenant scoping.
 * This helper provides all fields needed for proper RLS compliance in DB operations.
 * Uses id-based lookup with email fallback for maximum compatibility with legacy profiles.
 *
 * @param {string} label - Label for logging (e.g., 'create', 'update', 'save')
 * @returns {Promise<{org_id: string|null, user_id: string|null, user_email: string|null}>}
 */
export async function getOrgContext(label = 'operation') {
  const context = { org_id: null, user_id: null, user_email: null }

  try {
    const { data: auth } = await supabase?.auth?.getUser?.()
    context.user_id = auth?.user?.id || null
    context.user_email = auth?.user?.email || null

    // Attempt to resolve org_id using the fallback helper
    context.org_id = await getUserOrgIdWithFallback(label)

    return context
  } catch (e) {
    console.warn(`[dealService:getOrgContext:${label}] Unable to get org context:`, e?.message)
    return context
  }
}

// Export capability status for UI components
export function getCapabilities() {
  return {
    jobPartsHasTimes: JOB_PARTS_HAS_PER_LINE_TIMES,
    jobPartsVendorRel: JOB_PARTS_VENDOR_REL_AVAILABLE,
    jobPartsVendorId: JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE,
  }
}
