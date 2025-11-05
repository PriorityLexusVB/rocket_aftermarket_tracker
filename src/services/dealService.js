// src/services/dealService.js
import { supabase } from '@/lib/supabase'
import { titleCase, normalizePhoneE164 } from '@/lib/format'

// --- helpers -------------------------------------------------------------

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

// Helper to detect missing column errors from PostgREST
function isMissingColumnError(error) {
  const msg = error?.message || error?.toString?.() || ''
  return (
    /column .* does not exist/i.test(msg) ||
    /PGRST.*column/i.test(msg) ||
    /Could not find.*column.*in the schema cache/i.test(msg)
  )
}

// Helper: wrap common PostgREST permission errors with actionable guidance
function wrapDbError(error, actionLabel = 'operation') {
  const raw = String(error?.message || error || '')
  if (/permission denied for table users/i.test(raw)) {
    return new Error(
      `Failed to ${actionLabel}: permission denied while evaluating RLS (auth.users). Update policies to reference public.user_profiles instead of auth.users, or apply migration 20250107150001_fix_claims_rls_policies.sql.`
    )
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

// Export capability status for UI components
export function getCapabilities() {
  return {
    jobPartsHasTimes: JOB_PARTS_HAS_PER_LINE_TIMES,
  }
}

// (moved below): mapDbDealToForm is implemented near the end and re-exported

// Internal helper: load a fully-joined deal/job by id with fallback for missing columns
async function selectJoinedDealById(id) {
  // Try with per-line scheduled times first
  try {
    const { data: job, error: jobError } = await supabase
      ?.from('jobs')
      ?.select(
        `
          id, job_number, title, description, job_status, priority, location,
          vehicle_id, vendor_id, scheduled_start_time, scheduled_end_time,
          estimated_hours, estimated_cost, actual_cost, customer_needs_loaner,
          service_type, delivery_coordinator_id, assigned_to, created_at, updated_at, finance_manager_id,
          vehicle:vehicles(id, year, make, model, stock_number),
          vendor:vendors(id, name),
          sales_consultant:user_profiles!assigned_to(id, name),
          delivery_coordinator:user_profiles!delivery_coordinator_id(id, name),
          finance_manager:user_profiles!finance_manager_id(id, name),
          job_parts(id, product_id, unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, scheduled_start_time, scheduled_end_time, vendor_id, product:products(id, name, category, brand), vendor:vendors(id, name))
        `
      )
      ?.eq('id', id)
      ?.single()

    if (jobError) {
      if (isMissingColumnError(jobError)) {
        console.warn(
          '[dealService:selectJoinedDealById] Per-line times not available, falling back...'
        )
        throw jobError // Let outer catch handle fallback
      }
      throw new Error(`Failed to load deal: ${jobError.message}`)
    }
    return job
  } catch (e) {
    if (isMissingColumnError(e)) {
      // Fallback: query without per-line scheduled times
      const { data: job, error: jobError } = await supabase
        ?.from('jobs')
        ?.select(
          `
            id, job_number, title, description, job_status, priority, location,
            vehicle_id, vendor_id, scheduled_start_time, scheduled_end_time,
            estimated_hours, estimated_cost, actual_cost, customer_needs_loaner,
            service_type, delivery_coordinator_id, assigned_to, created_at, updated_at, finance_manager_id,
            vehicle:vehicles(id, year, make, model, stock_number),
            vendor:vendors(id, name),
            sales_consultant:user_profiles!assigned_to(id, name),
            delivery_coordinator:user_profiles!delivery_coordinator_id(id, name),
            finance_manager:user_profiles!finance_manager_id(id, name),
            job_parts(id, product_id, unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, vendor_id, product:products(id, name, category, brand), vendor:vendors(id, name))
          `
        )
        ?.eq('id', id)
        ?.single()

      if (jobError) throw new Error(`Failed to load deal: ${jobError.message}`)
      return job
    }
    throw e
  }
}

// Map UI form state into DB-friendly pieces: job payload, normalized lineItems, loaner form
function mapFormToDb(formState = {}) {
  // Base payload constrained to known columns
  const base = sanitizeDealPayload(formState || {})

  // Optional tenant scoping if provided by caller
  const orgId = formState?.org_id ?? formState?.orgId
  const payload = orgId ? { ...base, org_id: orgId } : base
  // Ensure title stays meaningful and mirrors description edits for UX consistency
  // Priority: vehicle_description > description > job_number > default
  // Apply Title Case to vehicle_description when present
  {
    const vehicleDesc = (
      formState?.vehicle_description ||
      formState?.vehicleDescription ||
      ''
    ).trim()
    const desc = (formState?.description || '').trim()

    if (vehicleDesc) {
      payload.title = titleCase(vehicleDesc)
    } else if (!payload?.title) {
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
    return {
      product_id: li.product_id ?? null,
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

  // Extract stock_number for vehicle upsert
  const stockNumber = formState?.stockNumber?.trim() || formState?.stock_number?.trim() || ''

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
    const { data: existing } = await supabase
      ?.from('loaner_assignments')
      ?.select('id')
      ?.eq('job_id', jobId)
      ?.is('returned_at', null)
      ?.single()

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

      if (error) throw error
    } else {
      // Create new assignment
      const { error } = await supabase?.from('loaner_assignments')?.insert([assignmentData])

      if (error) throw error
    }
  } catch (error) {
    // Handle uniqueness constraint error gracefully
    if (error?.code === '23505') {
      throw new Error(
        `Loaner ${loanerData?.loaner_number} is already assigned to another active job`
      )
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
async function attachOrCreateVehicleByStockNumber(stockNumber, customerPhone, orgId = null) {
  if (!stockNumber?.trim()) {
    return null // No stock number provided
  }

  const normalizedStock = stockNumber.trim()

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
export async function getAllDeals() {
  try {
    let jobs = null
    let jobsError = null

    // Try with per-line scheduled times first
    try {
      const result = await supabase
        ?.from('jobs')
        ?.select(
          `
          id, created_at, job_status, service_type, color_code, title, job_number,
          customer_needs_loaner, assigned_to, delivery_coordinator_id, finance_manager_id,
          scheduled_start_time, scheduled_end_time,
          vehicle:vehicles(year, make, model, stock_number),
          vendor:vendors(id, name),
          sales_consultant:user_profiles!assigned_to(id, name),
          delivery_coordinator:user_profiles!delivery_coordinator_id(id, name),
          finance_manager:user_profiles!finance_manager_id(id, name),
          job_parts(id, product_id, unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, scheduled_start_time, scheduled_end_time, product:products(id, name, category, brand), vendor:vendors(id, name))
        `
        )
        ?.in('job_status', ['draft', 'pending', 'in_progress', 'completed'])
        ?.order('created_at', { ascending: false })

      jobs = result?.data
      jobsError = result?.error

      if (jobsError && isMissingColumnError(jobsError)) {
        console.warn('[dealService:getAllDeals] Per-line times not available, falling back...')
        // Will be handled by outer catch block
        throw jobsError
      }
    } catch (e) {
      if (isMissingColumnError(e)) {
        // Fallback: query without per-line scheduled times
        const result = await supabase
          ?.from('jobs')
          ?.select(
            `
            id, created_at, job_status, service_type, color_code, title, job_number,
            customer_needs_loaner, assigned_to, delivery_coordinator_id, finance_manager_id,
            scheduled_start_time, scheduled_end_time,
            vehicle:vehicles(year, make, model, stock_number),
            vendor:vendors(id, name),
            sales_consultant:user_profiles!assigned_to(id, name),
            delivery_coordinator:user_profiles!delivery_coordinator_id(id, name),
            finance_manager:user_profiles!finance_manager_id(id, name),
            job_parts(id, product_id, unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, product:products(id, name, category, brand), vendor:vendors(id, name))
          `
          )
          ?.in('job_status', ['draft', 'pending', 'in_progress', 'completed'])
          ?.order('created_at', { ascending: false })

        jobs = result?.data
        jobsError = result?.error
      } else {
        throw e
      }
    }

    if (jobsError) throw jobsError

    // Get transactions and loaner assignments separately for better performance
    const jobIds = jobs?.map((j) => j?.id) || []

    const [transactionsResult, loanersResult] = await Promise.all([
      supabase
        ?.from('transactions')
        ?.select('job_id, customer_name, customer_phone, customer_email, total_amount')
        ?.in('job_id', jobIds),
      supabase
        ?.from('loaner_assignments')
        ?.select('job_id, id, loaner_number, eta_return_date')
        ?.in('job_id', jobIds)
        ?.is('returned_at', null),
    ])

    const transactions = transactionsResult?.data || []
    const loaners = loanersResult?.data || []

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
        // Priority: title (if not generic) > vehicle fields composition
        let vehicleDescription = ''
        const titleStr = job?.title || ''
        const isGenericTitle = /^(Deal\s+[\w-]+|Untitled Deal)$/i.test(titleStr.trim())
        
        if (titleStr && !isGenericTitle) {
          vehicleDescription = titleStr
        } else if (job?.vehicle) {
          const parts = [job?.vehicle?.year, job?.vehicle?.make, job?.vehicle?.model].filter(Boolean)
          if (parts.length > 0) {
            vehicleDescription = parts.join(' ')
          }
        }

        // Aggregate vendor from line items (per-line vendor migration from PR #70)
        // If single vendor across all off-site line items -> display that vendor
        // If multiple vendors -> display "Mixed"
        // If no vendor assigned -> fallback to job-level vendor or "Unassigned"
        const offSiteLineItems = (job?.job_parts || []).filter((p) => p?.is_off_site)
        const lineVendors = offSiteLineItems
          .map((p) => p?.vendor?.name)
          .filter(Boolean)
        const uniqueVendors = [...new Set(lineVendors)]
        
        let aggregatedVendor = null
        if (uniqueVendors.length === 1) {
          aggregatedVendor = uniqueVendors[0]
        } else if (uniqueVendors.length > 1) {
          aggregatedVendor = 'Mixed'
        } else {
          // Fallback to job-level vendor
          aggregatedVendor = job?.vendor?.name || null
        }

        // Extract staff names for display
        const salesConsultantName = job?.sales_consultant?.name || null
        const deliveryCoordinatorName = job?.delivery_coordinator?.name || null
        const financeManagerName = job?.finance_manager?.name || null

        return {
          ...job,
          customer_name: transaction?.customer_name || '',
          customer_phone: transaction?.customer_phone || '',
          customer_phone_e164: phoneE164,
          customer_phone_last4: phoneLast4,
          customer_email: transaction?.customer_email || '',
          total_amount: transaction?.total_amount || 0,
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
      supabase
        ?.from('loaner_assignments')
        ?.select('id, loaner_number, eta_return_date, notes')
        ?.eq('job_id', id)
        ?.is('returned_at', null)
        ?.maybeSingle(),
    ])

    const transaction = transactionResult?.data
    const loaner = loanerResult?.data

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

    // Derive vehicle_description from title (same logic as getAllDeals)
    let vehicleDescription = ''
    const titleStr = job?.title || ''
    const isGenericTitle = /^(Deal\s+[\w-]+|Untitled Deal)$/i.test(titleStr.trim())
    
    if (titleStr && !isGenericTitle) {
      vehicleDescription = titleStr
    } else if (job?.vehicle) {
      const parts = [job?.vehicle?.year, job?.vehicle?.make, job?.vehicle?.model].filter(Boolean)
      if (parts.length > 0) {
        vehicleDescription = parts.join(' ')
      }
    }

    // Extract staff names for display
    const salesConsultantName = job?.sales_consultant?.name || null
    const deliveryCoordinatorName = job?.delivery_coordinator?.name || null
    const financeManagerName = job?.finance_manager?.name || null

    // Aggregate vendor from line items (same as getAllDeals)
    const offSiteLineItems = (job?.job_parts || []).filter((p) => p?.is_off_site)
    const lineVendors = offSiteLineItems
      .map((p) => p?.vendor?.name)
      .filter(Boolean)
    const uniqueVendors = [...new Set(lineVendors)]
    
    let aggregatedVendor = null
    if (uniqueVendors.length === 1) {
      aggregatedVendor = uniqueVendors[0]
    } else if (uniqueVendors.length > 1) {
      aggregatedVendor = 'Mixed'
    } else {
      // Fallback to job-level vendor
      aggregatedVendor = job?.vendor?.name || null
    }

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
      total_amount: transaction?.total_amount || 0,
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
  } = mapFormToDb(formState || {})

  // Fallback tenant scoping: if org_id is missing, try to infer from current user's profile
  if (!payload?.org_id) {
    try {
      const { data: auth } = await supabase?.auth?.getUser?.()
      const userId = auth?.user?.id
      if (userId) {
        const { data: prof } = await supabase
          ?.from('user_profiles')
          ?.select('org_id')
          ?.eq('id', userId)
          ?.single()
        if (prof?.org_id) payload.org_id = prof.org_id
      }
    } catch (e) {
      console.warn('[dealService:create] Unable to infer org_id from profile:', e?.message)
    }
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
      payload?.org_id
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
          // If error is due to missing scheduled_* columns, retry without them
          if (isMissingColumnError(partsErr)) {
            console.warn(
              '[dealService:create] Per-line time columns not available, retrying without them'
            )
            disableJobPartsTimeCapability()
            // Retry insert without scheduled_* fields
            const retryRows = toJobPartRows(job?.id, normalizedLineItems, { includeTimes: false })
            const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)
            if (retryErr) throw retryErr
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
      const baseTransaction = {
        job_id: job?.id,
        vehicle_id: payload?.vehicle_id || null,
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
      const { data: existingTxn } = await supabase
        ?.from('transactions')
        ?.select('id')
        ?.eq('job_id', job?.id)
        ?.limit(1)
        ?.maybeSingle?.()

      if (!existingTxn?.id) {
        await supabase?.from('transactions')?.insert([baseTransaction])
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
    } catch (_) {
      // ignore
    }
    try {
      await supabase?.from('jobs')?.delete()?.eq('id', job?.id)
    } catch (_) {
      // ignore
    }
    // Friendlier guidance for common RLS misconfiguration seen in some environments
    const msg = String(error?.message || error || '')
    if (/permission denied for table users/i.test(msg)) {
      throw new Error(
        'Failed to create deal: permission denied while evaluating RLS (auth.users). Please update RLS policies to reference public.user_profiles instead of auth.users, or apply the migration 20250107150001_fix_claims_rls_policies.sql.'
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
  } = mapFormToDb(formState || {})

  // Fallback tenant scoping: if org_id is missing, try to infer from current user's profile (align with createDeal)
  if (!payload?.org_id) {
    try {
      const { data: auth } = await supabase?.auth?.getUser?.()
      const userId = auth?.user?.id
      if (userId) {
        const { data: prof } = await supabase
          ?.from('user_profiles')
          ?.select('org_id')
          ?.eq('id', userId)
          ?.single()
        if (prof?.org_id) payload.org_id = prof.org_id
      }
    } catch (e) {
      console.warn('[dealService:update] Unable to infer org_id from profile:', e?.message)
    }
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
      payload?.org_id
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
  const baseTransactionData = {
    job_id: id,
    vehicle_id: payload?.vehicle_id || null,
    total_amount: totalDealValue,
    customer_name: customerName || 'Unknown Customer',
    customer_phone: customerPhone || null,
    customer_email: customerEmail || null,
    transaction_status: 'pending',
  }

  // Upsert without relying on a DB unique constraint (some envs lack a unique index on job_id)
  try {
    const { data: existingTxn } = await supabase
      ?.from('transactions')
      ?.select('id, transaction_number')
      ?.eq('job_id', id)
      ?.limit(1)
      ?.maybeSingle?.() // keep compatibility if maybeSingle exists

    if (existingTxn?.id) {
      const { error: updErr } = await supabase
        ?.from('transactions')
        ?.update(baseTransactionData) // don't overwrite transaction_number on update
        ?.eq('id', existingTxn.id)
      if (updErr) throw updErr
    } else {
      const insertData = { ...baseTransactionData, transaction_number: generateTransactionNumber() }
      const { error: insErr } = await supabase?.from('transactions')?.insert([insertData])
      if (insErr) throw insErr
    }
  } catch (e) {
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
        // If error is due to missing scheduled_* columns, retry without them
        if (isMissingColumnError(insErr)) {
          console.warn(
            '[dealService:update] Per-line time columns not available, retrying without them'
          )
          disableJobPartsTimeCapability()
          // Retry insert without scheduled_* fields
          const retryRows = toJobPartRows(id, normalizedLineItems, { includeTimes: false })
          const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)
          if (retryErr) throw wrapDbError(retryErr, 'update line items')
        } else {
          throw wrapDbError(insErr, 'update line items')
        }
      }
    }
  }

  // A3: Handle loaner assignment updates
  if (payload?.customer_needs_loaner && loanerForm) {
    await upsertLoanerAssignment(id, loanerForm)
  }

  // 3.5) Update vehicle with stock_number and owner_phone if vehicle_id is present
  if (payload?.vehicle_id && (stockNumber || customerPhone)) {
    const vehicleUpdate = {}
    if (stockNumber) vehicleUpdate.stock_number = stockNumber
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
function mapDbDealToForm(dbDeal) {
  if (!dbDeal) return null

  // Derive vehicle_description from title (where it's stored) or vehicle fields
  // Priority: dbDeal.vehicle_description (if already computed) > title (if not generic) > vehicle fields composition > empty
  let vehicleDescription = ''
  
  // First check if vehicle_description is already computed (from getDeal/getAllDeals)
  if (dbDeal?.vehicle_description) {
    vehicleDescription = dbDeal.vehicle_description
  } else {
    // Otherwise derive from title or vehicle fields
    const title = dbDeal?.title || ''
    const isGenericTitle = /^(Deal\s+[\w-]+|Untitled Deal)$/i.test(title.trim())
    
    if (title && !isGenericTitle) {
      // Use title as vehicle description since that's where custom descriptions are stored
      vehicleDescription = title
    } else if (dbDeal?.vehicle) {
      // Fallback: compose from vehicle fields if no custom description
      const parts = [dbDeal?.vehicle?.year, dbDeal?.vehicle?.make, dbDeal?.vehicle?.model].filter(
        Boolean
      )
      if (parts.length > 0) {
        vehicleDescription = parts.join(' ')
      }
    }
  }

  return {
    id: dbDeal?.id,
    updated_at: dbDeal?.updated_at,
    // Deal date (local YYYY-MM-DD format)
    deal_date:
      dbDeal?.deal_date ||
      dbDeal?.created_at?.slice(0, 10) ||
      new Date().toISOString().slice(0, 10),
    job_number: dbDeal?.job_number || '',
    title: dbDeal?.title || '',
    // Legacy: description kept for backward compatibility with old code
    description: dbDeal?.description || '',
    // Map DB description to UI notes field (no jobs.notes column exists)
    // The UI displays "Notes" which reads/writes jobs.description
    notes: dbDeal?.description || '',
    vehicle_description: vehicleDescription,
    vehicleDescription: vehicleDescription,
    stock_number: dbDeal?.stock_number || dbDeal?.vehicle?.stock_number || '',
    stockNumber: dbDeal?.stock_number || dbDeal?.vehicle?.stock_number || '',
    vendor_id: dbDeal?.vendor_id,
    vehicle_id: dbDeal?.vehicle_id,
    job_status: dbDeal?.job_status || 'pending',
    priority: dbDeal?.priority || 'medium',
    scheduled_start_time: dbDeal?.scheduled_start_time || '',
    scheduled_end_time: dbDeal?.scheduled_end_time || '',
    estimated_hours: dbDeal?.estimated_hours || '',
    estimated_cost: dbDeal?.estimated_cost || '',
    actual_cost: dbDeal?.actual_cost || '',
    location: dbDeal?.location || '',
    customer_needs_loaner: !!dbDeal?.customer_needs_loaner,
    assigned_to: dbDeal?.assigned_to,
    delivery_coordinator_id: dbDeal?.delivery_coordinator_id,
    finance_manager_id: dbDeal?.finance_manager_id,
    // ✅ ENHANCED: Include customer data from transactions
    customer_name: dbDeal?.customer_name || '',
    customerName: dbDeal?.customer_name || '',
    customer_phone: dbDeal?.customer_phone || '',
    customerPhone: dbDeal?.customer_phone || '',
    customer_mobile: dbDeal?.customer_mobile || dbDeal?.customer_phone || '',
    customerMobile: dbDeal?.customer_mobile || dbDeal?.customer_phone || '',
    customer_email: dbDeal?.customer_email || '',
    customerEmail: dbDeal?.customer_email || '',
    // Loaner data
    loaner_number: dbDeal?.loaner_number || '',
    loanerNumber: dbDeal?.loaner_number || '',
    // Preserve vehicle for header (stock number)
    vehicle: dbDeal?.vehicle || null,
    // Line items in snake_case shape expected by the form/UI
    lineItems: (dbDeal?.job_parts || [])?.map((part, index) => ({
      // Use existing ID or generate a stable temporary ID for new items
      id: part?.id || `temp-${dbDeal?.id || 'new'}-${index}`,
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

export { mapDbDealToForm, mapFormToDb }
