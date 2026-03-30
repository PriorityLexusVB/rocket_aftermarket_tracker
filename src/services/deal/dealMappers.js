// src/services/deal/dealMappers.js
// Data transformation functions: mapFormToDb, mapDbDealToForm, normalizeDealTimes, toJobPartRows
import { titleCase, normalizePhoneE164 } from '@/lib/format'
import { formatTime } from '@/utils/dateTimeUtils'
import {
  sanitizeDealPayload,
  GENERIC_TITLE_PATTERN,
  deriveVehicleDescription,
  JOB_PARTS_HAS_PER_LINE_TIMES,
  JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE,
} from './dealHelpers.js'

// Map UI form state into DB-friendly pieces: job payload, normalized lineItems, loaner form
export function mapFormToDb(formState = {}) {
  // Base payload constrained to known columns
  const base = sanitizeDealPayload(formState || {})

  // Optional tenant scoping if provided by caller
  const dealerId =
    formState?.dealer_id ?? formState?.dealerId ?? formState?.org_id ?? formState?.orgId
  const payload = dealerId ? { ...base, dealer_id: dealerId } : base
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
    const desc = (formState?.description || '').trim()
    const notes = (formState?.notes || '').trim()
    // Only fall back to notes when no explicit description is provided.
    // DealForm V2 uses `description` as the editable Customer Name field.
    if (!desc && notes) {
      payload.description = notes
    }
  }

  // Accept either lineItems (current UI) or line_items (alternate callers)
  const lineItemsInput = Array.isArray(formState?.line_items)
    ? formState?.line_items
    : Array.isArray(formState?.lineItems)
      ? formState?.lineItems
      : []

  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

  const normalizedLineItems = (lineItemsInput || []).map((li) => {
    const idRaw = li?.id ?? li?.job_part_id ?? li?.jobPartId ?? null
    const idNorm = typeof idRaw === 'string' && uuidRegex.test(idRaw) ? idRaw : null

    const productIdRaw = li?.product_id ?? li?.productId ?? null
    const productIdNorm =
      typeof productIdRaw === 'string'
        ? productIdRaw.trim()
          ? productIdRaw.trim()
          : null
        : productIdRaw
    const requiresSchedulingNorm =
      li?.requires_scheduling ?? li?.requiresScheduling ?? true /* default to true */
    const noScheduleReasonNorm = li?.no_schedule_reason || li?.noScheduleReason || null
    const lineItemPromisedDateRaw = li?.promised_date || li?.lineItemPromisedDate || null
    const lineItemPromisedDateNorm = lineItemPromisedDateRaw
      ? String(lineItemPromisedDateRaw).slice(0, 10)
      : null
    const isOffSiteNorm = li?.is_off_site ?? li?.isOffSite ?? false
    const scheduledStartNorm = li?.scheduled_start_time || li?.scheduledStartTime || null
    const scheduledEndNorm = li?.scheduled_end_time || li?.scheduledEndTime || null
    const vendorIdNorm = li?.vendor_id ?? li?.vendorId ?? null

    return {
      id: idNorm,
      product_id: productIdNorm ?? null,
      vendor_id: vendorIdNorm,
      quantity_used: Number(li.quantity_used ?? li.quantity ?? 1),
      unit_price: Number(li.unit_price ?? li.price ?? 0),
      promised_date: lineItemPromisedDateNorm,
      requires_scheduling: !!requiresSchedulingNorm,
      no_schedule_reason: requiresSchedulingNorm ? null : noScheduleReasonNorm,
      is_off_site: !!isOffSiteNorm,
      scheduled_start_time: scheduledStartNorm,
      scheduled_end_time: scheduledEndNorm,
      vendorId: vendorIdNorm,
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
    vendor_id: it.vendor_id,
    quantity: Number(it.quantity_used ?? 1),
    unit_price: Number(it.unit_price ?? 0),
    total_price: Number(it.unit_price ?? 0) * Number(it.quantity_used ?? 1),
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

  // If the user entered a loaner number, treat this deal as needing a loaner.
  // This keeps Edit Deal behavior intuitive even if the toggle wasn't set.
  const loanerNumberTrimmed =
    typeof loanerForm?.loaner_number === 'string' ? loanerForm.loaner_number.trim() : ''
  if (loanerForm && typeof loanerForm?.loaner_number === 'string') {
    loanerForm = {
      ...loanerForm,
      loaner_number: loanerNumberTrimmed,
    }
  }
  if (loanerNumberTrimmed) {
    payload.customer_needs_loaner = true
  }

  // customer fields normalization - apply Title Case to customer name
  // Canonical source: explicit customerName/customer_name when provided.
  // Back-compat: DealForm v1 uses `description` as the editable Customer Name field.
  const rawCustomerName = (formState?.customerName || formState?.customer_name || '').trim()
  const rawCustomerNameFromDescription = (formState?.description || '').trim()
  const effectiveCustomerName = rawCustomerName || rawCustomerNameFromDescription
  const customerName = effectiveCustomerName ? titleCase(effectiveCustomerName) : ''

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

  const rows =
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
            it?.promised_date ||
            // If requires scheduling and no date provided, default to today to satisfy DB constraint
            (it?.requiresScheduling || it?.requires_scheduling
              ? new Date().toISOString().slice(0, 10)
              : null),
          requires_scheduling: !!(it?.requiresScheduling ?? it?.requires_scheduling),
          no_schedule_reason:
            (it?.requiresScheduling ?? it?.requires_scheduling)
              ? null
              : it?.noScheduleReason || it?.no_schedule_reason || null,
          is_off_site: !!(it?.isOffSite ?? it?.is_off_site),
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

  // 🔍 DEBUG: Detect potential duplicates based on product_id
  if (import.meta.env.MODE === 'development' && rows?.length > 0) {
    const productIds = rows.map((r) => r.product_id).filter(Boolean)
    const uniqueProductIds = new Set(productIds)
    if (productIds.length !== uniqueProductIds.size) {
      console.warn(
        '[toJobPartRows] ⚠️ DUPLICATE DETECTION: Multiple rows have the same product_id!',
        {
          totalRows: rows.length,
          uniqueProducts: uniqueProductIds.size,
          productIds,
        }
      )
    }
  }

  return rows
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
export function normalizeDealTimes(dbDeal) {
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

export function mapDbDealToForm(dbDeal) {
  if (!dbDeal) return null

  // Normalize times first to prevent "Invalid Date" issues
  const normalized = normalizeDealTimes(dbDeal)

  // Derive vehicle_description from title or vehicle fields
  // Priority: dbDeal.vehicle_description (if already computed) > derive using helper
  const vehicleDescription =
    normalized?.vehicle_description ||
    deriveVehicleDescription(normalized?.title, normalized?.vehicle)

  // DealForm v1 labels `description` as "Customer Name".
  // Prefer transaction-derived customer_name when available; fall back to jobs.description for legacy records.
  const customerNameForForm = (normalized?.customer_name || '').trim()
  const legacyDescription = normalized?.description || ''

  return {
    id: normalized?.id,
    updated_at: normalized?.updated_at,
    dealer_id: normalized?.dealer_id,
    org_id: normalized?.org_id, // Legacy/back-compat only (older DB rows / older callers)
    // Deal date (local YYYY-MM-DD format)
    deal_date:
      normalized?.deal_date ||
      normalized?.created_at?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10),
    job_number: normalized?.job_number || '',
    title: normalized?.title || '',
    // DealForm v1: description input is treated as Customer Name.
    // Hydrate from transaction customer_name first for consistency across list/detail.
    description: customerNameForForm || legacyDescription,
    // Map DB description to UI notes field (no jobs.notes column exists)
    // The UI displays "Notes" which reads/writes jobs.description
    notes: legacyDescription,
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
    eta_return_date: normalized?.loaner_eta_return_date || '', // ✅ FIX: Add top-level field for DealFormV2 compatibility
    loaner_notes: normalized?.loaner_notes || '',
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
      promised_date: part?.promised_date ? String(part.promised_date).slice(0, 10) : '',
      promisedDate: part?.promised_date ? String(part.promised_date).slice(0, 10) : '',
      // ✅ FIX: Use formatTime() for proper timezone conversion (America/New_York)
      scheduled_start_time: formatTime(part?.scheduled_start_time),
      scheduledStartTime: formatTime(part?.scheduled_start_time),
      scheduled_end_time: formatTime(part?.scheduled_end_time),
      scheduledEndTime: formatTime(part?.scheduled_end_time),
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

// Helper: Compute earliest time window from line items for job-level fallback
export function computeEarliestTimeWindow(normalizedLineItems) {
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
