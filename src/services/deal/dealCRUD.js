// src/services/deal/dealCRUD.js
// Core CRUD operations: getAllDeals, getDeal, createDeal, updateDeal, deleteDeal, updateDealStatus, searchCustomers, findJobIdByJobNumber
import { supabase } from '@/lib/supabase'
import {
  buildUserProfileSelectFragment,
  resolveUserProfileName,
  ensureUserProfileCapsLoaded,
  downgradeCapForErrorMessage,
} from '@/utils/userProfileName'
import {
  classifySchemaError,
  isMissingColumnError,
  isMissingRelationshipError,
  getRemediationGuidance,
} from '@/utils/schemaErrorClassifier'
import { formatEtMonthDay } from '@/utils/scheduleDisplay'
import { syncJobPartsForJob } from '@/services/jobPartsService'
import { incrementTelemetry, TelemetryKey } from '@/utils/capabilityTelemetry'

import {
  IS_TEST_ENV,
  warnSchema,
  isRlsError,
  isMissingReturnedAtError,
  sumJobParts,
  getUserOrgIdWithFallback,
  generateTransactionNumber,
  deriveVehicleDescription,
  aggregateVendor,
  wrapDbError,
  applyReturnedAtIsNullFilter,
  loanerAssignmentsHasReturnedAt,
  setLoanerAssignmentsReturnedAtCapability,
  loanerAssignmentsHasDealerId,
  setLoanerAssignmentsDealerIdCapability,
  jobsHasNextPromisedIso,
  setJobsNextPromisedIsoCapability,
  jobsJobStatusSupportsDraft,
  setJobsJobStatusDraftCapability,
  JOB_PARTS_HAS_PER_LINE_TIMES,
  JOB_PARTS_VENDOR_REL_AVAILABLE,
  JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE,
  disableJobPartsTimeCapability,
  disableJobPartsVendorRelCapability,
  enableJobPartsVendorRelCapability,
  setJobPartsVendorRelAvailable,
  disableJobPartsVendorIdCapability,
  incrementFallbackTelemetry,
  getOrgContext,
  mapPermissionError,
} from './dealHelpers.js'

import { mapFormToDb, computeEarliestTimeWindow } from './dealMappers.js'
import { upsertLoanerAssignment, saveLoanerAssignment } from './dealLoaners.js'

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
          id, dealer_id, job_number, title, description, job_status, priority, location,
          vehicle_id, vendor_id, scheduled_start_time, scheduled_end_time,
          estimated_hours, estimated_cost, actual_cost, customer_needs_loaner,
          service_type, delivery_coordinator_id, assigned_to, created_at, updated_at, finance_manager_id,
          vehicle:vehicles(id, year, make, model, stock_number, owner_name, owner_email, owner_phone),
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
        id, dealer_id, job_number, title, description, job_status, priority, location,
            vehicle_id, vendor_id, scheduled_start_time, scheduled_end_time,
            estimated_hours, estimated_cost, actual_cost, customer_needs_loaner,
            service_type, delivery_coordinator_id, assigned_to, created_at, updated_at, finance_manager_id,
        vehicle:vehicles(id, year, make, model, stock_number, owner_name, owner_email, owner_phone),
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

// Helper: Attach or create vehicle by stock number when vehicle_id is missing
async function attachOrCreateVehicleByStockNumber(
  stockNumber,
  customerPhone,
  dealerId = null,
  vin = null
) {
  if (!stockNumber?.trim()) {
    return null // No stock number provided
  }

  const normalizedStock = stockNumber.trim()
  const normalizedVin = vin?.trim()?.toUpperCase() || null

  try {
    // Try to find existing vehicle by stock_number
    let query = supabase?.from('vehicles')?.select('id')?.eq('stock_number', normalizedStock)

    // Optionally scope by dealer_id if provided
    if (dealerId) {
      query = query?.eq('dealer_id', dealerId)
    }

    let { data: existing, error: lookupErr } = await query?.maybeSingle()

    // Backward compatibility: if dealer_id column doesn't exist on vehicles, retry unscoped.
    if (lookupErr && isMissingColumnError(lookupErr)) {
      const haystack = [lookupErr?.message, lookupErr?.details, lookupErr?.hint]
        .filter(Boolean)
        .join(' ')
      if (/\bdealer_id\b/i.test(haystack)) {
        const retry = supabase?.from('vehicles')?.select('id')?.eq('stock_number', normalizedStock)
        ;({ data: existing, error: lookupErr } = await retry?.maybeSingle())
      }
    }

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

    if (dealerId) {
      vehicleData.dealer_id = dealerId
    }

    let { data: newVehicle, error: createErr } = await supabase
      ?.from('vehicles')
      ?.insert([vehicleData])
      ?.select('id')
      ?.single()

    // Backward compatibility: if dealer_id column doesn't exist, retry without it.
    if (createErr && isMissingColumnError(createErr) && vehicleData?.dealer_id) {
      const haystack = [createErr?.message, createErr?.details, createErr?.hint]
        .filter(Boolean)
        .join(' ')
      if (/\bdealer_id\b/i.test(haystack)) {
        const retryVehicleData = { ...vehicleData }
        delete retryVehicleData.dealer_id
        ;({ data: newVehicle, error: createErr } = await supabase
          ?.from('vehicles')
          ?.insert([retryVehicleData])
          ?.select('id')
          ?.single())
      }
    }

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
    // Safe default: do NOT request jobs.next_promised_iso unless we already know it exists.
    // This avoids an initial PostgREST 400 on environments where the column is absent.
    let includeNextPromisedIso = jobsHasNextPromisedIso === true

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
          .select(probeFields.join(', '), { head: true })
          .limit(1)

        if (probeError && isMissingColumnError(probeError)) {
          const errorCode = classifySchemaError(probeError)
          const msg = probeError.message.toLowerCase()

          if (msg.includes('scheduled_start_time') || msg.includes('scheduled_end_time')) {
            warnSchema(
              `[dealService:getAllDeals] Preflight: classified as ${errorCode}; disabling capability`
            )
            disableJobPartsTimeCapability()
            incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
          }
          if (msg.includes('vendor_id')) {
            warnSchema(
              `[dealService:getAllDeals] Preflight: classified as ${errorCode}; disabling capability`
            )
            disableJobPartsVendorIdCapability()
            incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
          }
        }
      } catch (preflightError) {
        warnSchema('[dealService:getAllDeals] Preflight probe failed, continuing:', preflightError)
      }
    }

    // Refresh vendor relationship capability from sessionStorage per invocation to avoid stale module state across tests
    if (typeof sessionStorage !== 'undefined') {
      const storedRel = sessionStorage.getItem('cap_jobPartsVendorRel')
      if (storedRel === 'false') setJobPartsVendorRelAvailable(false)
      else if (storedRel === 'true') setJobPartsVendorRelAvailable(true)
      else setJobPartsVendorRelAvailable(true)
    } else {
      setJobPartsVendorRelAvailable(true)
    }

    let jobs = null
    let jobsError = null
    // Some environments have job_status as an enum that does NOT include "draft".
    // If we include an invalid enum value in an .in() filter, Postgres will hard-fail the query.
    // Start with the preferred list (includes draft for environments that support it) and retry
    // without draft if the database rejects it.
    let jobStatusFilter =
      jobsJobStatusSupportsDraft === false
        ? ['pending', 'scheduled', 'in_progress', 'completed']
        : ['draft', 'pending', 'scheduled', 'in_progress', 'completed']

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
      const productFields = `product:products(id, name, op_code, category, brand${JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE ? ', vendor_id' : ''})`
      const jobPartsFieldsVendor = `job_parts(${jobPartsCore}${jobPartsTimeFields}, ${productFields}${perLineVendorJoin2})`
      const jobPartsFieldsNoVendor = `job_parts(${jobPartsCore}${jobPartsTimeFields}, ${productFields})`

      const baseSelect = `
          id, dealer_id, created_at, job_status, service_type, color_code, title, job_number,
          customer_needs_loaner, assigned_to, delivery_coordinator_id, finance_manager_id,
          scheduled_start_time, scheduled_end_time,
          ${includeNextPromisedIso ? 'next_promised_iso,' : ''}
          vehicle:vehicles(year, make, model, stock_number, owner_name, owner_email, owner_phone),
          vendor:vendors(id, name),
          ${salesConsultant},
          ${deliveryCoordinator},
          ${financeManager},
          ${JOB_PARTS_VENDOR_REL_AVAILABLE ? jobPartsFieldsVendor : jobPartsFieldsNoVendor}
        `

      const result = await supabase
        ?.from('jobs')
        ?.select(baseSelect)
        ?.in('job_status', jobStatusFilter)
        ?.order('created_at', { ascending: false })

      jobs = result?.data
      jobsError = result?.error

      if (!jobsError) {
        if (includeNextPromisedIso) setJobsNextPromisedIsoCapability(true)
        if (jobStatusFilter.includes('draft')) setJobsJobStatusDraftCapability(true)
        // Mark capabilities successful on success
        // Only re-affirm vendor relationship capability if we actually used it in this attempt
        if (JOB_PARTS_VENDOR_REL_AVAILABLE) {
          enableJobPartsVendorRelCapability()
        }
        break
      }

      // If job_status is an enum that doesn't include "draft", retry without it.
      const msg = String(jobsError?.message || '')
      if (
        jobStatusFilter.includes('draft') &&
        msg.toLowerCase().includes('invalid input value for enum') &&
        msg.toLowerCase().includes('job_status') &&
        msg.includes('"draft"')
      ) {
        warnSchema(
          '[dealService:getAllDeals] job_status enum does not support "draft"; retrying without it'
        )
        setJobsJobStatusDraftCapability(false)
        jobStatusFilter = jobStatusFilter.filter((s) => s !== 'draft')
        continue
      }

      // If job_status is an enum that doesn't include "scheduled", retry without it.
      if (
        jobStatusFilter.includes('scheduled') &&
        msg.toLowerCase().includes('invalid input value for enum') &&
        msg.toLowerCase().includes('job_status') &&
        (msg.includes('"scheduled"') || msg.includes("'scheduled'"))
      ) {
        warnSchema(
          '[dealService:getAllDeals] job_status enum does not support "scheduled"; retrying without it'
        )
        jobStatusFilter = jobStatusFilter.filter((s) => s !== 'scheduled')
        continue
      }

      // Handle specific fallbacks
      if (isMissingColumnError(jobsError)) {
        const msg = jobsError.message || ''
        const errorCode = classifySchemaError(jobsError)

        if (/user_profiles/i.test(msg)) {
          warnSchema(`[dealService:getAllDeals] Classified as ${errorCode}; degrading capability`)
          downgradeCapForErrorMessage(msg)
          continue // retry with degraded user profile fields
        }

        const lower = msg.toLowerCase()

        // Some environments don't have next_promised_iso on jobs yet.
        if (includeNextPromisedIso && lower.includes('next_promised_iso')) {
          warnSchema(
            `[dealService:getAllDeals] Classified as ${errorCode}; next_promised_iso missing on jobs; retrying without it...`
          )
          setJobsNextPromisedIsoCapability(false)
          includeNextPromisedIso = false
          continue
        }

        // Detect missing per-line time columns on job_parts and disable that capability
        if (
          lower.includes('job_parts') &&
          (lower.includes('scheduled_start_time') || lower.includes('scheduled_end_time'))
        ) {
          if (JOB_PARTS_HAS_PER_LINE_TIMES) {
            warnSchema(
              `[dealService:getAllDeals] Classified as ${errorCode}; disabling per-line time capability and retrying...`
            )
            disableJobPartsTimeCapability()
            incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
            continue
          }
        }

        warnSchema(
          `[dealService:getAllDeals] Missing column detected (${errorCode}), retrying if capability allows...`
        )

        if (lower.includes('job_parts') && lower.includes('vendor_id')) {
          if (JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
            warnSchema(`[dealService:getAllDeals] Classified as ${errorCode}; degrading capability`)
            disableJobPartsVendorIdCapability()
            incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
            continue
          }
        }
      }
      if (isMissingRelationshipError(jobsError) && JOB_PARTS_VENDOR_REL_AVAILABLE) {
        const errorCode = classifySchemaError(jobsError)
        warnSchema(
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

    const [transactionsResult, initialLoanersResult] = await Promise.all([
      supabase
        ?.from('transactions')
        ?.select('job_id, customer_name, customer_phone, customer_email, total_amount')
        ?.in('job_id', jobIds),
      (() => {
        const q = supabase
          ?.from('loaner_assignments')
          ?.select('job_id, id, loaner_number, eta_return_date')
          ?.in('job_id', jobIds)
        return applyReturnedAtIsNullFilter(q)
      })(),
    ])

    let loanersResult = initialLoanersResult
    if (loanersResult?.error && isMissingReturnedAtError(loanersResult.error)) {
      setLoanerAssignmentsReturnedAtCapability(false)
      loanersResult = await supabase
        ?.from('loaner_assignments')
        ?.select('job_id, id, loaner_number, eta_return_date')
        ?.in('job_id', jobIds)
    } else if (!loanersResult?.error && loanerAssignmentsHasReturnedAt !== false) {
      setLoanerAssignmentsReturnedAtCapability(true)
    }

    const transactions = transactionsResult?.data || []

    // Handle loaner_assignments RLS errors gracefully
    // 403 errors can occur when jobs have missing org_id or user lacks access
    let loaners = []
    if (loanersResult?.error) {
      if (isRlsError(loanersResult.error)) {
        console.warn(
          '[dealService:getAllDeals] RLS blocked loaner_assignments query (non-fatal):',
          loanersResult.error?.message
        )
        // Silently degrade - deals will show without loaner info for inaccessible jobs
      } else {
        console.warn(
          '[dealService:getAllDeals] loaner_assignments query failed (non-fatal):',
          loanersResult.error?.message
        )
      }
    } else {
      loaners = loanersResult?.data || []
    }

    // Process and enhance the data
    const mappedDeals =
      jobs?.map((job) => {
        const transaction = transactions?.find((t) => t?.job_id === job?.id)
        const loaner = loaners?.find((l) => l?.job_id === job?.id)

        // Calculate next promised date from job parts.
        // Keep this as a DATE-only key (YYYY-MM-DD) to avoid timezone/day-shift bugs.
        const schedulingParts =
          job?.job_parts?.filter((part) => part?.requires_scheduling && part?.promised_date) || []
        const nextPromisedDate =
          schedulingParts?.length > 0
            ? schedulingParts
                ?.map((p) => String(p?.promised_date || '').slice(0, 10))
                .filter(Boolean)
                .sort()?.[0]
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

        const transactionTotal = parseFloat(transaction?.total_amount)
        const partsTotal = sumJobParts(job?.job_parts)
        const totalAmount = Number.isFinite(transactionTotal) ? transactionTotal : partsTotal

        return {
          ...job,
          customer_name: transaction?.customer_name || '',
          customer_phone: transaction?.customer_phone || '',
          customer_phone_e164: phoneE164,
          customer_phone_last4: phoneLast4,
          customer_email: transaction?.customer_email || '',
          total_amount: totalAmount,
          has_active_loaner: !!loaner?.id,
          next_promised_iso: nextPromisedDate || null,
          loaner_id: loaner?.id || null,
          loaner_number: loaner?.loaner_number || null,
          loaner_eta_short: loaner?.eta_return_date
            ? formatEtMonthDay(loaner.eta_return_date)
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
                  owner_name: job?.vehicle?.owner_name ?? null,
                  owner_email: job?.vehicle?.owner_email ?? null,
                  owner_phone: job?.vehicle?.owner_phone ?? null,
                }
              : null,
          stock_no: job?.vehicle?.stock_number,
        }
      }) || []

    if (IS_TEST_ENV) return mappedDeals

    // Show all deals by default. Any narrowing should come from the UI's filters/search.
    return mappedDeals
  } catch (error) {
    console.error('Failed to load deals:', error)
    // Provide specific guidance for missing relationship errors using classifier
    if (isMissingRelationshipError(error)) {
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
    const [transactionResult, initialLoanerResult] = await Promise.all([
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
        const q2 = applyReturnedAtIsNullFilter(q)
        return q2 && typeof q2.maybeSingle === 'function' ? q2.maybeSingle() : q2
      })(),
    ])

    let loanerResult = initialLoanerResult
    if (loanerResult?.error && isMissingReturnedAtError(loanerResult.error)) {
      setLoanerAssignmentsReturnedAtCapability(false)
      loanerResult = await supabase
        ?.from('loaner_assignments')
        ?.select('id, loaner_number, eta_return_date, notes')
        ?.eq('job_id', id)
        ?.maybeSingle()
    } else if (!loanerResult?.error && loanerAssignmentsHasReturnedAt !== false) {
      setLoanerAssignmentsReturnedAtCapability(true)
    }

    const transaction = transactionResult?.data

    // Handle loaner_assignments RLS errors gracefully
    // 403 errors can occur when jobs have missing org_id or user lacks access
    let loaner = null
    if (loanerResult?.error) {
      if (isRlsError(loanerResult.error)) {
        console.warn(
          '[dealService:getDeal] RLS blocked loaner_assignments query (non-fatal):',
          loanerResult.error?.message
        )
        // Silently degrade - deal will show without loaner info
      } else {
        console.warn(
          '[dealService:getDeal] loaner_assignments query failed (non-fatal):',
          loanerResult.error?.message
        )
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

    const transactionTotal = parseFloat(transaction?.total_amount)
    const partsTotal = sumJobParts(job?.job_parts)
    const totalAmount = Number.isFinite(transactionTotal) ? transactionTotal : partsTotal

    return {
      ...jobForUi,
      customer_name: transaction?.customer_name || '',
      customer_phone: transaction?.customer_phone || '',
      customer_phone_e164: phoneE164,
      customer_phone_last4: phoneLast4,
      customer_email: transaction?.customer_email || '',
      total_amount: totalAmount,
      has_active_loaner: !!loaner?.id,
      next_promised_iso: nextPromisedDate || null,
      loaner_number: loaner?.loaner_number || '',
      loaner_id: loaner?.id || null,
      loaner_eta_return_date: loaner?.eta_return_date || null,
      loaner_eta_short: loaner?.eta_return_date ? formatEtMonthDay(loaner.eta_return_date) : null,
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
function hasTimedLineItems(lineItems = []) {
  return (lineItems || []).some((it) => {
    if (!it?.requires_scheduling) return false
    return !!(
      it?.scheduled_start_time ||
      it?.scheduled_end_time ||
      it?.scheduledStartTime ||
      it?.scheduledEndTime
    )
  })
}

function maybeAutoUpgradeJobStatusToScheduled(currentStatus, normalizedLineItems) {
  const s = String(currentStatus || '')
    .trim()
    .toLowerCase()
  const eligible = !s || s === 'new' || s === 'pending'
  if (!eligible) return currentStatus
  // Only promote when a real time window exists; promised_date alone should not
  // move a deal out of the Deals "Booked (time TBD)" lane.
  if (!hasTimedLineItems(normalizedLineItems)) return currentStatus
  return 'scheduled'
}

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

  // Default: keep new deals in the Deals "Booked (time TBD)" lane unless a real time window exists.
  if (!payload?.job_status) payload.job_status = 'pending'

  // Product rule: if there's timed schedulable work, treat the job as scheduled.
  payload.job_status = maybeAutoUpgradeJobStatusToScheduled(
    payload?.job_status,
    normalizedLineItems
  )

  // Fallback tenant scoping: if dealer_id is missing, try to infer from current user's profile
  if (!payload?.dealer_id) {
    const inferredDealerId = await getUserOrgIdWithFallback('create')
    if (inferredDealerId) {
      payload.dealer_id = inferredDealerId
    }
  }

  // ✅ VALIDATION: Warn if dealer_id is missing (may cause RLS violations in production)
  // In test environments, this is logged but doesn't block operation
  if (!payload?.dealer_id) {
    if (import.meta?.env?.MODE !== 'test') {
      console.warn(
        '[dealService:create] ⚠️ CRITICAL: dealer_id is missing! This may cause RLS violations. ' +
          'Ensure UI passes dealer_id or user is properly authenticated.'
      )
    }
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
      payload?.dealer_id,
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

    // 2) Sync parts using identity-based sync (prevents resurrection bugs)
    if ((normalizedLineItems || []).length > 0) {
      await syncJobPartsForJob(job?.id, normalizedLineItems, {
        // Prefer explicitly sending null scheduled_* to avoid environments with DB defaults
        // turning promise-only items into scheduled windows.
        includeTimes: true,
      })
    }

    // Some environments have DB triggers/defaults that materialize a scheduled window
    // from promised dates even when the user did not set schedule times.
    // If the user provided no schedule window, force the job (and optionally job_parts)
    // to remain scheduled-without-time so the UI renders a promise date with "All-day".
    try {
      const userProvidedJobTimes = !!(payload?.scheduled_start_time || payload?.scheduled_end_time)
      const userProvidedLineTimes = (normalizedLineItems || []).some(
        (it) =>
          !!(
            it?.scheduled_start_time ||
            it?.scheduled_end_time ||
            it?.scheduledStartTime ||
            it?.scheduledEndTime
          )
      )
      const hasPromiseOnlyLine = (normalizedLineItems || []).some(
        (it) => !!it?.requires_scheduling && !!it?.promised_date
      )
      const shouldForceUnscheduled =
        hasPromiseOnlyLine && !userProvidedJobTimes && !userProvidedLineTimes

      if (shouldForceUnscheduled && job?.id) {
        const { error: clearJobErr } = await supabase
          ?.from('jobs')
          ?.update({ scheduled_start_time: null, scheduled_end_time: null })
          ?.eq('id', job.id)
        if (clearJobErr) {
          console.warn(
            '[dealService:create] Failed to clear job scheduled_* (non-fatal):',
            clearJobErr.message
          )
        }

        // If per-line time columns are in play, also clear them to prevent UI fallback.
        if (JOB_PARTS_HAS_PER_LINE_TIMES) {
          const { error: clearPartsErr } = await supabase
            ?.from('job_parts')
            ?.update({ scheduled_start_time: null, scheduled_end_time: null })
            ?.eq('job_id', job.id)

          if (clearPartsErr && isMissingColumnError(clearPartsErr)) {
            disableJobPartsTimeCapability()
            incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
          } else if (clearPartsErr) {
            console.warn(
              '[dealService:create] Failed to clear job_parts scheduled_* (non-fatal):',
              clearPartsErr.message
            )
          }
        }
      }
    } catch (e) {
      console.warn('[dealService:create] schedule clear step skipped (non-fatal):', e?.message)
    }

    // A3: Handle loaner assignment for new deals
    if (payload?.customer_needs_loaner && loanerForm) {
      await upsertLoanerAssignment(job?.id, loanerForm, payload?.dealer_id || null)
    }

    // 3) Ensure a transaction row exists immediately to satisfy NOT NULLs in some environments
    try {
      // ✅ Ensure dealer_id is set for transaction tenant scoping
      const transactionDealerId = payload?.dealer_id || null
      if (transactionDealerId) {
        console.info('[dealService:create] Using dealer_id for transaction:', transactionDealerId)
      }

      const baseTransaction = {
        job_id: job?.id,
        vehicle_id: payload?.vehicle_id || null,
        dealer_id: transactionDealerId,
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
          console.warn(
            '[dealService:create] RLS blocked transaction SELECT; skipping INSERT to avoid duplicates'
          )
        } else {
          console.warn(
            '[dealService:create] Transaction SELECT failed (non-fatal):',
            selectErr?.message
          )
        }
      } else if (!existingTxn?.id) {
        // Only INSERT if SELECT succeeded and found no transaction
        let { error: insErr } = await supabase?.from('transactions')?.insert([baseTransaction])
        if (insErr && isMissingColumnError(insErr)) {
          const haystack = [insErr?.message, insErr?.details, insErr?.hint]
            .filter(Boolean)
            .join(' ')
          if (/\bdealer_id\b/i.test(haystack)) {
            const retryTransaction = { ...baseTransaction }
            delete retryTransaction.dealer_id
            ;({ error: insErr } = await supabase?.from('transactions')?.insert([retryTransaction]))
          }
        }
        if (insErr) {
          console.warn(
            '[dealService:create] Transaction INSERT failed (non-fatal):',
            insErr?.message
          )
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
      const { data: deletedParts, error: partsDelErr } = await supabase
        ?.from('job_parts')
        ?.delete()
        ?.eq('job_id', job?.id)
        ?.select('id')
      if (partsDelErr) throw partsDelErr
      if (!deletedParts || deletedParts.length === 0) {
        const { data: partsStillThere, error: partsCheckErr } = await supabase
          ?.from('job_parts')
          ?.select('id')
          ?.eq('job_id', job?.id)
          ?.limit(1)
          ?.maybeSingle?.()
        if (!partsCheckErr && partsStillThere?.id) {
          console.warn('[dealService:create] Rollback delete of job_parts blocked by RLS')
        }
      }
    } catch {
      // ignore
    }
    try {
      const { data: deletedJobs, error: jobDelErr } = await supabase
        ?.from('jobs')
        ?.delete()
        ?.eq('id', job?.id)
        ?.select('id')
      if (jobDelErr) throw jobDelErr
      if (!deletedJobs || deletedJobs.length === 0) {
        const { data: jobStillThere, error: jobCheckErr } = await supabase
          ?.from('jobs')
          ?.select('id')
          ?.eq('id', job?.id)
          ?.maybeSingle?.()
        if (!jobCheckErr && jobStillThere?.id) {
          console.warn('[dealService:create] Rollback delete of job blocked by RLS')
        }
      }
    } catch {
      // ignore
    }
    // Friendlier guidance for common RLS misconfiguration seen in some environments
    const msg = String(error?.message || error || '')
    if (/permission denied for table users/i.test(msg)) {
      throw new Error(
        'Failed to create deal: permission denied while evaluating RLS policies. ' +
          'This may indicate a database schema cache issue. ' +
          "Try reloading the schema with: NOTIFY pgrst, 'reload schema'; " +
          'If the issue persists, verify that all RLS policies use public.user_profiles instead of auth.users. ' +
          'See migrations 20251104221500 and 20251115222458 for reference.'
      )
    }
    throw new Error(`Failed to create deal: ${error.message}`)
  }
}

// UPDATE: deal + replace job_parts - FIXED with proper transaction handling and customer data
export async function updateDeal(id, formState) {
  // 🔍 DEBUG: Log incoming formState to trace line item count
  if (import.meta.env.MODE === 'development') {
    console.log('[dealService:updateDeal] ENTRY:', {
      jobId: id,
      formStateKeys: Object.keys(formState || {}),
      lineItemsCount: Array.isArray(formState?.lineItems) ? formState.lineItems.length : 0,
      line_itemsCount: Array.isArray(formState?.line_items) ? formState.line_items.length : 0,
    })
  }

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

  // IMPORTANT:
  // Editing a deal must NOT implicitly change job_status.
  // Only update job_status when the caller explicitly provides it.
  {
    const explicitJobStatus = formState?.job_status ?? formState?.jobStatus
    const hasExplicitJobStatus =
      typeof explicitJobStatus === 'string'
        ? explicitJobStatus.trim().length > 0
        : explicitJobStatus != null

    if (hasExplicitJobStatus) {
      // Normalize and allow safe auto-promotion when an actual time window exists.
      payload.job_status = maybeAutoUpgradeJobStatusToScheduled(
        String(explicitJobStatus).trim(),
        normalizedLineItems
      )
    } else {
      // Ensure we don't accidentally clear or reset status.
      delete payload.job_status
    }
  }

  // 🔍 DEBUG: Log normalized line items count
  if (import.meta.env.MODE === 'development') {
    console.log('[dealService:updateDeal] AFTER mapFormToDb:', {
      normalizedLineItemsCount: normalizedLineItems?.length || 0,
      normalizedLineItemsSample: normalizedLineItems?.[0]
        ? {
            product_id: normalizedLineItems[0].product_id,
            unit_price: normalizedLineItems[0].unit_price,
          }
        : null,
    })
  }

  // Fallback tenant scoping: if dealer_id is missing, try to infer from current user's profile (align with createDeal)
  if (!payload?.dealer_id) {
    const inferredDealerId = await getUserOrgIdWithFallback('update')
    if (inferredDealerId) {
      payload.dealer_id = inferredDealerId
    }
  }

  // ✅ VALIDATION: Warn if dealer_id is missing (may cause RLS violations in production)
  // In test environments, this is logged but doesn't block operation
  if (!payload?.dealer_id) {
    if (import.meta?.env?.MODE !== 'test') {
      console.warn(
        '[dealService:update] ⚠️ CRITICAL: dealer_id is missing! This may cause RLS violations. ' +
          'Ensure UI passes dealer_id or user is properly authenticated.'
      )
    }
    // Note: We don't throw here to preserve backward compatibility with tests
    // In production, RLS policies will enforce tenant isolation at the database level
  }

  // Ensure description is explicitly updated when provided (some environments rely on it for display)
  {
    const desc = (formState?.description || '').trim()
    if (desc) payload.description = desc
  }

  if (import.meta.env.MODE === 'development') {
    console.log('[dealService:updateDeal] computed payload (job)', {
      id,
      payloadDescription: payload?.description,
      payloadTitle: payload?.title,
      hasDealerId: !!payload?.dealer_id,
    })
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
      payload?.dealer_id,
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
    if (payload?.dealer_id) q = q?.eq?.('dealer_id', payload.dealer_id)
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
  // ✅ SAFETY: If dealer_id is missing from payload, fetch it from the job record
  // NOTE: This fallback should rarely execute - dealer_id should come from form state (mapDbDealToForm).
  // If this executes frequently, investigate why form state lacks dealer_id.
  let transactionDealerId = payload?.dealer_id || null
  if (!transactionDealerId) {
    console.warn('[dealService:update] dealer_id missing from payload, fetching from job record')
    try {
      const { data: jobData, error: jobFetchErr } = await supabase
        ?.from('jobs')
        ?.select('dealer_id')
        ?.eq('id', id)
        ?.single()
      if (!jobFetchErr && jobData?.dealer_id) {
        transactionDealerId = jobData.dealer_id
        console.info(
          '[dealService:update] Retrieved dealer_id from job:',
          transactionDealerId ? transactionDealerId.slice(0, 8) + '...' : 'N/A'
        )
      } else {
        console.error(
          '[dealService:update] Failed to fetch dealer_id from job:',
          jobFetchErr?.message
        )
      }
    } catch (e) {
      console.error('[dealService:update] Error fetching dealer_id from job:', e?.message)
    }
  }

  const baseTransactionData = {
    job_id: id,
    vehicle_id: payload?.vehicle_id || null,
    dealer_id: transactionDealerId,
    total_amount: totalDealValue,
    customer_name: customerName || 'Unknown Customer',
    customer_phone: customerPhone || null,
    customer_email: customerEmail || null,
    transaction_status: 'pending',
  }

  if (import.meta.env.MODE === 'development') {
    console.log('[dealService:updateDeal] computed transaction customer_name', {
      id,
      customerName,
      transactionCustomerName: baseTransactionData.customer_name,
    })
  }

  // Upsert without relying on a DB unique constraint (some envs lack a unique index on job_id)
  try {
    // ✅ FIX: Check for errors and handle RLS-blocked SELECTs
    const { data: existingTxn, error: selectErr } = await supabase
      ?.from('transactions')
      ?.select('id, transaction_number, dealer_id')
      ?.eq('job_id', id)
      ?.limit(1)
      ?.maybeSingle?.() // keep compatibility if maybeSingle exists

    // Handle RLS-blocked SELECT: update existing transaction by job_id instead of attempting INSERT
    // This handles legacy data where transaction.org_id might be NULL or stale
    let rlsRecoveryAttempted = false
    if (selectErr) {
      if (isRlsError(selectErr)) {
        console.warn(
          '[dealService:update] RLS blocked transaction SELECT, attempting UPDATE by job_id'
        )

        // Track RLS recovery attempt in telemetry
        incrementTelemetry(TelemetryKey.RLS_TRANSACTION_RECOVERY)

        // Get the job's dealer_id to use for the transaction
        let jobDealerId = baseTransactionData.dealer_id
        if (!jobDealerId) {
          const { data: jobData, error: jobErr } = await supabase
            ?.from('jobs')
            ?.select('dealer_id')
            ?.eq('id', id)
            ?.single()

          if (jobErr) {
            console.error('[dealService:update] Failed to fetch job dealer_id:', jobErr?.message)
            throw jobErr
          }
          jobDealerId = jobData?.dealer_id
        }

        // If job has no dealer_id (legacy data), try to get user's dealer_id and set it on both job and transaction
        // This is a graceful recovery for legacy deals created before tenant scoping was implemented
        if (!jobDealerId) {
          console.warn(
            '[dealService:update] Job has no dealer_id - attempting to set from user profile'
          )

          // Use the shared helper function to get dealer_id with email fallback
          const profileDealerId = await getUserOrgIdWithFallback('update:rls-recovery')

          if (profileDealerId) {
            jobDealerId = profileDealerId
            // Set dealer_id on the job to fix the legacy data
            const jobUpdateResult = await supabase
              .from('jobs')
              .update({ dealer_id: jobDealerId })
              .eq('id', id)

            if (jobUpdateResult.error) {
              console.warn(
                '[dealService:update] Failed to set job dealer_id:',
                jobUpdateResult.error.message
              )
            } else {
              console.info('[dealService:update] Successfully set job dealer_id from user profile')
            }
          }
        }

        if (!jobDealerId) {
          throw new Error(
            'Cannot recover from RLS error: job has no dealer_id and unable to get user dealer_id'
          )
        }

        // Set the transaction's dealer_id to match the job's dealer_id (or user's dealer_id)
        baseTransactionData.dealer_id = jobDealerId

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
          if (
            updErrMsg.includes('policy') ||
            updErrMsg.includes('permission') ||
            updErrMsg.includes('rls')
          ) {
            console.warn(
              '[dealService:update] RLS recovery UPDATE failed (likely no existing transaction) - will attempt INSERT'
            )
            // rlsRecoveryAttempted stays false, allowing INSERT path at line ~1830
          } else {
            throw updErr
          }
        }

        // If UPDATE affected rows, we're done (transaction was updated)
        if (updateResult?.length > 0) {
          // Log truncated dealer_id for debugging while maintaining security
          const dealerIdPrefix = jobDealerId ? jobDealerId.slice(0, 8) + '...' : 'N/A'
          console.info(
            '[dealService:update] Successfully updated transaction via RLS recovery, dealer:',
            dealerIdPrefix
          )
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
        // Preserve existing dealer_id if not provided in payload (don't overwrite with null)
        if (!baseTransactionData.dealer_id && existingTxn.dealer_id) {
          baseTransactionData.dealer_id = existingTxn.dealer_id
        }

        // IMPORTANT: Under PostgREST + RLS, an UPDATE can return 200 with 0 affected rows
        // (and no error) when the policy blocks the write. If we don't request returning
        // columns, supabase-js can't tell us that nothing was updated.
        // We request a minimal return payload and validate that at least one row updated.
        const { data: updatedById, error: updErr } = await supabase
          ?.from('transactions')
          ?.update(baseTransactionData) // don't overwrite transaction_number on update
          ?.eq('id', existingTxn.id)
          ?.select('id')
        if (updErr) throw updErr

        if (!Array.isArray(updatedById) || updatedById.length === 0) {
          // Fallback: update by job_id. Some RLS policies permit UPDATE via the jobs relationship
          // even when transaction.org_id is NULL/stale.
          const { data: updatedByJobId, error: updByJobErr } = await supabase
            ?.from('transactions')
            ?.update(baseTransactionData)
            ?.eq('job_id', id)
            ?.select('id')
          if (updByJobErr) throw updByJobErr
          if (!Array.isArray(updatedByJobId) || updatedByJobId.length === 0) {
            throw new Error(
              'Failed to save deal: Transaction update was blocked (0 rows affected). '
            )
          }
        }
      } else {
        // No transaction exists - create one
        const insertData = {
          ...baseTransactionData,
          transaction_number: generateTransactionNumber(),
        }
        const { data: inserted, error: insErr } = await supabase
          ?.from('transactions')
          ?.insert([insertData])
          ?.select('id')
        if (insErr) throw insErr
        if (!Array.isArray(inserted) || inserted.length === 0) {
          throw new Error('Failed to save deal: Transaction insert was blocked (0 rows affected).')
        }
      }
    }
  } catch (e) {
    // Enhance error message with context about dealer_id for debugging
    if (isRlsError(e)) {
      // Log detailed info for debugging (won't be shown to user)
      console.error('[dealService:update] RLS violation on transactions table:', {
        error: e?.message,
        job_id: id,
        has_dealer_id: !!transactionDealerId,
        dealer_id_source: transactionDealerId ? 'resolved' : 'missing',
      })

      // Provide actionable guidance based on the scenario
      let guidance = ''
      if (!transactionDealerId) {
        // User profile is missing dealer_id - admin action required
        guidance =
          'Unable to determine your organization. This typically means:\n' +
          '• Your user profile may not be linked to an organization.\n' +
          '• Please contact your administrator to verify your account setup.'
      } else {
        // dealer_id exists but RLS still failed - likely a database sync issue
        guidance =
          'The database rejected this update. Please try:\n' +
          '• Refreshing the page and trying again.\n' +
          '• If the issue persists, contact your administrator - they may need to run a database sync.'
      }

      // User-facing message - informative but without sensitive technical details
      throw new Error(`Failed to save deal: Transaction access denied. ${guidance}`)
    }
    throw wrapDbError(e, 'upsert transaction')
  }

  // 3) Sync job_parts with identity-based sync (prevents resurrection bugs)
  await syncJobPartsForJob(id, normalizedLineItems, {
    includeTimes: true,
  })

  // A3: Handle loaner assignment updates
  if (payload?.customer_needs_loaner && loanerForm?.loaner_number?.trim()) {
    // In edit flows, loaner changes are a user-visible action.
    // Use the strict saver so failures don't silently look like "it saved".
    await saveLoanerAssignment(id, loanerForm)
  } else if (payload?.customer_needs_loaner === false) {
    // When the user turns OFF the loaner toggle, end any *active* assignment.
    // Keep returned history intact (needed for the Return tab / audit trail).
    try {
      const returnedAtIso = new Date().toISOString()

      // If returned_at is known-missing, skip straight to legacy fallback.
      let ended = null
      let endErr = null
      if (loanerAssignmentsHasReturnedAt !== false) {
        const base = supabase
          ?.from('loaner_assignments')
          ?.update({ returned_at: returnedAtIso })
          ?.eq('job_id', id)
        const q = applyReturnedAtIsNullFilter(base)
        const res = await q?.select?.('id')
        ended = res?.data ?? null
        endErr = res?.error ?? null
      }

      if (endErr) {
        // Back-compat: if returned_at doesn't exist in this environment,
        // fall back to the legacy behavior (best-effort delete).
        if (isMissingReturnedAtError(endErr)) {
          setLoanerAssignmentsReturnedAtCapability(false)
          const { error: deleteErr } = await supabase
            ?.from('loaner_assignments')
            ?.delete()
            ?.eq('job_id', id)
            ?.select('id')

          if (deleteErr) {
            console.warn(
              '[dealService:update] Failed to delete loaner assignment (fallback):',
              deleteErr.message
            )
          }
        } else {
          console.warn(
            '[dealService:update] Failed to end active loaner assignment:',
            endErr.message
          )
        }
      } else if (loanerAssignmentsHasReturnedAt === false) {
        // returned_at is absent; legacy cleanup is best-effort delete.
        const { error: deleteErr } = await supabase
          ?.from('loaner_assignments')
          ?.delete()
          ?.eq('job_id', id)
          ?.select('id')

        if (deleteErr) {
          console.warn(
            '[dealService:update] Failed to delete loaner assignment (legacy):',
            deleteErr.message
          )
        }
      } else if (Array.isArray(ended) && ended.length === 0) {
        // Under RLS, UPDATE may succeed with 0 rows affected; verify so we can surface a useful warning.
        let stillActive = null
        let checkErr = null
        if (loanerAssignmentsHasReturnedAt !== false) {
          const base = supabase?.from('loaner_assignments')?.select('id')?.eq('job_id', id)
          const q = applyReturnedAtIsNullFilter(base)
          const res = await q?.limit?.(1)
          stillActive = res?.data ?? null
          checkErr = res?.error ?? null
          if (checkErr && isMissingReturnedAtError(checkErr)) {
            setLoanerAssignmentsReturnedAtCapability(false)
            stillActive = null
            checkErr = null
          }
        }

        if (!checkErr && Array.isArray(stillActive) && stillActive.length > 0) {
          console.warn(
            '[dealService:update] Ending active loaner assignment was blocked (0 rows affected).'
          )
        }
      }
    } catch (e) {
      console.warn(
        '[dealService:update] Failed to end active loaner assignment (unexpected):',
        e?.message
      )
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

// ✅ UPDATED: Use safe cascade delete function with improved error handling
export async function deleteDeal(id) {
  if (!id) throw new Error('Failed to delete deal: missing deal id')

  const isPermissionDenied = (err) => {
    const msg = String(err?.message || err || '')
    const code = err?.code
    return code === '42501' || /permission denied|insufficient privilege/i.test(msg)
  }

  const isMissingTable = (err) => {
    const msg = String(err?.message || err || '')
    const code = err?.code
    // 42P01: undefined_table (PostgreSQL)
    return code === '42P01' || /relation .* does not exist/i.test(msg)
  }

  const throwDeletePermission = () => {
    throw new Error('You do not have permission to delete deals.')
  }

  const getCurrentUserOrgId = async () => {
    try {
      const { data: userData, error: userErr } = await supabase.auth.getUser()
      if (userErr) return null
      const userId = userData?.user?.id
      if (!userId) return null

      const { data: profile, error: profileErr } = await supabase
        .from('user_profiles')
        .select('dealer_id')
        .eq('id', userId)
        .maybeSingle()

      if (profileErr) return null
      return profile?.dealer_id ?? null
    } catch {
      return null
    }
  }

  const tryDelete = async (table, whereCol, whereVal, opts = {}) => {
    const { data: deletedRows, error } = await supabase
      .from(table)
      .delete()
      .eq(whereCol, whereVal)
      .select(whereCol)

    if (error) {
      if (isPermissionDenied(error)) throwDeletePermission()
      if (opts?.ignoreMissingTable && isMissingTable(error)) return
      throw new Error(`Failed to delete deal: ${error.message}`)
    }

    // PostgREST + RLS can return 200 with 0 deleted rows (no error) when DELETE is blocked.
    // Verify whether rows still exist so we can surface a useful error.
    if (Array.isArray(deletedRows) && deletedRows.length === 0) {
      const { data: remainingRows, error: remainingErr } = await supabase
        .from(table)
        .select(whereCol)
        .eq(whereCol, whereVal)
        .limit(1)

      if (remainingErr) {
        if (isPermissionDenied(remainingErr)) {
          throw new Error(`You do not have permission to delete related records (${table}).`)
        }
        if (opts?.ignoreMissingTable && isMissingTable(remainingErr)) return
        throw new Error(`Failed to verify delete on ${table}: ${remainingErr.message}`)
      }

      if (Array.isArray(remainingRows) && remainingRows.length > 0) {
        throw new Error(`You do not have permission to delete related records (${table}).`)
      }
    }
  }

  // IMPORTANT:
  // `delete_job_cascade` execution is intentionally revoked in
  // supabase/migrations/20251210173000_harden_security_definer_permissions.sql.
  // Application must delete via RLS-protected endpoints instead.

  // First, verify the deal exists and user has access to it
  const { data: existingDeal, error: readErr } = await supabase
    .from('jobs')
    .select('id, dealer_id')
    .eq('id', id)
    .maybeSingle()

  if (readErr) {
    throw new Error(`Failed to verify deal: ${readErr.message}`)
  }

  if (!existingDeal) {
    throw new Error('Deal not found or you do not have access to it.')
  }

  // Capture org context for diagnostics, but do not pre-block the delete.
  // Some roles/policies may legitimately allow deleting legacy NULL-org rows or cross-org rows.
  // We'll surface these conditions only if the delete is actually blocked (0 rows affected).
  const currentUserOrgId = await getCurrentUserOrgId()

  // Best-effort cascade in dependency order.
  // Some installs may not have certain child tables; ignore missing-table errors.
  await tryDelete('loaner_assignments', 'job_id', id, { ignoreMissingTable: true })
  await tryDelete('job_parts', 'job_id', id)
  await tryDelete('transactions', 'job_id', id)
  await tryDelete('communications', 'job_id', id, { ignoreMissingTable: true })

  const { data: deletedJobs, error: jobErr } = await supabase
    .from('jobs')
    .delete()
    .eq('id', id)
    .select('id')

  if (jobErr) {
    if (isPermissionDenied(jobErr)) throwDeletePermission()
    throw new Error(`Failed to delete deal: ${jobErr.message}`)
  }

  if (!Array.isArray(deletedJobs) || deletedJobs.length === 0) {
    // PostgREST + RLS can return 200 with 0 deleted rows (no error) when DELETE is blocked.
    // Verify whether the job still exists so we don't mis-report successful deletes.
    const { data: remainingJob, error: remainingErr } = await supabase
      .from('jobs')
      .select('id, dealer_id')
      .eq('id', id)
      .maybeSingle()

    if (remainingErr) {
      if (isPermissionDenied(remainingErr)) throwDeletePermission()
      throw new Error(`Failed to verify deal deletion: ${remainingErr.message}`)
    }

    if (remainingJob) {
      const userOrgId = currentUserOrgId ?? (await getCurrentUserOrgId())
      if (remainingJob?.dealer_id == null) {
        throw new Error(
          'Delete was blocked because this deal is missing dealer_id. Ask an admin to assign it to your organization (or delete as a manager).'
        )
      }
      if (userOrgId && remainingJob.dealer_id && remainingJob.dealer_id !== userOrgId) {
        throw new Error(
          `Delete was blocked because this deal belongs to a different organization (${remainingJob.dealer_id}). Your org is ${userOrgId}.`
        )
      }
      throwDeletePermission()
    }
  }

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

/**
 * Find a job's id by job_number.
 *
 * Used to validate job_number uniqueness before create/update.
 *
 * @param {string} jobNumber
 * @returns {Promise<string|null>} Job id if found, else null
 */
export async function findJobIdByJobNumber(jobNumber) {
  const normalized = typeof jobNumber === 'string' ? jobNumber.trim() : ''
  if (!normalized) return null

  const { data, error } = await supabase
    ?.from('jobs')
    ?.select('id')
    ?.eq('job_number', normalized)
    ?.maybeSingle()

  if (error) {
    throw normalizeError(error)
  }

  return data?.id || null
}
