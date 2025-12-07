/**
 * Centralized service for managing job_parts table writes
 * 
 * This module provides a single source of truth for writing job_parts data,
 * preventing duplication bugs by ensuring DELETE + INSERT happens exactly once
 * per save operation.
 */

import { supabase } from '../lib/supabase'
import {
  JOB_PARTS_HAS_PER_LINE_TIMES,
  JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE,
  disableJobPartsVendorIdCapability,
  disableJobPartsTimeCapability,
  incrementTelemetry,
  TelemetryKey,
} from '../utils/capabilityTelemetry'

/**
 * Helper to detect missing column errors from Supabase
 */
function isMissingColumnError(error) {
  if (!error) return false
  const msg = String(error?.message || '').toLowerCase()
  return (
    msg.includes('column') &&
    (msg.includes('does not exist') ||
      msg.includes('not found') ||
      msg.includes('could not find'))
  )
}

/**
 * Classify schema-related errors
 */
function classifySchemaError(error) {
  const msg = String(error?.message || '').toLowerCase()
  if (msg.includes('column') && (msg.includes('does not exist') || msg.includes('not found'))) {
    return 'MISSING_COLUMN'
  }
  if (msg.includes('relation') && msg.includes('does not exist')) {
    return 'MISSING_TABLE'
  }
  return 'UNKNOWN_SCHEMA_ERROR'
}

/**
 * Convert line items to job_parts row format
 * Handles both camelCase and snake_case field names for robustness
 */
function toJobPartRows(jobId, items = [], opts = {}) {
  const includeTimes = opts?.includeTimes ?? JOB_PARTS_HAS_PER_LINE_TIMES

  const rows = (items || [])
    ?.map((it) => {
      const row = {
        job_id: jobId,
        product_id: it?.product_id ?? null,
        ...(JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE
          ? { vendor_id: it?.vendor_id ?? it?.vendorId ?? null }
          : {}),
        quantity_used: it?.quantity_used ?? it?.quantity ?? 1,
        unit_price: it?.unit_price ?? it?.price ?? 0,
        promised_date:
          it?.lineItemPromisedDate ||
          it?.promised_date ||
          (it?.requiresScheduling || it?.requires_scheduling
            ? new Date().toISOString().slice(0, 10)
            : null),
        requires_scheduling: !!(it?.requiresScheduling ?? it?.requires_scheduling),
        no_schedule_reason:
          it?.requiresScheduling ?? it?.requires_scheduling
            ? null
            : it?.noScheduleReason || it?.no_schedule_reason || null,
        is_off_site: !!(it?.isOffSite ?? it?.is_off_site),
      }

      if (includeTimes) {
        row.scheduled_start_time =
          it?.scheduledStartTime || it?.scheduled_start_time || null
        row.scheduled_end_time = it?.scheduledEndTime || it?.scheduled_end_time || null
      }

      return row
    })
    ?.filter((row) => row?.product_id !== null || row?.quantity_used || row?.unit_price)

  // Detect potential duplicates in development
  if (import.meta.env.MODE === 'development' && rows?.length > 0) {
    const productIds = rows.map((r) => r.product_id).filter(Boolean)
    const uniqueProductIds = new Set(productIds)
    if (productIds.length !== uniqueProductIds.size) {
      console.warn('[replaceJobPartsForJob] ⚠️ DUPLICATE DETECTION: Multiple rows have the same product_id!', {
        totalRows: rows.length,
        uniqueProducts: uniqueProductIds.size,
        productIds,
      })
    }
  }

  return rows
}

/**
 * Replace all job_parts for a given job with new parts
 * 
 * This is the ONLY function that should directly write to job_parts table.
 * It ensures atomicity: DELETE all existing parts, then INSERT new ones.
 * 
 * @param {string} jobId - The job ID to update parts for
 * @param {Array} lineItems - Array of line item objects to convert to job_parts
 * @param {Object} opts - Options: { includeTimes: boolean }
 * @returns {Promise<void>}
 * @throws {Error} If DELETE or INSERT fails
 */
export async function replaceJobPartsForJob(jobId, lineItems = [], opts = {}) {
  if (!jobId) {
    throw new Error('jobId is required for replaceJobPartsForJob')
  }

  if (import.meta.env.MODE === 'development') {
    console.log('[replaceJobPartsForJob] Starting replacement:', {
      jobId: jobId.slice(0, 8) + '...',
      lineItemsCount: lineItems?.length || 0,
    })
  }

  // Step 1: DELETE all existing job_parts for this job
  const { error: delErr } = await supabase?.from('job_parts')?.delete()?.eq('job_id', jobId)
  if (delErr) {
    console.error('[replaceJobPartsForJob] DELETE failed:', delErr)
    throw new Error(`Failed to delete existing job_parts: ${delErr?.message}`)
  }

  if (import.meta.env.MODE === 'development') {
    console.log('[replaceJobPartsForJob] DELETE successful')
  }

  // Step 2: INSERT new job_parts if any
  if ((lineItems || []).length === 0) {
    if (import.meta.env.MODE === 'development') {
      console.log('[replaceJobPartsForJob] No line items to insert, done')
    }
    return
  }

  const rows = toJobPartRows(jobId, lineItems, opts)

  if (!rows || rows.length === 0) {
    if (import.meta.env.MODE === 'development') {
      console.log('[replaceJobPartsForJob] No valid rows after transformation, done')
    }
    return
  }

  if (import.meta.env.MODE === 'development') {
    console.log('[replaceJobPartsForJob] Attempting INSERT:', {
      rowsCount: rows.length,
      sample: rows[0]
        ? {
            product_id: rows[0].product_id,
            unit_price: rows[0].unit_price,
          }
        : null,
    })
  }

  // Try INSERT with retry logic for missing columns
  const { error: insErr } = await supabase?.from('job_parts')?.insert(rows)

  if (insErr) {
    // Handle missing column errors with retry
    if (isMissingColumnError(insErr)) {
      const errorCode = classifySchemaError(insErr)
      const lower = String(insErr?.message || '').toLowerCase()

      // Missing vendor_id column - retry without it
      if (lower.includes('job_parts') && lower.includes('vendor_id')) {
        if (JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
          console.warn(
            `[replaceJobPartsForJob] ${errorCode}: vendor_id column missing, retrying without it`
          )
          disableJobPartsVendorIdCapability()
          incrementTelemetry?.(TelemetryKey?.VENDOR_ID_FALLBACK)

          const retryRows = toJobPartRows(jobId, lineItems, opts)
          const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)
          if (retryErr) {
            console.error('[replaceJobPartsForJob] Retry INSERT failed:', retryErr)
            throw new Error(`Failed to insert job_parts (retry): ${retryErr?.message}`)
          }

          if (import.meta.env.MODE === 'development') {
            console.log('[replaceJobPartsForJob] Retry INSERT successful')
          }
          return
        }
      }
      // Missing scheduled time columns - retry without them
      else if (
        lower.includes('job_parts') &&
        (lower.includes('scheduled_start_time') || lower.includes('scheduled_end_time'))
      ) {
        console.warn(
          `[replaceJobPartsForJob] ${errorCode}: scheduled time columns missing, retrying without them`
        )
        disableJobPartsTimeCapability()
        incrementTelemetry?.(TelemetryKey?.SCHEDULED_TIMES_FALLBACK)

        const retryRows = toJobPartRows(jobId, lineItems, { ...opts, includeTimes: false })
        const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)
        if (retryErr) {
          console.error('[replaceJobPartsForJob] Retry INSERT failed:', retryErr)
          throw new Error(`Failed to insert job_parts (retry): ${retryErr?.message}`)
        }

        if (import.meta.env.MODE === 'development') {
          console.log('[replaceJobPartsForJob] Retry INSERT successful')
        }
        return
      }
    }

    // Other errors - throw immediately
    console.error('[replaceJobPartsForJob] INSERT failed:', insErr)
    throw new Error(`Failed to insert job_parts: ${insErr?.message}`)
  }

  if (import.meta.env.MODE === 'development') {
    console.log('[replaceJobPartsForJob] INSERT successful, completed')
  }
}

/**
 * Export helper for testing/compatibility
 */
export { toJobPartRows }
