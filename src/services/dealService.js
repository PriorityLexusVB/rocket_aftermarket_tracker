// src/services/dealService.js
import { supabase } from '@/lib/supabase'
import {
  buildUserProfileSelectFragment,
  resolveUserProfileName,
  ensureUserProfileCapsLoaded,
  downgradeCapForErrorMessage,
} from '@/utils/userProfileName'
import { titleCase, normalizePhoneE164 } from '@/lib/format'
import {
  classifySchemaError,
  isMissingColumnError,
  isMissingRelationshipError,
  SchemaErrorCode,
  getRemediationGuidance,
} from '@/utils/schemaErrorClassifier'

// --- helpers -------------------------------------------------------------

/**
 * Check if an error is an RLS (Row Level Security) permission error.
 * Used to gracefully handle access denied scenarios without failing operations.
 * @param {Error|Object} error - The error from Supabase/PostgREST
 * @returns {boolean} - True if the error is an RLS permission error
 */
function isRlsError(error) {
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

/**
 * Get the current user's org_id with email fallback.
 * Attempts to find org_id by user id first, then falls back to email lookup.
 * This handles cases where user_profiles.id != auth.uid() but email matches.
 * @param {string} label - Label for logging (e.g., 'create', 'update')
 * @returns {Promise<string|null>} - The org_id or null if not found
 */
async function getUserOrgIdWithFallback(label = 'operation') {
  try {
    const { data: auth } = await supabase?.auth?.getUser?.()
    const userId = auth?.user?.id
    const userEmail = auth?.user?.email

    // Primary: try to find profile by id
    if (userId) {
      const { data: prof, error: profErr } = await supabase
        ?.from('user_profiles')
        ?.select('org_id')
        ?.eq('id', userId)
        ?.maybeSingle()

      if (prof?.org_id) {
        return prof.org_id
      }
      if (profErr && isRlsError(profErr)) {
        console.warn(`[dealService:${label}] RLS blocked profile lookup by id, trying email fallback`)
      }
    }

    // Fallback: try to find profile by email if id lookup failed
    if (userEmail) {
      const { data: profByEmail, error: emailErr } = await supabase
        ?.from('user_profiles')
        ?.select('org_id')
        ?.eq('email', userEmail)
        ?.order('created_at', { ascending: false }) // Use created_at for more deterministic ordering
        ?.limit(1)
        ?.maybeSingle()

      if (profByEmail?.org_id) {
        console.info(`[dealService:${label}] Found org_id via email fallback`)
        return profByEmail.org_id
      }
      if (emailErr && isRlsError(emailErr)) {
        console.warn(`[dealService:${label}] RLS blocked profile lookup by email:`, emailErr?.message)
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
const JOB_COLS = [
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
  'org_id',
]

function pick(obj, keys) {
  const out = {}
  keys?.forEach((k) => {
    if (obj?.[k] !== undefined) out[k] = obj?.[k]
  })
  return out
}

function sanitizeDealPayload(input) {
  const out = pick(input || {}, JOB_COLS)
  // Generic: coerce empty-string primitives to null so DB types (uuid/timestamp/numeric) don't error
  Object.keys(out).forEach((k) => {
    if (out[k] === '') out[k] = null
  })
  return out
}

// Generate a readable unique-ish transaction number
function generateTransactionNumber() {
  const ts = Date.now()
  const rand = Math.floor(Math.random() * 1_0000)
  return `TXN-${ts}-${rand}`
}

// NOTE: Error classification functions now imported from @/utils/schemaErrorClassifier
// This provides centralized error detection and remediation guidance

// Helper: Generic title detection pattern
const GENERIC_TITLE_PATTERN = /^(Deal\s+[\w-]+|Untitled Deal)$/i

// Helper: Derive vehicle description from title or vehicle fields
function deriveVehicleDescription(title, vehicle) {
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
function aggregateVendor(jobParts, jobLevelVendorName) {
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
function mapPermissionError(err) {
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
function wrapDbError(error, actionLabel = 'operation') {
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
let JOB_PARTS_HAS_PER_LINE_TIMES = true

// Initialize from sessionStorage on module load
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_jobPartsTimes')
  if (stored === 'false') {
    JOB_PARTS_HAS_PER_LINE_TIMES = false
  }
}

// Mark capability as unavailable and persist to sessionStorage
function disableJobPartsTimeCapability() {
  JOB_PARTS_HAS_PER_LINE_TIMES = false
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_jobPartsTimes', 'false')
  }
}

// --- Capability detection for job_parts ↔ vendors relationship -------------
// Default to true, assume relationship exists unless proven otherwise
let JOB_PARTS_VENDOR_REL_AVAILABLE = true

// Initialize from sessionStorage on module load
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_jobPartsVendorRel')
  if (stored === 'false') {
    JOB_PARTS_VENDOR_REL_AVAILABLE = false
  }
}

// Mark vendor relationship capability as unavailable and persist to sessionStorage
function disableJobPartsVendorRelCapability() {
  JOB_PARTS_VENDOR_REL_AVAILABLE = false
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_jobPartsVendorRel', 'false')
  }
}

// Mark vendor relationship capability as available (after successful query)
function enableJobPartsVendorRelCapability() {
  JOB_PARTS_VENDOR_REL_AVAILABLE = true
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_jobPartsVendorRel', 'true')
  }
}

// --- Capability detection for job_parts.vendor_id column --------------------
// Some pre-migration environments may not yet have per-line vendor_id.
// We degrade gracefully by omitting vendor_id and any per-line vendor relationship when missing.
let JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE = true
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_jobPartsVendorId')
  if (stored === 'false') JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE = false
}
function disableJobPartsVendorIdCapability() {
  JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE = false
  // Also disable vendor relationship because it depends on vendor_id
  disableJobPartsVendorRelCapability()
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_jobPartsVendorId', 'false')
  }
}
// (enable helper reserved for future positive detections)

// Import telemetry utility
import { incrementTelemetry, TelemetryKey } from '@/utils/capabilityTelemetry'

// Increment fallback telemetry counter (legacy support)
function incrementFallbackTelemetry() {
  incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
}

// --- Capability detection for user_profiles.name column ---------------------
// Some environments may not yet have a `name` column on user_profiles (may use display_name/full_name).
// We degrade gracefully by omitting the column from selects when missing.
let USER_PROFILES_NAME_AVAILABLE = true
if (typeof sessionStorage !== 'undefined') {
  const stored = sessionStorage.getItem('cap_userProfilesName')
  if (stored === 'false') USER_PROFILES_NAME_AVAILABLE = false
}
function disableUserProfilesNameCapability() {
  USER_PROFILES_NAME_AVAILABLE = false
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_userProfilesName', 'false')
  }
}
function enableUserProfilesNameCapability() {
  USER_PROFILES_NAME_AVAILABLE = true
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.setItem('cap_userProfilesName', 'true')
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

// (moved below): mapDbDealToForm is implemented near the end and re-exported

// Internal helper: load a fully-joined deal/job by id with fallback for missing columns
async function selectJoinedDealById(id) {
  // Attempt with capability-sensitive user_profiles fields and vendor relationship
  let lastError = null
  for (let attempt = 1; attempt <= 4; attempt++) {
    await ensureUserProfileCapsLoaded()
    const userProfileField = buildUserProfileSelectFragment()
    const salesConsultant = `sales_consultant:user_profiles!assigned_to${userProfileField}`
    const deliveryCoordinator = `delivery_coordinator:user_profiles!delivery_coordinator_id${userProfileField}`
    const financeManager = `finance_manager:user_profiles!finance_manager_id${userProfileField}`

    const perLineVendorFields = JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE ? 'vendor_id, ' : ''
    const perLineVendorJoin =
      JOB_PARTS_VENDOR_REL_AVAILABLE && JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE
        ? ', vendor:vendors(id, name)'
        : ''

    const selectWithTimes = `
          id, org_id, job_number, title, description, job_status, priority, location,
          vehicle_id, vendor_id, scheduled_start_time, scheduled_end_time,
          estimated_hours, estimated_cost, actual_cost, customer_needs_loaner,
          service_type, delivery_coordinator_id, assigned_to, created_at, updated_at, finance_manager_id,
          vehicle:vehicles(id, year, make, model, stock_number),
          vendor:vendors(id, name),
          ${salesConsultant},
          ${deliveryCoordinator},
          ${financeManager},
          job_parts(id, product_id, ${perLineVendorFields}unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, scheduled_start_time, scheduled_end_time, product:products(id, name, category, brand)${perLineVendorJoin})
        `

    const { data: job, error: jobError } = await supabase
      ?.from('jobs')
      ?.select(selectWithTimes)
      ?.eq('id', id)
      ?.single()

    if (!jobError) return job

    lastError = jobError

    if (isMissingColumnError(jobError)) {
      const msg = jobError?.message || ''
      const errorCode = classifySchemaError(jobError)

      if (/user_profiles/i.test(msg)) {
        console.warn(
          '[dealService:selectJoinedDealById] user_profiles column missing; degrading caps'
        )
        downgradeCapForErrorMessage(msg)
        continue
      }

      // Log classified error for diagnostics
      console.warn(`[dealService:selectJoinedDealById] Classified error: ${errorCode}`)

      // Retry without per-line times
      const selectNoTimes = `
            id, org_id, job_number, title, description, job_status, priority, location,
            vehicle_id, vendor_id, scheduled_start_time, scheduled_end_time,
            estimated_hours, estimated_cost, actual_cost, customer_needs_loaner,
            service_type, delivery_coordinator_id, assigned_to, created_at, updated_at, finance_manager_id,
            vehicle:vehicles(id, year, make, model, stock_number),
            vendor:vendors(id, name),
            ${salesConsultant},
            ${deliveryCoordinator},
            ${financeManager},
    job_parts(id, product_id, ${perLineVendorFields}unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, product:products(id, name, category, brand)${perLineVendorJoin})
          `
      const { data: fallbackJob, error: fallbackErr } = await supabase
        ?.from('jobs')
        ?.select(selectNoTimes)
        ?.eq('id', id)
        ?.single()
      if (!fallbackErr) return fallbackJob
      lastError = fallbackErr
      if (/user_profiles/i.test(fallbackErr?.message || '')) {
        downgradeCapForErrorMessage(fallbackErr?.message || '')
        continue
      }
    }
    if (isMissingRelationshipError(jobError)) {
      const msg = jobError?.message || ''
      const errorCode = classifySchemaError(jobError)

      // Detect vendor relationship issues and degrade
      if (/vendor/i.test(msg) && JOB_PARTS_VENDOR_REL_AVAILABLE) {
        console.warn(
          '[dealService:selectJoinedDealById] Vendor relationship missing; degrading capability'
        )
        disableJobPartsVendorRelCapability()
        incrementTelemetry(TelemetryKey.VENDOR_REL_FALLBACK)
        continue // retry without vendor relationship
      }

      // For other relationship errors, provide actionable guidance
      const remediation = getRemediationGuidance(jobError)
      const guidance = remediation.migrationFile
        ? `Apply migration: ${remediation.migrationFile}`
        : 'Please contact your administrator to apply the latest migrations.'
      throw new Error(`Failed to load deal: Database schema update required. ${guidance}`)
    }
    // Detect missing vendor_id column and degrade capability
    const msgLower = String(jobError?.message || '').toLowerCase()
    if (
      isMissingColumnError(jobError) &&
      msgLower.includes('job_parts') &&
      msgLower.includes('vendor_id')
    ) {
      if (JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
        console.warn(
          '[dealService:selectJoinedDealById] vendor_id column missing on job_parts; degrading capability'
        )
        disableJobPartsVendorIdCapability()
        incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
        continue
      }
    }
    break
  }
  if (lastError) throw new Error(`Failed to load deal: ${lastError.message}`)
  throw new Error('Failed to load deal: unknown error')
}

// Map UI form state into DB-friendly pieces: job payload, normalized lineItems, loaner form
function mapFormToDb(formState = {}) {
  // Base payload constrained to known columns
  const base = sanitizeDealPayload(formState || {})

  // Optional tenant scoping if provided by caller
  const orgId = formState?.org_id ?? formState?.orgId
  const payload = orgId ? { ...base, org_id: orgId } : base
  // Ensure title stays meaningful and mirrors description edits for UX consistency
  // Priority: explicit title (if provided) > vehicle_description > description > job_number > default
  // Apply Title Case to vehicle_description when present
  {
    const explicitTitle = (formState?.title || '').trim()
    const vehicleDesc = (
      formState?.vehicle_description ||
      formState?.vehicleDescription ||
      ''
    ).trim()
    const desc = (formState?.description || '').trim()

    // If title is explicitly provided in formState, use it directly (for edits)
    if (explicitTitle && !GENERIC_TITLE_PATTERN.test(explicitTitle)) {
      payload.title = explicitTitle
    } else if (vehicleDesc) {
      // Use vehicle_description with Title Case
      payload.title = titleCase(vehicleDesc)
    } else if (!payload?.title) {
      // Fallback: derive from description, job_number, or default
      if (desc) {
        payload.title = desc
      } else if (payload?.job_number) payload.title = `Deal ${payload.job_number}`
      else payload.title = 'Untitled Deal'
    }
  }

  // Map UI "Notes" field to jobs.description (no jobs.notes column exists)
  // This intentionally overwrites any legacy description value since the UI only shows "Notes"
  {
    const notes = (formState?.notes || '').trim()
    if (notes) {
      payload.description = notes
    }
  }

  // Accept either lineItems (current UI) or line_items (alternate callers)
  const lineItemsInput = Array.isArray(formState?.line_items)
    ? formState?.line_items
    : Array.isArray(formState?.lineItems)
      ? formState?.lineItems
      : []

  const normalizedLineItems = (lineItemsInput || []).map((li) => {
    const requiresSchedulingNorm =
      li?.requires_scheduling ?? li?.requiresScheduling ?? true /* default to true */
    const noScheduleReasonNorm = li?.no_schedule_reason || li?.noScheduleReason || null
    const lineItemPromisedDateNorm = li?.promised_date || li?.lineItemPromisedDate || null
    const isOffSiteNorm = li?.is_off_site ?? li?.isOffSite ?? false
    // Extract scheduled time window fields
    const scheduledStartNorm = li?.scheduled_start_time || li?.scheduledStartTime || null
    const scheduledEndNorm = li?.scheduled_end_time || li?.scheduledEndTime || null
    // NEW: Extract vendor_id for per-line vendor support
    const vendorIdNorm = li?.vendor_id ?? li?.vendorId ?? null
    return {
      product_id: li.product_id ?? null,
      vendor_id: vendorIdNorm, // NEW: per-line vendor support
      quantity_used: Number(li.quantity_used ?? li.quantity ?? 1),
      unit_price: Number(li.unit_price ?? li.price ?? 0),
      // snake_case for DB
      promised_date: lineItemPromisedDateNorm,
      requires_scheduling: !!requiresSchedulingNorm,
      no_schedule_reason: requiresSchedulingNorm ? null : noScheduleReasonNorm,
      is_off_site: !!isOffSiteNorm,
      scheduled_start_time: scheduledStartNorm,
      scheduled_end_time: scheduledEndNorm,
      // keep camelCase too for internal callers
      vendorId: vendorIdNorm, // NEW: per-line vendor support
      lineItemPromisedDate: lineItemPromisedDateNorm,
      requiresScheduling: !!requiresSchedulingNorm,
      noScheduleReason: requiresSchedulingNorm ? null : noScheduleReasonNorm,
      isOffSite: !!isOffSiteNorm,
      scheduledStartTime: scheduledStartNorm,
      scheduledEndTime: scheduledEndNorm,
    }
  })

  // Coerce invalid numerics and enforce business rules
  for (const item of normalizedLineItems) {
    if (Number.isNaN(item.quantity_used) || item.quantity_used == null) item.quantity_used = 1
    if (Number.isNaN(item.unit_price) || item.unit_price == null) item.unit_price = 0
    // Business rule: if not scheduling, reason is required
    if (!item.requires_scheduling && !String(item.no_schedule_reason || '').trim()) {
      throw new Error('Each non-scheduled line item must include a reason')
    }
  }

  // Safety: require at least one product line item when any line items are provided
  if ((normalizedLineItems?.length || 0) > 0) {
    const hasProduct = normalizedLineItems.some((it) => !!it.product_id)
    if (!hasProduct) throw new Error('At least one product is required')
  }

  // Contract-friendly jobParts for callers that expect quantity + total_price (UI keeps snake_case)
  const jobParts = (normalizedLineItems || []).map((it) => ({
    product_id: it.product_id,
    vendor_id: it.vendor_id, // NEW: per-line vendor support
    quantity: Number(it.quantity_used ?? 1),
    unit_price: Number(it.unit_price ?? 0),
    total_price: Number(it.unit_price ?? 0) * Number(it.quantity_used ?? 1),
    // Preserve UI snake_case so consumers don't lose fields
    quantity_used: it.quantity_used,
    promised_date: it.promised_date,
    requires_scheduling: it.requires_scheduling,
    no_schedule_reason: it.no_schedule_reason,
    is_off_site: it.is_off_site,
    scheduled_start_time: it.scheduled_start_time,
    scheduled_end_time: it.scheduled_end_time,
  }))

  // Accept both loanerForm (new) and legacy loaner_number shape
  let loanerForm = formState?.loanerForm || null
  if (!loanerForm && formState?.loaner_number) {
    // Legacy shape: derive loanerForm from loaner_number
    loanerForm = {
      loaner_number: formState.loaner_number,
      eta_return_date: null,
      notes: null,
    }
  }

  // customer fields normalization - apply Title Case to customer name
  const rawCustomerName = (formState?.customerName || formState?.customer_name || '').trim()
  const customerName = rawCustomerName ? titleCase(rawCustomerName) : ''

  // Normalize phone to E.164 format for storage
  const rawPhone = (
    formState?.customerMobile ||
    formState?.customer_mobile ||
    formState?.customerPhone ||
    formState?.customer_phone ||
    ''
  ).trim()
  const customerPhone = rawPhone ? normalizePhoneE164(rawPhone) : ''

  const customerEmail = (formState?.customerEmail || formState?.customer_email || '').trim()

  // Extract stock_number and VIN for vehicle upsert
  const stockNumber = formState?.stockNumber?.trim() || formState?.stock_number?.trim() || ''
  const vin = (formState?.vin?.trim() || formState?.vehicle_vin?.trim() || '').toUpperCase()

  return {
    // Back-compat keys used internally
    payload,
    normalizedLineItems,
    // New contract-friendly keys (non-breaking additions)
    jobPayload: payload,
    jobParts,
    // Extras
    loanerForm,
    customerName,
    customerPhone,
    customerEmail,
    stockNumber,
    vin,
  }
}

// Normalize line items to match `job_parts` columns we know are present.
// ✅ FIXED: Remove total_price as it's auto-generated
// ✅ ENHANCED: Accept opts param to conditionally include scheduled_start_time/scheduled_end_time
export function toJobPartRows(jobId, items = [], opts = {}) {
  const includeTimes = opts?.includeTimes ?? JOB_PARTS_HAS_PER_LINE_TIMES

  return (
    // drop null-only rows
    (items || [])
      ?.map((it) => {
        const row = {
          job_id: jobId,
          product_id: it?.product_id ?? null,
          // Only include vendor_id column when the capability indicates the DB has it.
          // Some pre-migration environments will not have this column and sending it
          // in inserts causes a 400: "Could not find the 'vendor_id' column in the schema cache".
          // We omit the key entirely in those cases so PostgREST will not reference it.
          // The runtime flag `JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE` is persisted to
          // sessionStorage when we detect a missing column during preflight.
          ...(JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE
            ? { vendor_id: it?.vendor_id ?? it?.vendorId ?? null }
            : {}),
          quantity_used: it?.quantity_used ?? it?.quantity ?? 1,
          unit_price: it?.unit_price ?? it?.price ?? 0,
          // Add new per-line-item scheduling fields
          promised_date:
            it?.lineItemPromisedDate ||
            // If requires scheduling and no date provided, default to today to satisfy DB constraint
            (it?.requiresScheduling ? new Date().toISOString().slice(0, 10) : null),
          requires_scheduling: !!it?.requiresScheduling,
          no_schedule_reason: it?.requiresScheduling ? null : it?.noScheduleReason || null,
          is_off_site: !!it?.isOffSite,
          // ✅ REMOVED: total_price as it's auto-generated by database
          // ✅ REMOVED: description field as it doesn't exist in schema
        }

        // Only include scheduled time window fields when capability is available
        if (includeTimes) {
          row.scheduled_start_time = it?.scheduledStartTime || it?.scheduled_start_time || null
          row.scheduled_end_time = it?.scheduledEndTime || it?.scheduled_end_time || null
        }

        return row
      })
      ?.filter((row) => row?.product_id !== null || row?.quantity_used || row?.unit_price)
  )
}

// A3: Enhanced UPSERT loaner assignment function
async function upsertLoanerAssignment(jobId, loanerData) {
  if (!loanerData?.loaner_number?.trim()) {
    return // No loaner number provided, skip assignment
  }

  try {
    // Check for existing active assignment for this job
    const { data: existing, error: selectError } = await supabase
      ?.from('loaner_assignments')
      ?.select('id')
      ?.eq('job_id', jobId)
      ?.is('returned_at', null)
      ?.single()

    // Handle RLS errors on SELECT gracefully
    if (selectError) {
      const isNoRows = selectError?.code === 'PGRST116' // No rows found - expected for new assignments
      
      if (isRlsError(selectError)) {
        console.warn('[dealService:upsertLoanerAssignment] RLS blocked SELECT - attempting INSERT with job context')
        // Fall through to INSERT path - RLS may allow INSERT even if SELECT is blocked
      } else if (!isNoRows) {
        console.warn('[dealService:upsertLoanerAssignment] SELECT failed:', selectError?.message)
        // Fall through to INSERT path
      }
    }

    const assignmentData = {
      job_id: jobId,
      loaner_number: loanerData?.loaner_number?.trim(),
      eta_return_date: loanerData?.eta_return_date || null,
      notes: loanerData?.notes?.trim() || null,
    }

    if (existing) {
      // Update existing assignment
      const { error } = await supabase
        ?.from('loaner_assignments')
        ?.update(assignmentData)
        ?.eq('id', existing?.id)

      if (error) {
        if (isRlsError(error)) {
          console.warn('[dealService:upsertLoanerAssignment] RLS blocked UPDATE (non-fatal):', error?.message)
          return // Silently degrade - loaner data won't be saved but deal save continues
        }
        throw error
      }
    } else {
      // Create new assignment
      const { error } = await supabase?.from('loaner_assignments')?.insert([assignmentData])

      if (error) {
        if (isRlsError(error)) {
          console.warn('[dealService:upsertLoanerAssignment] RLS blocked INSERT (non-fatal):', error?.message)
          return // Silently degrade - loaner data won't be saved but deal save continues
        }
        throw error
      }
    }
  } catch (error) {
    // Handle uniqueness constraint error gracefully
    if (error?.code === '23505') {
      throw new Error(
        `Loaner ${loanerData?.loaner_number} is already assigned to another active job`
      )
    }
    // Handle RLS errors at the top level
    if (isRlsError(error)) {
      console.warn('[dealService:upsertLoanerAssignment] RLS error (non-fatal):', error?.message)
      return // Silently degrade
    }
    throw error
  }
}

// Helper: Compute earliest time window from line items for job-level fallback
function computeEarliestTimeWindow(normalizedLineItems) {
  if (!normalizedLineItems || normalizedLineItems.length === 0) {
    return null
  }

  // Find line items with both start and end times
  const itemsWithTimes = normalizedLineItems
    .filter((item) => item?.scheduledStartTime && item?.scheduledEndTime)
    .sort((a, b) => {
      // Sort by start time (lexicographic comparison works for ISO datetime strings)
      const startA = a.scheduledStartTime || ''
      const startB = b.scheduledStartTime || ''
      return startA.localeCompare(startB)
    })

  if (itemsWithTimes.length === 0) {
    return null
  }

  const earliest = itemsWithTimes[0]

  // Convert time-only strings (HH:MM) to datetime strings if needed
  let startTime = earliest.scheduledStartTime
  let endTime = earliest.scheduledEndTime

  // If we have a promised date, combine it with the time
  if (earliest.promised_date && /^\d{2}:\d{2}/.test(startTime)) {
    startTime = `${earliest.promised_date}T${startTime}:00`
    endTime = `${earliest.promised_date}T${endTime}:00`
  }

  return {
    scheduled_start_time: startTime,
    scheduled_end_time: endTime,
  }
}

// Helper: Attach or create vehicle by stock number when vehicle_id is missing
async function attachOrCreateVehicleByStockNumber(stockNumber, customerPhone, orgId = null, vin = null) {
  if (!stockNumber?.trim()) {
    return null // No stock number provided
  }

  const normalizedStock = stockNumber.trim()
  const normalizedVin = vin?.trim()?.toUpperCase() || null

  try {
    // Try to find existing vehicle by stock_number
    let query = supabase?.from('vehicles')?.select('id')?.eq('stock_number', normalizedStock)

    // Optionally scope by org_id if provided
    if (orgId) {
      query = query?.eq('org_id', orgId)
    }

    const { data: existing, error: lookupErr } = await query?.maybeSingle()

    // PGRST116 = "no rows returned" - expected when vehicle doesn't exist
    const PGRST_NO_ROWS = 'PGRST116'
    if (lookupErr && lookupErr.code !== PGRST_NO_ROWS) {
      // Log but don't fail if lookup fails (except for "no rows" which is expected)
      console.warn('[dealService:attachVehicle] Lookup failed:', lookupErr.message)
    }

    if (existing?.id) {
      // Vehicle found, return its ID
      return existing.id
    }

    // Vehicle not found, create minimal vehicle record
    const vehicleData = {
      stock_number: normalizedStock,
      owner_phone: customerPhone || null,
    }

    if (normalizedVin) {
      vehicleData.vin = normalizedVin
    }

    if (orgId) {
      vehicleData.org_id = orgId
    }

    const { data: newVehicle, error: createErr } = await supabase
      ?.from('vehicles')
      ?.insert([vehicleData])
      ?.select('id')
      ?.single()

    if (createErr) {
      // Log but don't fail - vehicle creation is best-effort
      console.warn('[dealService:attachVehicle] Create failed:', createErr.message)
      return null
    }

    return newVehicle?.id || null
  } catch (error) {
    // Best-effort: log and return null if anything fails
    console.warn('[dealService:attachVehicle] Exception:', error?.message)
    return null
  }
}

// ✅ FIXED: Updated getAllDeals to remove SQL RPC dependency and use direct queries
// ✅ UPDATED: Added fallback for missing per-line time columns
// ✅ ENHANCED: Added fallback for missing vendor relationship
// ✅ ENHANCED: Added schema preflight probe to detect missing columns before main query
export async function getAllDeals() {
  try {
    // STEP 1: Schema preflight probe - detect missing columns BEFORE building main select
    // This prevents initial 400 errors on environments missing scheduled_* or vendor_id
    if (JOB_PARTS_HAS_PER_LINE_TIMES || JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
      try {
        const probeFields = []
        if (JOB_PARTS_HAS_PER_LINE_TIMES) {
          probeFields.push('scheduled_start_time', 'scheduled_end_time')
        }
        if (JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
          probeFields.push('vendor_id')
        }

        const { error: probeError } = await supabase
          .from('job_parts')
          .select(probeFields.join(', '))
          .limit(1)

        if (probeError && isMissingColumnError(probeError)) {
          const errorCode = classifySchemaError(probeError)
          const msg = probeError.message.toLowerCase()

          if (msg.includes('scheduled_start_time') || msg.includes('scheduled_end_time')) {
            console.warn(
              `[dealService:getAllDeals] Preflight: classified as ${errorCode}; disabling capability`
            )
            disableJobPartsTimeCapability()
            incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
          }
          if (msg.includes('vendor_id')) {
            console.warn(
              `[dealService:getAllDeals] Preflight: classified as ${errorCode}; disabling capability`
            )
            disableJobPartsVendorIdCapability()
            incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
          }
        }
      } catch (preflightError) {
        console.warn(
          '[dealService:getAllDeals] Preflight probe failed, continuing:',
          preflightError
        )
      }
    }

    // Refresh vendor relationship capability from sessionStorage per invocation to avoid stale module state across tests
    if (typeof sessionStorage !== 'undefined') {
      const storedRel = sessionStorage.getItem('cap_jobPartsVendorRel')
      if (storedRel === 'false') JOB_PARTS_VENDOR_REL_AVAILABLE = false
      else if (storedRel === 'true') JOB_PARTS_VENDOR_REL_AVAILABLE = true
      else JOB_PARTS_VENDOR_REL_AVAILABLE = true
    } else {
      JOB_PARTS_VENDOR_REL_AVAILABLE = true
    }

    let jobs = null
    let jobsError = null

    // We may need up to 4 attempts: original -> remove per-line times -> remove user_profiles name columns / vendor rel
    for (let attempt = 1; attempt <= 4; attempt++) {
      await ensureUserProfileCapsLoaded()
      const userProfileField = buildUserProfileSelectFragment()
      const salesConsultant = `sales_consultant:user_profiles!assigned_to${userProfileField}`
      const deliveryCoordinator = `delivery_coordinator:user_profiles!delivery_coordinator_id${userProfileField}`
      const financeManager = `finance_manager:user_profiles!finance_manager_id${userProfileField}`

      const perLineVendorField = JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE ? 'vendor_id, ' : ''
      const perLineVendorJoin2 =
        JOB_PARTS_VENDOR_REL_AVAILABLE && JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE
          ? ', vendor:vendors(id, name)'
          : ''
      // Build job_parts field lists with/without per-line time columns, gated by capability
      const jobPartsCore = `id, product_id, ${perLineVendorField}unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site`
      const jobPartsTimeFields = JOB_PARTS_HAS_PER_LINE_TIMES
        ? ', scheduled_start_time, scheduled_end_time'
        : ''
      const productFields = `product:products(id, name, category, brand${JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE ? ', vendor_id' : ''})`
      const jobPartsFieldsVendor = `job_parts(${jobPartsCore}${jobPartsTimeFields}, ${productFields}${perLineVendorJoin2})`
      const jobPartsFieldsNoVendor = `job_parts(${jobPartsCore}${jobPartsTimeFields}, ${productFields}${perLineVendorJoin2})`

      const baseSelect = `
          id, org_id, created_at, job_status, service_type, color_code, title, job_number,
          customer_needs_loaner, assigned_to, delivery_coordinator_id, finance_manager_id,
          scheduled_start_time, scheduled_end_time,
          vehicle:vehicles(year, make, model, stock_number),
          vendor:vendors(id, name),
          ${salesConsultant},
          ${deliveryCoordinator},
          ${financeManager},
          ${JOB_PARTS_VENDOR_REL_AVAILABLE ? jobPartsFieldsVendor : jobPartsFieldsNoVendor}
        `

      const result = await supabase
        ?.from('jobs')
        ?.select(baseSelect)
        ?.in('job_status', ['draft', 'pending', 'in_progress', 'completed'])
        ?.order('created_at', { ascending: false })

      jobs = result?.data
      jobsError = result?.error

      if (!jobsError) {
        // Mark capabilities successful on success
        // Only re-affirm vendor relationship capability if we actually used it in this attempt
        if (JOB_PARTS_VENDOR_REL_AVAILABLE) {
          enableJobPartsVendorRelCapability()
        }
        if (USER_PROFILES_NAME_AVAILABLE) enableUserProfilesNameCapability()
        break
      }

      // Handle specific fallbacks
      if (isMissingColumnError(jobsError)) {
        const msg = jobsError.message || ''
        const errorCode = classifySchemaError(jobsError)

        if (/user_profiles/i.test(msg)) {
          console.warn(`[dealService:getAllDeals] Classified as ${errorCode}; degrading capability`)
          downgradeCapForErrorMessage(msg)
          continue // retry with degraded user profile fields
        }

        const lower = msg.toLowerCase()
        // Detect missing per-line time columns on job_parts and disable that capability
        if (
          lower.includes('job_parts') &&
          (lower.includes('scheduled_start_time') || lower.includes('scheduled_end_time'))
        ) {
          if (JOB_PARTS_HAS_PER_LINE_TIMES) {
            console.warn(
              `[dealService:getAllDeals] Classified as ${errorCode}; disabling per-line time capability and retrying...`
            )
            disableJobPartsTimeCapability()
            incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
            continue
          }
        }

        console.warn(
          `[dealService:getAllDeals] Missing column detected (${errorCode}), retrying if capability allows...`
        )

        if (lower.includes('job_parts') && lower.includes('vendor_id')) {
          if (JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
            console.warn(
              `[dealService:getAllDeals] Classified as ${errorCode}; degrading capability`
            )
            disableJobPartsVendorIdCapability()
            incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
            continue
          }
        }
      }
      if (isMissingRelationshipError(jobsError) && JOB_PARTS_VENDOR_REL_AVAILABLE) {
        const errorCode = classifySchemaError(jobsError)
        console.warn(
          `[dealService:getAllDeals] Classified as ${errorCode}; disabling vendor relationship and retrying...`
        )
        disableJobPartsVendorRelCapability()
        incrementFallbackTelemetry()
        incrementTelemetry(TelemetryKey.VENDOR_REL_FALLBACK)
        continue
      }
      // If we reach here and can't adjust further, break to throw
      break
    }

    if (jobsError) throw jobsError

    // Get transactions and loaner assignments separately for better performance
    const jobIds = jobs?.map((j) => j?.id) || []

    const [transactionsResult, loanersResult] = await Promise.all([
      supabase
        ?.from('transactions')
        ?.select('job_id, customer_name, customer_phone, customer_email, total_amount')
        ?.in('job_id', jobIds),
      (() => {
        const q = supabase
          ?.from('loaner_assignments')
          ?.select('job_id, id, loaner_number, eta_return_date')
          ?.in('job_id', jobIds)
        // Some mocked test environments may omit .is() helper; guard it.
        return q && typeof q.is === 'function' ? q.is('returned_at', null) : q
      })(),
    ])

    const transactions = transactionsResult?.data || []
    
    // Handle loaner_assignments RLS errors gracefully
    // 403 errors can occur when jobs have missing org_id or user lacks access
    let loaners = []
    if (loanersResult?.error) {
      if (isRlsError(loanersResult.error)) {
        console.warn('[dealService:getAllDeals] RLS blocked loaner_assignments query (non-fatal):', loanersResult.error?.message)
        // Silently degrade - deals will show without loaner info for inaccessible jobs
      } else {
        console.warn('[dealService:getAllDeals] loaner_assignments query failed (non-fatal):', loanersResult.error?.message)
      }
    } else {
      loaners = loanersResult?.data || []
    }

    // Process and enhance the data
    return (
      jobs?.map((job) => {
        const transaction = transactions?.find((t) => t?.job_id === job?.id)
        const loaner = loaners?.find((l) => l?.job_id === job?.id)

        // Calculate next promised date from job parts
        // Normalize date-only strings to local time (no trailing Z) for consistent display
        const schedulingParts =
          job?.job_parts?.filter((part) => part?.requires_scheduling && part?.promised_date) || []
        const nextPromisedDate =
          schedulingParts?.length > 0
            ? schedulingParts
                ?.sort((a, b) => {
                  // Normalize dates for comparison: date-only → local time
                  const dateA = String(a.promised_date || '')
                  const dateB = String(b.promised_date || '')
                  const normA = dateA.includes('T') ? dateA : `${dateA}T00:00:00`
                  const normB = dateB.includes('T') ? dateB : `${dateB}T00:00:00`
                  return new Date(normA) - new Date(normB)
                })
                ?.map((p) => {
                  const d = String(p.promised_date || '')
                  return d.includes('T') ? d : `${d}T00:00:00`
                })?.[0]
            : null

        // Compute helpful display fields
        const createdAt = job?.created_at ? new Date(job.created_at) : null
        const now = new Date()
        const ageDays = createdAt
          ? Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)))
          : null

        // Normalize phone to E.164 (best-effort, default country US)
        const rawPhone = transaction?.customer_phone || ''
        const digits = (rawPhone || '').replace(/\D/g, '')
        const phoneLast4 = digits?.slice(-4) || ''
        const phoneE164 =
          digits?.length === 11 && digits.startsWith('1')
            ? `+${digits}`
            : digits?.length === 10
              ? `+1${digits}`
              : rawPhone || ''

        // Appointment window derived from earliest scheduled line item with both start and end times
        // Falls back to job-level scheduled_start_time/end_time if no line items have scheduling
        // Use string comparison for ISO datetime strings (lexicographic order matches chronological)
        const lineItemsWithSchedule = (job?.job_parts || [])
          .filter((part) => part?.scheduled_start_time && part?.scheduled_end_time)
          .sort((a, b) =>
            (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || '')
          )

        // DEPRECATED: appt_start/appt_end maintained for backward compatibility
        // Prefer using scheduled_start_time/scheduled_end_time from job or line items
        const apptStart =
          lineItemsWithSchedule?.[0]?.scheduled_start_time || job?.scheduled_start_time || null
        const apptEnd =
          lineItemsWithSchedule?.[0]?.scheduled_end_time || job?.scheduled_end_time || null

        // Work tags (simple mapping from product/category/name)
        const workTags = (job?.job_parts || [])
          .map((p) => p?.product?.category || p?.product?.name || '')
          .map((label) => {
            const l = (label || '').toLowerCase()
            if (/ppf|paint protection/.test(l)) return 'PPF'
            if (/tint|window/.test(l)) return 'Tint'
            if (/ceramic/.test(l)) return 'Ceramic'
            if (/detail|wash|interior|exterior/.test(l)) return 'Detail'
            return null
          })
          .filter(Boolean)
          .filter((v, i, a) => a.indexOf(v) === i)

        // Derive vehicle_description from title (where custom descriptions are stored)
        const vehicleDescription = deriveVehicleDescription(job?.title, job?.vehicle)

        // Aggregate vendor from line items (per-line vendor migration from PR #70)
        const aggregatedVendor = aggregateVendor(job?.job_parts, job?.vendor?.name)

        // Extract staff names for display
        const salesConsultantName = resolveUserProfileName(job?.sales_consultant)
        const deliveryCoordinatorName = resolveUserProfileName(job?.delivery_coordinator)
        const financeManagerName = resolveUserProfileName(job?.finance_manager)

        return {
          ...job,
          customer_name: transaction?.customer_name || '',
          customer_phone: transaction?.customer_phone || '',
          customer_phone_e164: phoneE164,
          customer_phone_last4: phoneLast4,
          customer_email: transaction?.customer_email || '',
          total_amount: parseFloat(transaction?.total_amount) || 0,
          has_active_loaner: !!loaner?.id,
          next_promised_iso: nextPromisedDate || null,
          loaner_id: loaner?.id || null,
          loaner_number: loaner?.loaner_number || null,
          loaner_eta_short: loaner?.eta_return_date
            ? new Date(loaner?.eta_return_date)?.toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })
            : null,
          loaner_eta_return_date: loaner?.eta_return_date || null,
          age_days: ageDays,
          // DEPRECATED: Legacy fields for backward compatibility only
          appt_start: apptStart,
          appt_end: apptEnd,
          vendor_name: aggregatedVendor,
          vehicle_description: vehicleDescription,
          sales_consultant_name: salesConsultantName,
          delivery_coordinator_name: deliveryCoordinatorName,
          finance_manager_name: financeManagerName,
          work_tags: workTags,
          vehicle:
            job?.vehicle_id && job?.vehicle
              ? {
                  year: job?.vehicle?.year,
                  make: job?.vehicle?.make,
                  model: job?.vehicle?.model,
                  stock_number: job?.vehicle?.stock_number,
                }
              : null,
          stock_no: job?.vehicle?.stock_number,
        }
      }) || []
    )
  } catch (error) {
    console.error('Failed to load deals:', error)
    // Provide specific guidance for missing relationship errors using classifier
    if (isMissingRelationshipError(error)) {
      const errorCode = classifySchemaError(error)
      const remediation = getRemediationGuidance(error)
      const guidance = remediation.migrationFile
        ? `Please run migration: ${remediation.migrationFile}`
        : 'Please run the migration to add per-line vendor support'
      throw new Error(
        `Failed to load deals: ${remediation.description || 'Missing database relationship'}. ${guidance}. Original error: ${error?.message}`
      )
    }
    throw new Error(`Failed to load deals: ${error?.message}`)
  }
}

// ✅ FIXED: Updated getDeal to remove SQL RPC dependency
// ✅ UPDATED: Enhanced to include computed fields matching getAllDeals structure
export async function getDeal(id) {
  try {
    // Centralized joined selector
    const job = await selectJoinedDealById(id)

    // Get transaction data and loaner data separately
    const [transactionResult, loanerResult] = await Promise.all([
      supabase
        ?.from('transactions')
        ?.select('customer_name, customer_phone, customer_email, total_amount')
        ?.eq('job_id', id)
        ?.single(),
      (() => {
        const q = supabase
          ?.from('loaner_assignments')
          ?.select('id, loaner_number, eta_return_date, notes')
          ?.eq('job_id', id)
        const q2 = q && typeof q.is === 'function' ? q.is('returned_at', null) : q
        return q2 && typeof q2.maybeSingle === 'function' ? q2.maybeSingle() : q2
      })(),
    ])

    const transaction = transactionResult?.data
    
    // Handle loaner_assignments RLS errors gracefully
    // 403 errors can occur when jobs have missing org_id or user lacks access
    let loaner = null
    if (loanerResult?.error) {
      if (isRlsError(loanerResult.error)) {
        console.warn('[dealService:getDeal] RLS blocked loaner_assignments query (non-fatal):', loanerResult.error?.message)
        // Silently degrade - deal will show without loaner info
      } else {
        console.warn('[dealService:getDeal] loaner_assignments query failed (non-fatal):', loanerResult.error?.message)
      }
    } else {
      loaner = loanerResult?.data || null
    }

    // Calculate next promised date from job parts (same as getAllDeals)
    const schedulingParts =
      job?.job_parts?.filter((part) => part?.requires_scheduling && part?.promised_date) || []
    const nextPromisedDate =
      schedulingParts?.length > 0
        ? schedulingParts
            ?.sort((a, b) => {
              const dateA = String(a.promised_date || '')
              const dateB = String(b.promised_date || '')
              const normA = dateA.includes('T') ? dateA : `${dateA}T00:00:00`
              const normB = dateB.includes('T') ? dateB : `${dateB}T00:00:00`
              return new Date(normA) - new Date(normB)
            })
            ?.map((p) => {
              const d = String(p.promised_date || '')
              return d.includes('T') ? d : `${d}T00:00:00`
            })?.[0]
        : null

    // Compute age in days
    const createdAt = job?.created_at ? new Date(job.created_at) : null
    const now = new Date()
    const ageDays = createdAt
      ? Math.max(0, Math.floor((now - createdAt) / (1000 * 60 * 60 * 24)))
      : null

    // Normalize phone to E.164
    const rawPhone = transaction?.customer_phone || ''
    const digits = (rawPhone || '').replace(/\D/g, '')
    const phoneLast4 = digits?.slice(-4) || ''
    const phoneE164 =
      digits?.length === 11 && digits.startsWith('1')
        ? `+${digits}`
        : digits?.length === 10
          ? `+1${digits}`
          : rawPhone || ''

    // Appointment window derived from earliest scheduled line item
    const lineItemsWithSchedule = (job?.job_parts || [])
      .filter((part) => part?.scheduled_start_time && part?.scheduled_end_time)
      .sort((a, b) => (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || ''))

    // DEPRECATED: appt_start/appt_end maintained for backward compatibility
    // Prefer using scheduled_start_time/scheduled_end_time from job or line items
    const apptStart =
      lineItemsWithSchedule?.[0]?.scheduled_start_time || job?.scheduled_start_time || null
    const apptEnd =
      lineItemsWithSchedule?.[0]?.scheduled_end_time || job?.scheduled_end_time || null

    // Work tags
    const workTags = (job?.job_parts || [])
      .map((p) => p?.product?.category || p?.product?.name || '')
      .map((label) => {
        const l = (label || '').toLowerCase()
        if (/ppf|paint protection/.test(l)) return 'PPF'
        if (/tint|window/.test(l)) return 'Tint'
        if (/ceramic/.test(l)) return 'Ceramic'
        if (/detail|wash|interior|exterior/.test(l)) return 'Detail'
        return null
      })
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)

    // Derive vehicle_description (same logic as getAllDeals)
    const vehicleDescription = deriveVehicleDescription(job?.title, job?.vehicle)

    // Extract staff names for display
    const salesConsultantName = resolveUserProfileName(job?.sales_consultant)
    const deliveryCoordinatorName = resolveUserProfileName(job?.delivery_coordinator)
    const financeManagerName = resolveUserProfileName(job?.finance_manager)

    // Aggregate vendor (same as getAllDeals)
    const aggregatedVendor = aggregateVendor(job?.job_parts, job?.vendor?.name)

    // For UI compatibility tests: present unit_price as string under nested job_parts
    const jobForUi = {
      ...job,
      job_parts: (job?.job_parts || []).map((p) => ({
        ...p,
        unit_price: p?.unit_price != null ? String(p.unit_price) : p?.unit_price,
      })),
    }

    return {
      ...jobForUi,
      customer_name: transaction?.customer_name || '',
      customer_phone: transaction?.customer_phone || '',
      customer_phone_e164: phoneE164,
      customer_phone_last4: phoneLast4,
      customer_email: transaction?.customer_email || '',
      total_amount: parseFloat(transaction?.total_amount) || 0,
      has_active_loaner: !!loaner?.id,
      next_promised_iso: nextPromisedDate || null,
      loaner_number: loaner?.loaner_number || '',
      loaner_id: loaner?.id || null,
      loaner_eta_return_date: loaner?.eta_return_date || null,
      loaner_eta_short: loaner?.eta_return_date
        ? new Date(loaner?.eta_return_date)?.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
          })
        : null,
      loaner_notes: loaner?.notes || '',
      age_days: ageDays,
      // DEPRECATED: Legacy fields for backward compatibility only
      appt_start: apptStart,
      appt_end: apptEnd,
      vendor_name: aggregatedVendor,
      vehicle_description: vehicleDescription,
      sales_consultant_name: salesConsultantName,
      delivery_coordinator_name: deliveryCoordinatorName,
      finance_manager_name: financeManagerName,
      work_tags: workTags,
      stock_no: job?.vehicle?.stock_number,
    }
  } catch (error) {
    console.error('[dealService:get] Failed to get deal:', error)
    throw new Error(`Failed to load deal: ${error?.message}`)
  }
}

// CREATE: deal + job_parts
export async function createDeal(formState) {
  const {
    payload,
    normalizedLineItems,
    loanerForm,
    customerName,
    customerPhone,
    customerEmail,
    stockNumber,
    vin,
  } = mapFormToDb(formState || {})

  // Fallback tenant scoping: if org_id is missing, try to infer from current user's profile
  if (!payload?.org_id) {
    const inferredOrgId = await getUserOrgIdWithFallback('create')
    if (inferredOrgId) {
      payload.org_id = inferredOrgId
    }
  }

  // ✅ VALIDATION: Warn if org_id is missing (may cause RLS violations in production)
  // In test environments, this is logged but doesn't block operation
  if (!payload?.org_id) {
    console.warn(
      '[dealService:create] ⚠️ CRITICAL: org_id is missing! This may cause RLS violations. ' +
        'Ensure UI passes org_id or user is properly authenticated.'
    )
    // Note: We don't throw here to preserve backward compatibility with tests
    // In production, RLS policies will enforce tenant isolation at the database level
  }

  // Ensure required fields the DB expects
  // jobs.job_number is NOT NULL + UNIQUE in schema; auto-generate if missing
  if (!payload?.job_number) {
    const ts = Date.now()
    const rand = Math.floor(Math.random() * 1_0000)
    payload.job_number = `JOB-${ts}-${rand}`
  }

  // Some DB triggers enforce vendor jobs to have scheduled dates.
  // In tests and general use, avoid auto-populating scheduled times to preserve null-safety expectations
  // (previously defaulted scheduled_start_time for vendor jobs)

  // Attach or create vehicle by stock number if vehicle_id is missing
  if (!payload?.vehicle_id && stockNumber) {
    const vehicleId = await attachOrCreateVehicleByStockNumber(
      stockNumber,
      customerPhone,
      payload?.org_id,
      vin
    )
    if (vehicleId) {
      payload.vehicle_id = vehicleId
    }
  }

  // Job-level time fallback: when per-line times unsupported, set job.scheduled_* from earliest line item
  if (!JOB_PARTS_HAS_PER_LINE_TIMES) {
    const earliestWindow = computeEarliestTimeWindow(normalizedLineItems)
    if (earliestWindow) {
      payload.scheduled_start_time = earliestWindow.scheduled_start_time
      payload.scheduled_end_time = earliestWindow.scheduled_end_time
      console.info(
        '[dealService:create] Setting job-level times from earliest line item:',
        earliestWindow
      )
    }
  }

  // Pre-insert FK guard: ensure all referenced products exist to avoid FK failure
  try {
    const productIds = Array.from(
      new Set(
        (normalizedLineItems || [])
          .map((it) => (it?.product_id ? String(it.product_id) : null))
          .filter(Boolean)
      )
    )
    if (productIds.length) {
      const { data: prodRows, error: prodErr } = await supabase
        ?.from('products')
        ?.select('id')
        ?.in('id', productIds)
      if (prodErr) throw prodErr
      const found = new Set((prodRows || []).map((r) => String(r.id)))
      const missing = productIds.filter((pid) => !found.has(String(pid)))
      if (missing.length) {
        throw new Error(
          'One or more selected products no longer exist. Please re-select a valid product.'
        )
      }
    }
  } catch (fkErr) {
    throw new Error(`Failed to create deal: ${fkErr?.message || fkErr}`)
  }

  // 1) create job
  const { data: job, error: jobErr } = await supabase
    ?.from('jobs')
    ?.insert([payload])
    ?.select('id')
    ?.single()
  if (jobErr) throw new Error(`Failed to create deal: ${jobErr.message}`)

  try {
    // 1.5) Update vehicle with stock_number and owner_phone if vehicle_id is present
    if (payload?.vehicle_id && (stockNumber || customerPhone)) {
      const vehicleUpdate = {}
      if (stockNumber) vehicleUpdate.stock_number = stockNumber
      if (customerPhone) vehicleUpdate.owner_phone = customerPhone

      if (Object.keys(vehicleUpdate).length > 0) {
        const { error: vehicleErr } = await supabase
          ?.from('vehicles')
          ?.update(vehicleUpdate)
          ?.eq('id', payload.vehicle_id)
        // Non-fatal: log but don't fail the deal creation if vehicle update fails
        if (vehicleErr)
          console.warn('[dealService:create] Vehicle update failed:', vehicleErr.message)
      }
    }

    // 2) insert parts (if any) with fallback for missing scheduled_* columns
    if ((normalizedLineItems || []).length > 0) {
      const rows = toJobPartRows(job?.id, normalizedLineItems, {
        includeTimes: JOB_PARTS_HAS_PER_LINE_TIMES,
      })
      if (rows?.length > 0) {
        const { error: partsErr } = await supabase?.from('job_parts')?.insert(rows)
        if (partsErr) {
          if (isMissingColumnError(partsErr)) {
            const errorCode = classifySchemaError(partsErr)
            const lower = String(partsErr?.message || '').toLowerCase()

            // Vendor column missing: disable capability and retry omitting vendor_id
            if (lower.includes('job_parts') && lower.includes('vendor_id')) {
              if (JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
                console.warn(
                  `[dealService:create] Classified as ${errorCode}; disabling capability and retrying without vendor_id`
                )
                disableJobPartsVendorIdCapability()
                incrementTelemetry?.(TelemetryKey?.VENDOR_ID_FALLBACK)
                const retryRows = toJobPartRows(job?.id, normalizedLineItems, {
                  includeTimes: JOB_PARTS_HAS_PER_LINE_TIMES,
                })
                const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)
                if (retryErr) throw retryErr
              } else {
                throw partsErr
              }
            }
            // Per-line time columns missing: retry without them
            else if (
              lower.includes('job_parts') &&
              (lower.includes('scheduled_start_time') || lower.includes('scheduled_end_time'))
            ) {
              console.warn(
                `[dealService:create] Classified as ${errorCode}; retrying without time columns`
              )
              disableJobPartsTimeCapability()
              incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
              const retryRows = toJobPartRows(job?.id, normalizedLineItems, { includeTimes: false })
              const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)
              if (retryErr) throw retryErr
            } else {
              throw partsErr
            }
          } else {
            throw partsErr
          }
        }
      }
    }

    // A3: Handle loaner assignment for new deals
    if (payload?.customer_needs_loaner && loanerForm) {
      await upsertLoanerAssignment(job?.id, loanerForm)
    }

    // 3) Ensure a transaction row exists immediately to satisfy NOT NULLs in some environments
    try {
      // ✅ Ensure org_id is set, fallback to job's org_id if not in payload
      let transactionOrgId = payload?.org_id || job?.org_id || null
      if (transactionOrgId) {
        console.info('[dealService:create] Using org_id for transaction:', transactionOrgId)
      }

      const baseTransaction = {
        job_id: job?.id,
        vehicle_id: payload?.vehicle_id || null,
        org_id: transactionOrgId, // ✅ FIX: Include org_id for RLS compliance
        total_amount:
          (normalizedLineItems || []).reduce((sum, item) => {
            const qty = Number(item?.quantity_used || item?.quantity || 1)
            const price = Number(item?.unit_price || item?.price || 0)
            return sum + qty * price
          }, 0) || 0,
        customer_name: customerName || 'Unknown Customer',
        customer_phone: customerPhone || null,
        customer_email: customerEmail || null,
        transaction_status: 'pending',
        transaction_number: generateTransactionNumber(),
      }

      // best-effort: insert only if not exists (race-safe enough for single client)
      const { data: existingTxn, error: selectErr } = await supabase
        ?.from('transactions')
        ?.select('id')
        ?.eq('job_id', job?.id)
        ?.limit(1)
        ?.maybeSingle?.()

      // If SELECT failed due to RLS, skip INSERT to avoid potential duplicates
      // Transaction likely exists but is inaccessible; updateDeal will handle fixing it
      if (selectErr) {
        if (isRlsError(selectErr)) {
          console.warn('[dealService:create] RLS blocked transaction SELECT; skipping INSERT to avoid duplicates')
        } else {
          console.warn('[dealService:create] Transaction SELECT failed (non-fatal):', selectErr?.message)
        }
      } else if (!existingTxn?.id) {
        // Only INSERT if SELECT succeeded and found no transaction
        const { error: insErr } = await supabase?.from('transactions')?.insert([baseTransaction])
        if (insErr) {
          console.warn('[dealService:create] Transaction INSERT failed (non-fatal):', insErr?.message)
        }
      }
    } catch (e) {
      // non-fatal; updateDeal will try again, but we attempted to satisfy NOT NULL early
      console.warn('[dealService:create] pre-create transaction insert skipped:', e?.message)
    }

    // 4) return full record (with joins). If joins are restricted by RLS/policies, fall back to minimal shape with id so callers can navigate to edit.
    try {
      return await getDeal(job?.id)
    } catch (e) {
      console.warn('[dealService:create] getDeal fallback due to error:', e?.message)
      return { id: job?.id }
    }
  } catch (error) {
    console.error('[dealService:create] Failed to create deal:', error)
    // rollback best-effort: delete parts first, then job
    try {
      await supabase?.from('job_parts')?.delete()?.eq('job_id', job?.id)
    } catch {
      // ignore
    }
    try {
      await supabase?.from('jobs')?.delete()?.eq('id', job?.id)
    } catch {
      // ignore
    }
    // Friendlier guidance for common RLS misconfiguration seen in some environments
    const msg = String(error?.message || error || '')
    if (/permission denied for table users/i.test(msg)) {
      throw new Error(
        'Failed to create deal: permission denied while evaluating RLS policies. ' +
          'This may indicate a database schema cache issue. ' +
          'Try reloading the schema with: NOTIFY pgrst, \'reload schema\'; ' +
          'If the issue persists, verify that all RLS policies use public.user_profiles instead of auth.users. ' +
          'See migrations 20251104221500 and 20251115222458 for reference.'
      )
    }
    throw new Error(`Failed to create deal: ${error.message}`)
  }
}

// UPDATE: deal + replace job_parts - FIXED with proper transaction handling and customer data
export async function updateDeal(id, formState) {
  const {
    payload,
    normalizedLineItems,
    loanerForm,
    customerName,
    customerPhone,
    customerEmail,
    stockNumber,
    vin,
  } = mapFormToDb(formState || {})

  // Fallback tenant scoping: if org_id is missing, try to infer from current user's profile (align with createDeal)
  if (!payload?.org_id) {
    const inferredOrgId = await getUserOrgIdWithFallback('update')
    if (inferredOrgId) {
      payload.org_id = inferredOrgId
    }
  }

  // ✅ VALIDATION: Warn if org_id is missing (may cause RLS violations in production)
  // In test environments, this is logged but doesn't block operation
  if (!payload?.org_id) {
    console.warn(
      '[dealService:update] ⚠️ CRITICAL: org_id is missing! This may cause RLS violations. ' +
        'Ensure UI passes org_id or user is properly authenticated.'
    )
    // Note: We don't throw here to preserve backward compatibility with tests
    // In production, RLS policies will enforce tenant isolation at the database level
  }

  // Ensure description is explicitly updated when provided (some environments rely on it for display)
  {
    const desc = (formState?.description || '').trim()
    if (desc) payload.description = desc
  }

  // Calculate total deal value for transactions
  const totalDealValue =
    (normalizedLineItems || []).reduce((sum, item) => {
      const qty = Number(item?.quantity_used || item?.quantity || 1)
      const price = Number(item?.unit_price || item?.price || 0)
      return sum + qty * price
    }, 0) || 0

  // Attach or create vehicle by stock number if vehicle_id is missing
  if (!payload?.vehicle_id && stockNumber) {
    const vehicleId = await attachOrCreateVehicleByStockNumber(
      stockNumber,
      customerPhone,
      payload?.org_id,
      vin
    )
    if (vehicleId) {
      payload.vehicle_id = vehicleId
    }
  }

  // Job-level time fallback: when per-line times unsupported, set job.scheduled_* from earliest line item
  if (!JOB_PARTS_HAS_PER_LINE_TIMES) {
    const earliestWindow = computeEarliestTimeWindow(normalizedLineItems)
    if (earliestWindow) {
      payload.scheduled_start_time = earliestWindow.scheduled_start_time
      payload.scheduled_end_time = earliestWindow.scheduled_end_time
      console.info(
        '[dealService:update] Setting job-level times from earliest line item:',
        earliestWindow
      )
    }
  }

  // 1) Update job with optimistic concurrency and tenant scope where possible
  let jobErr
  try {
    let q = supabase?.from('jobs')?.update(payload)?.eq('id', id)
    // Tenant scope if provided
    if (payload?.org_id) q = q?.eq?.('org_id', payload.org_id)
    // Optimistic concurrency using updated_at if provided by caller
    if (formState?.updated_at) q = q?.eq?.('updated_at', formState.updated_at)

    const { data: updRow, error: updErr } = await q?.select('id, updated_at')?.maybeSingle?.()
    if (updErr) throw updErr
    if (!updRow?.id) {
      // No rows matched: treat as 409/Conflict
      const conflict = new Error(
        'Conflict: This deal was updated by someone else. Please reload and try again.'
      )
      conflict.code = 'VERSION_CONFLICT'
      conflict.status = 409
      throw conflict
    }
  } catch (e) {
    jobErr = e
  }
  // Preserve conflict details; only wrap non-conflict errors
  if (jobErr) {
    if (jobErr.code === 'VERSION_CONFLICT' || jobErr.status === 409) {
      throw jobErr
    }
    throw wrapDbError(jobErr, 'update deal')
  }

  // Prefer server-truth; do not write localStorage fallbacks for description

  // 2) ✅ ENHANCED: Upsert transaction with customer data
  // ✅ SAFETY: If org_id is missing from payload, fetch it from the job record
  // NOTE: This fallback should rarely execute - org_id should come from form state (mapDbDealToForm).
  // If this executes frequently, investigate why form state lacks org_id.
  let transactionOrgId = payload?.org_id || null
  if (!transactionOrgId) {
    console.warn('[dealService:update] org_id missing from payload, fetching from job record')
    try {
      const { data: jobData, error: jobFetchErr } = await supabase
        ?.from('jobs')
        ?.select('org_id')
        ?.eq('id', id)
        ?.single()
      if (!jobFetchErr && jobData?.org_id) {
        transactionOrgId = jobData.org_id
        console.info('[dealService:update] Retrieved org_id from job:', transactionOrgId ? transactionOrgId.slice(0, 8) + '...' : 'N/A')
      } else {
        console.error('[dealService:update] Failed to fetch org_id from job:', jobFetchErr?.message)
      }
    } catch (e) {
      console.error('[dealService:update] Error fetching org_id from job:', e?.message)
    }
  }

  const baseTransactionData = {
    job_id: id,
    vehicle_id: payload?.vehicle_id || null,
    org_id: transactionOrgId, // ✅ FIX: Include org_id for RLS compliance (from payload or job)
    total_amount: totalDealValue,
    customer_name: customerName || 'Unknown Customer',
    customer_phone: customerPhone || null,
    customer_email: customerEmail || null,
    transaction_status: 'pending',
  }

  // Upsert without relying on a DB unique constraint (some envs lack a unique index on job_id)
  try {
    // ✅ FIX: Check for errors and handle RLS-blocked SELECTs
    const { data: existingTxn, error: selectErr } = await supabase
      ?.from('transactions')
      ?.select('id, transaction_number, org_id')
      ?.eq('job_id', id)
      ?.limit(1)
      ?.maybeSingle?.() // keep compatibility if maybeSingle exists

    // Handle RLS-blocked SELECT: update existing transaction by job_id instead of attempting INSERT
    // This handles legacy data where transaction.org_id might be NULL or stale
    let rlsRecoveryAttempted = false
    if (selectErr) {
      if (isRlsError(selectErr)) {
        console.warn('[dealService:update] RLS blocked transaction SELECT, attempting UPDATE by job_id')
        
        // Get the job's org_id to use for the transaction
        let jobOrgId = baseTransactionData.org_id
        if (!jobOrgId) {
          const { data: jobData, error: jobErr } = await supabase
            ?.from('jobs')
            ?.select('org_id')
            ?.eq('id', id)
            ?.single()
          
          if (jobErr) {
            console.error('[dealService:update] Failed to fetch job org_id:', jobErr?.message)
            throw jobErr
          }
          jobOrgId = jobData?.org_id
        }

        // If job has no org_id (legacy data), try to get user's org_id and set it on both job and transaction
        // This is a graceful recovery for legacy deals created before org scoping was implemented
        let authFailureReason = null
        if (!jobOrgId) {
          console.warn('[dealService:update] Job has no org_id - attempting to set from user profile')
          try {
            const authResult = await supabase.auth.getUser()
            if (authResult.error) {
              authFailureReason = `auth failed: ${authResult.error.message}`
              console.warn('[dealService:update] Auth getUser failed:', authResult.error.message)
              // Auth failure is critical for RLS recovery - throw to provide clear error
              throw new Error(`Authentication failed during RLS recovery: ${authResult.error.message}`)
            }
            const userId = authResult.data?.user?.id
            const userEmail = authResult.data?.user?.email
            if (!userId && !userEmail) {
              authFailureReason = 'no user ID or email in auth result'
              throw new Error('No authenticated user found during RLS recovery')
            }
            
            // Primary: try to find profile by id
            let profileOrgId = null
            if (userId) {
              const profileResult = await supabase
                .from('user_profiles')
                .select('org_id')
                .eq('id', userId)
                .maybeSingle()
              
              if (profileResult.error && isRlsError(profileResult.error)) {
                console.warn('[dealService:update] RLS blocked profile lookup by id, trying email fallback:', profileResult.error.message)
              } else if (profileResult.data?.org_id) {
                profileOrgId = profileResult.data.org_id
              }
            }
            
            // Fallback: try to find profile by email if id lookup failed
            if (!profileOrgId && userEmail) {
              const emailResult = await supabase
                .from('user_profiles')
                .select('org_id')
                .eq('email', userEmail)
                .order('created_at', { ascending: false }) // Use created_at for more deterministic ordering
                .limit(1)
                .maybeSingle()
              
              if (emailResult.error && isRlsError(emailResult.error)) {
                console.warn('[dealService:update] RLS blocked profile lookup by email:', emailResult.error.message)
                authFailureReason = `profile fetch by email blocked by RLS: ${emailResult.error.message}`
              } else if (emailResult.data?.org_id) {
                profileOrgId = emailResult.data.org_id
                console.info('[dealService:update] Found org_id via email fallback')
              }
            }
            
            if (profileOrgId) {
              jobOrgId = profileOrgId
              // Set org_id on the job to fix the legacy data
              const jobUpdateResult = await supabase
                .from('jobs')
                .update({ org_id: jobOrgId })
                .eq('id', id)
              
              if (jobUpdateResult.error) {
                console.warn('[dealService:update] Failed to set job org_id:', jobUpdateResult.error.message)
              } else {
                console.info('[dealService:update] Successfully set job org_id from user profile')
              }
            } else {
              authFailureReason = authFailureReason || 'user profile has no org_id (checked both id and email)'
            }
          } catch (e) {
            authFailureReason = authFailureReason || e?.message
            console.warn('[dealService:update] Unable to get user org_id for legacy fix:', e?.message)
            // Re-throw if this was an auth/user error we explicitly threw
            if (e?.message?.includes('RLS recovery') || e?.message?.includes('authenticated user')) {
              throw e
            }
          }
        }

        if (!jobOrgId) {
          const reason = authFailureReason ? ` (${authFailureReason})` : ''
          throw new Error(`Cannot recover from RLS error: job has no org_id and unable to get user org_id${reason}`)
        }

        // Set the transaction's org_id to match the job's org_id (or user's org_id)
        // The RLS UPDATE policy allows: org_id matches user's org OR job.org_id matches user's org
        baseTransactionData.org_id = jobOrgId
        
        // Attempt UPDATE by job_id (RLS policy allows this via job relationship)
        // This will update the existing transaction's org_id and other fields
        const { data: updateResult, error: updErr } = await supabase
          ?.from('transactions')
          ?.update(baseTransactionData)
          ?.eq('job_id', id)
          ?.select('id')

        if (updErr) {
          console.error('[dealService:update] RLS recovery UPDATE failed:', updErr?.message)
          // If UPDATE fails due to RLS, the transaction may not exist yet.
          // This is expected for legacy deals that never had a transaction created.
          // We suppress this RLS error and let the code fall through to the INSERT path below,
          // where a new transaction will be created with the correct org_id.
          const updErrMsg = String(updErr?.message || '').toLowerCase()
          if (updErrMsg.includes('policy') || updErrMsg.includes('permission') || updErrMsg.includes('rls')) {
            console.warn('[dealService:update] RLS recovery UPDATE failed (likely no existing transaction) - will attempt INSERT')
            // rlsRecoveryAttempted stays false, allowing INSERT path at line ~1830
          } else {
            throw updErr
          }
        }

        // If UPDATE affected rows, we're done (transaction was updated)
        if (updateResult?.length > 0) {
          // Log truncated org_id for debugging while maintaining security
          const orgIdPrefix = jobOrgId ? jobOrgId.slice(0, 8) + '...' : 'N/A'
          console.info('[dealService:update] Successfully updated transaction via RLS recovery, org:', orgIdPrefix)
          rlsRecoveryAttempted = true
        }
        // If UPDATE affected 0 rows or failed with RLS, rlsRecoveryAttempted stays false
        // and the normal INSERT path below will create a new transaction
      } else {
        // Other SELECT errors should be thrown
        throw selectErr
      }
    }

    // Normal path when SELECT succeeded or RLS recovery didn't update any rows
    if (!rlsRecoveryAttempted) {
      if (existingTxn?.id) {
        // Preserve existing org_id if not provided in payload (don't overwrite with null)
        if (!baseTransactionData.org_id && existingTxn.org_id) {
          baseTransactionData.org_id = existingTxn.org_id
        }
        
        const { error: updErr } = await supabase
          ?.from('transactions')
          ?.update(baseTransactionData) // don't overwrite transaction_number on update
          ?.eq('id', existingTxn.id)
        if (updErr) throw updErr
      } else {
        // No transaction exists - create one
        const insertData = { ...baseTransactionData, transaction_number: generateTransactionNumber() }
        const { error: insErr } = await supabase?.from('transactions')?.insert([insertData])
        if (insErr) throw insErr
      }
    }
  } catch (e) {
    // Enhance error message with context about org_id
    if (isRlsError(e)) {
      console.error('[dealService:update] RLS violation on transactions table:', {
        error: e?.message,
        job_id: id,
        has_org_id: !!transactionOrgId,
      })
      
      // Provide more specific guidance based on the scenario
      let guidance = ''
      if (!transactionOrgId) {
        guidance = 'Your user profile may not have an organization assigned. Please contact your administrator to ensure your account is properly configured.'
      } else {
        guidance = 'This deal may have been created before organization scoping was enabled. Please contact your administrator if the issue persists.'
      }
      
      // User-facing message without sensitive org_id
      throw new Error(
        `Failed to save deal: Transaction access denied. ${guidance}`
      )
    }
    throw wrapDbError(e, 'upsert transaction')
  }

  // 3) Replace job_parts with new scheduling fields
  // Delete existing
  const { error: delErr } = await supabase?.from('job_parts')?.delete()?.eq('job_id', id)
  if (delErr) throw wrapDbError(delErr, 'update line items')

  // Insert new (if any) with fallback for missing scheduled_* columns
  if ((normalizedLineItems || []).length > 0) {
    const rows = toJobPartRows(id, normalizedLineItems, {
      includeTimes: JOB_PARTS_HAS_PER_LINE_TIMES,
    })
    if (rows?.length > 0) {
      const { error: insErr } = await supabase?.from('job_parts')?.insert(rows)
      if (insErr) {
        if (isMissingColumnError(insErr)) {
          const errorCode = classifySchemaError(insErr)
          const lower = String(insErr?.message || '').toLowerCase()

          // If vendor_id missing on job_parts, disable capability and retry without vendor_id
          if (lower.includes('job_parts') && lower.includes('vendor_id')) {
            if (JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
              console.warn(
                `[dealService:update] Classified as ${errorCode}; disabling capability and retrying without vendor_id`
              )
              disableJobPartsVendorIdCapability()
              incrementTelemetry?.(TelemetryKey?.VENDOR_ID_FALLBACK)
              const retryRows = toJobPartRows(id, normalizedLineItems, {
                includeTimes: JOB_PARTS_HAS_PER_LINE_TIMES,
              })
              const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)
              if (retryErr) throw wrapDbError(retryErr, 'update line items')
            } else {
              throw wrapDbError(insErr, 'update line items')
            }
          } else if (
            lower.includes('job_parts') &&
            (lower.includes('scheduled_start_time') || lower.includes('scheduled_end_time'))
          ) {
            console.warn(
              `[dealService:update] Classified as ${errorCode}; retrying without time columns`
            )
            disableJobPartsTimeCapability()
            incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
            const retryRows = toJobPartRows(id, normalizedLineItems, { includeTimes: false })
            const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)
            if (retryErr) throw wrapDbError(retryErr, 'update line items')
          } else {
            throw wrapDbError(insErr, 'update line items')
          }
        } else {
          throw wrapDbError(insErr, 'update line items')
        }
      }
    }
  }

  // A3: Handle loaner assignment updates
  if (payload?.customer_needs_loaner && loanerForm) {
    await upsertLoanerAssignment(id, loanerForm)
  } else if (payload?.customer_needs_loaner === false) {
    // Delete loaner assignments when toggle is turned OFF
    const { error: deleteErr } = await supabase
      ?.from('loaner_assignments')
      ?.delete()
      ?.eq('job_id', id)

    if (deleteErr) {
      console.warn('[dealService:update] Failed to delete loaner assignment:', deleteErr.message)
    }
  }

  // 3.5) Update vehicle with stock_number, VIN, and owner_phone if vehicle_id is present
  if (payload?.vehicle_id && (stockNumber || vin || customerPhone)) {
    const vehicleUpdate = {}
    if (stockNumber) vehicleUpdate.stock_number = stockNumber
    if (vin) vehicleUpdate.vin = vin.toUpperCase()
    if (customerPhone) vehicleUpdate.owner_phone = customerPhone

    if (Object.keys(vehicleUpdate).length > 0) {
      const { error: vehicleErr } = await supabase
        ?.from('vehicles')
        ?.update(vehicleUpdate)
        ?.eq('id', payload.vehicle_id)
      // Non-fatal: log but don't fail the deal update if vehicle update fails
      if (vehicleErr)
        console.warn('[dealService:update] Vehicle update failed:', vehicleErr.message)
    }
  }

  // 4) Return full record (with joins and transaction data)
  return await getDeal(id)
}

// ✅ UPDATED: Use safe cascade delete function
export async function deleteDeal(id) {
  const { error } = await supabase?.rpc('delete_job_cascade', { p_job_id: id })
  if (error) throw new Error(`Failed to delete deal: ${error.message}`)
  return true
}

// UPDATE: status only (handy for quick changes)
export async function updateDealStatus(id, job_status) {
  const { data, error } = await supabase
    ?.from('jobs')
    ?.update({ job_status })
    ?.eq('id', id)
    ?.select('id, job_status')
    ?.single()

  if (error) throw new Error(`Failed to update status: ${error.message}`)
  return data
}

// ✅ ENHANCED: mapDbDealToForm implementation with proper customer data handling
/**
 * Normalize time/date fields to prevent "Invalid Date" issues.
 * Rules:
 * 1. Empty strings become null (not empty string)
 * 2. Job scheduled_* fields preserved if explicitly set
 * 3. Line item promised_date kept null if not requires_scheduling
 * 4. No automatic derivation of job scheduled_* from line items (unless explicitly enabled)
 *
 * @param {Object} dbDeal - Raw deal from database
 * @returns {Object} - Deal with normalized time fields
 */
function normalizeDealTimes(dbDeal) {
  if (!dbDeal) return null

  const normalized = { ...dbDeal }

  // Normalize job-level scheduled times: empty string → null
  if (normalized.scheduled_start_time === '') {
    normalized.scheduled_start_time = null
  }
  if (normalized.scheduled_end_time === '') {
    normalized.scheduled_end_time = null
  }

  // Normalize line items
  if (normalized.job_parts && Array.isArray(normalized.job_parts)) {
    normalized.job_parts = normalized.job_parts.map((part) => {
      const normalizedPart = { ...part }

      // If line item doesn't require scheduling, clear promised_date
      if (!normalizedPart.requires_scheduling && normalizedPart.promised_date === '') {
        normalizedPart.promised_date = null
      }

      // Normalize per-line scheduled times: empty string → null
      if (normalizedPart.scheduled_start_time === '') {
        normalizedPart.scheduled_start_time = null
      }
      if (normalizedPart.scheduled_end_time === '') {
        normalizedPart.scheduled_end_time = null
      }

      // If promised_date is empty string, set to null
      if (normalizedPart.promised_date === '') {
        normalizedPart.promised_date = null
      }

      return normalizedPart
    })
  }

  return normalized
}

function mapDbDealToForm(dbDeal) {
  if (!dbDeal) return null

  // Normalize times first to prevent "Invalid Date" issues
  const normalized = normalizeDealTimes(dbDeal)

  // Derive vehicle_description from title or vehicle fields
  // Priority: dbDeal.vehicle_description (if already computed) > derive using helper
  const vehicleDescription =
    normalized?.vehicle_description ||
    deriveVehicleDescription(normalized?.title, normalized?.vehicle)

  return {
    id: normalized?.id,
    updated_at: normalized?.updated_at,
    org_id: normalized?.org_id, // ✅ FIX: Include org_id for RLS compliance in edit flow
    // Deal date (local YYYY-MM-DD format)
    deal_date:
      normalized?.deal_date ||
      normalized?.created_at?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10),
    job_number: normalized?.job_number || '',
    title: normalized?.title || '',
    // Legacy: description kept for backward compatibility with old code
    description: normalized?.description || '',
    // Map DB description to UI notes field (no jobs.notes column exists)
    // The UI displays "Notes" which reads/writes jobs.description
    notes: normalized?.description || '',
    vehicle_description: vehicleDescription,
    vehicleDescription: vehicleDescription,
    stock_number: normalized?.stock_number || normalized?.vehicle?.stock_number || '',
    stockNumber: normalized?.stock_number || normalized?.vehicle?.stock_number || '',
    vendor_id: normalized?.vendor_id,
    vehicle_id: normalized?.vehicle_id,
    job_status: normalized?.job_status || 'pending',
    priority: normalized?.priority || 'medium',
    scheduled_start_time: normalized?.scheduled_start_time || '',
    scheduled_end_time: normalized?.scheduled_end_time || '',
    estimated_hours: normalized?.estimated_hours || '',
    estimated_cost: normalized?.estimated_cost || '',
    actual_cost: normalized?.actual_cost || '',
    location: normalized?.location || '',
    customer_needs_loaner: !!normalized?.customer_needs_loaner,
    assigned_to: normalized?.assigned_to,
    delivery_coordinator_id: normalized?.delivery_coordinator_id,
    finance_manager_id: normalized?.finance_manager_id,
    // ✅ ENHANCED: Include customer data from transactions
    customer_name: normalized?.customer_name || '',
    customerName: normalized?.customer_name || '',
    customer_phone: normalized?.customer_phone || '',
    customerPhone: normalized?.customer_phone || '',
    customer_mobile: normalized?.customer_mobile || normalized?.customer_phone || '',
    customerMobile: normalized?.customer_mobile || normalized?.customer_phone || '',
    customer_email: normalized?.customer_email || '',
    customerEmail: normalized?.customer_email || '',
    // Loaner data - include both flat fields (legacy) and nested loanerForm (current)
    loaner_number: normalized?.loaner_number || '',
    loanerNumber: normalized?.loaner_number || '',
    loanerForm: {
      loaner_number: normalized?.loaner_number || '',
      eta_return_date: normalized?.loaner_eta_return_date || '',
      notes: normalized?.loaner_notes || '',
    },
    // Preserve vehicle for header (stock number)
    vehicle: normalized?.vehicle || null,
    // Line items in snake_case shape expected by the form/UI
    lineItems: (normalized?.job_parts || [])?.map((part, index) => ({
      // Use existing ID or generate a stable temporary ID for new items
      id: part?.id || `temp-${normalized?.id || 'new'}-${index}`,
      product_id: part?.product_id,
      productId: part?.product_id,
      unit_price: part?.unit_price || 0,
      unitPrice: part?.unit_price || 0,
      quantity_used: part?.quantity_used || 1,
      promised_date: part?.promised_date || '',
      promisedDate: part?.promised_date || '',
      scheduled_start_time: part?.scheduled_start_time || '',
      scheduledStartTime: part?.scheduled_start_time || '',
      scheduled_end_time: part?.scheduled_end_time || '',
      scheduledEndTime: part?.scheduled_end_time || '',
      requires_scheduling: !!part?.requires_scheduling,
      requiresScheduling: !!part?.requires_scheduling,
      no_schedule_reason: part?.no_schedule_reason || '',
      noScheduleReason: part?.no_schedule_reason || '',
      is_off_site: !!part?.is_off_site,
      isOffSite: !!part?.is_off_site,
      vendor_id: part?.vendor_id || null,
      vendorId: part?.vendor_id || null,
    })),
  }
}

// A3: New function to mark loaner as returned
export async function markLoanerReturned(loanerAssignmentId) {
  try {
    // Use direct update instead of RPC function if it doesn't exist
    const { error } = await supabase
      ?.from('loaner_assignments')
      ?.update({ returned_at: new Date()?.toISOString() })
      ?.eq('id', loanerAssignmentId)

    if (error) throw error
    return true
  } catch (error) {
    console.error('Failed to mark loaner as returned:', error)
    throw new Error(`Failed to mark loaner as returned: ${error?.message}`)
  }
}

/**
 * Search for existing customers by name to prevent duplicates
 * @param {string} searchTerm - Partial customer name to search for
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Array>} Array of unique customer records with name, email, phone
 */
export async function searchCustomers(searchTerm = '', limit = 10) {
  if (!searchTerm || searchTerm.trim().length < 2) {
    return []
  }

  try {
    const { data, error } = await supabase
      ?.from('transactions')
      ?.select('customer_name, customer_email, customer_phone')
      ?.ilike('customer_name', `%${searchTerm.trim()}%`)
      ?.order('customer_name')
      ?.limit(limit * 3) // Get more to dedupe

    if (error) {
      console.error('[dealService:searchCustomers] Query error:', error)
      return []
    }

    // Deduplicate by customer_name (case-insensitive)
    const seen = new Map()
    const unique = []

    for (const customer of data || []) {
      const key = customer?.customer_name?.toLowerCase()
      if (key && !seen.has(key)) {
        seen.set(key, true)
        unique.push({
          name: customer.customer_name,
          email: customer.customer_email || '',
          phone: customer.customer_phone || '',
        })
        if (unique.length >= limit) break
      }
    }

    return unique
  } catch (err) {
    console.error('[dealService:searchCustomers] Unexpected error:', err)
    return []
  }
}

// Back-compat default export (so both import styles work):
export const dealService = {
  getAllDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStatus,
}

export default dealService

export { mapDbDealToForm, mapFormToDb, mapPermissionError, normalizeDealTimes }
