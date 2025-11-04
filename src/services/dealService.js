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

// (moved below): mapDbDealToForm is implemented near the end and re-exported

// Internal helper: load a fully-joined deal/job by id
async function selectJoinedDealById(id) {
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
        job_parts(id, product_id, unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, scheduled_start_time, scheduled_end_time, product:products(id, name, category, brand))
      `
    )
    ?.eq('id', id)
    ?.single()

  if (jobError) throw new Error(`Failed to load deal: ${jobError.message}`)
  return job
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
    const vehicleDesc = (formState?.vehicle_description || formState?.vehicleDescription || '').trim()
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

  const loanerForm = formState?.loanerForm || null

  // customer fields normalization - apply Title Case to customer name
  const rawCustomerName = (formState?.customerName || formState?.customer_name || '').trim()
  const customerName = rawCustomerName ? titleCase(rawCustomerName) : ''
  
  // Normalize phone to E.164 format for storage
  const rawPhone = (formState?.customerMobile || 
                   formState?.customer_mobile || 
                   formState?.customerPhone || 
                   formState?.customer_phone || '').trim()
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
export function toJobPartRows(jobId, items = []) {
  return (
    // drop null-only rows
    (items || [])
      ?.map((it) => ({
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
        // Add per-line scheduled time window fields
        scheduled_start_time: it?.scheduledStartTime || it?.scheduled_start_time || null,
        scheduled_end_time: it?.scheduledEndTime || it?.scheduled_end_time || null,
        // ✅ REMOVED: total_price as it's auto-generated by database
        // ✅ REMOVED: description field as it doesn't exist in schema
      }))
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

// ✅ FIXED: Updated getAllDeals to remove SQL RPC dependency and use direct queries
export async function getAllDeals() {
  try {
    // Use direct Supabase queries instead of SQL RPC function
    const { data: jobs, error: jobsError } = await supabase
      ?.from('jobs')
      ?.select(
        `
        id, created_at, job_status, service_type, color_code, title, job_number,
        customer_needs_loaner, assigned_to, delivery_coordinator_id, finance_manager_id,
        scheduled_start_time, scheduled_end_time,
        vehicle:vehicles(year, make, model, stock_number),
        vendor:vendors(id, name),
        job_parts(id, product_id, unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, scheduled_start_time, scheduled_end_time, product:products(id, name, category, brand))
      `
      )
      ?.in('job_status', ['draft', 'pending', 'in_progress', 'completed'])
      ?.order('created_at', { ascending: false })

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
        const schedulingParts =
          job?.job_parts?.filter((part) => part?.requires_scheduling && part?.promised_date) || []
        const nextPromisedDate =
          schedulingParts?.length > 0
            ? schedulingParts?.sort(
                (a, b) => new Date(a.promised_date) - new Date(b.promised_date)
              )?.[0]?.promised_date
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
          .sort((a, b) => (a.scheduled_start_time || '').localeCompare(b.scheduled_start_time || ''))
        
        const apptStart = lineItemsWithSchedule?.[0]?.scheduled_start_time || job?.scheduled_start_time || null
        const apptEnd = lineItemsWithSchedule?.[0]?.scheduled_end_time || job?.scheduled_end_time || null

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
          vendor_name: job?.vendor?.name || null,
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
      customer_email: transaction?.customer_email || '',
      total_amount: transaction?.total_amount || 0,
      loaner_number: loaner?.loaner_number || '',
      loaner_id: loaner?.id || null,
      loaner_eta_return_date: loaner?.eta_return_date || null,
      loaner_notes: loaner?.notes || '',
    }
  } catch (error) {
    console.error('[dealService:get] Failed to get deal:', error)
    throw new Error(`Failed to load deal: ${error?.message}`)
  }
}

// CREATE: deal + job_parts
export async function createDeal(formState) {
  const { payload, normalizedLineItems, loanerForm, customerName, customerPhone, customerEmail, stockNumber } =
    mapFormToDb(formState || {})

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
        if (vehicleErr) console.warn('[dealService:create] Vehicle update failed:', vehicleErr.message)
      }
    }
    
    // 2) insert parts (if any)
    if ((normalizedLineItems || []).length > 0) {
      const rows = toJobPartRows(job?.id, normalizedLineItems)
      if (rows?.length > 0) {
        const { error: partsErr } = await supabase?.from('job_parts')?.insert(rows)
        if (partsErr) throw partsErr
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
    throw new Error(`Failed to create deal: ${error.message}`)
  }
}

// UPDATE: deal + replace job_parts - FIXED with proper transaction handling and customer data
export async function updateDeal(id, formState) {
  const { payload, normalizedLineItems, loanerForm, customerName, customerPhone, customerEmail, stockNumber } =
    mapFormToDb(formState || {})

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
    throw new Error(`Failed to update deal: ${jobErr.message || jobErr}`)
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
    throw new Error(`Failed to upsert transaction: ${e?.message || e}`)
  }

  // 3) Replace job_parts with new scheduling fields
  // Delete existing
  const { error: delErr } = await supabase?.from('job_parts')?.delete()?.eq('job_id', id)
  if (delErr) throw new Error(`Failed to update line items: ${delErr.message}`)

  // Insert new (if any)
  if ((normalizedLineItems || []).length > 0) {
    const rows = toJobPartRows(id, normalizedLineItems)
    if (rows?.length > 0) {
      const { error: insErr } = await supabase?.from('job_parts')?.insert(rows)
      if (insErr) throw new Error(`Failed to update line items: ${insErr.message}`)
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
      if (vehicleErr) console.warn('[dealService:update] Vehicle update failed:', vehicleErr.message)
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

  // Compose vehicle_description from vehicle fields if not explicitly provided
  let vehicleDescription = dbDeal?.vehicle_description || ''
  if (!vehicleDescription && dbDeal?.vehicle) {
    const parts = [
      dbDeal?.vehicle?.year,
      dbDeal?.vehicle?.make,
      dbDeal?.vehicle?.model
    ].filter(Boolean)
    if (parts.length > 0) {
      vehicleDescription = parts.join(' ')
    }
  }

  return {
    id: dbDeal?.id,
    updated_at: dbDeal?.updated_at,
    // Deal date (local YYYY-MM-DD format)
    deal_date: dbDeal?.deal_date || dbDeal?.created_at?.slice(0, 10) || new Date().toISOString().slice(0, 10),
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
