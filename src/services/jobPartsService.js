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
import { z } from 'zod'
import { jobPartInsertSchema } from '@/db/schemas'

const VENDOR_PLACEHOLDER_UUID = '00000000-0000-0000-0000-000000000000'
const TIME_PLACEHOLDER = '1970-01-01 00:00:00+00'

function normalizeTime(value) {
  if (!value) return null
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'string') {
    const str = value.trim()
    return str || null
  }
  return null
}

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
 * Normalize, filter, and deduplicate job_parts payload
 * 
 * @param {string} jobId
 * @param {Array} lineItems
 * @param {{ includeTimes?: boolean, includeVendor?: boolean }} opts
 * @returns {Array}
 */
export function buildJobPartsPayload(jobId, lineItems = [], opts = {}) {
  const includeTimes = opts?.includeTimes ?? JOB_PARTS_HAS_PER_LINE_TIMES
  const includeVendor = opts?.includeVendor ?? JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE

  const records =
    lineItems
      ?.filter(Boolean)
      ?.map((item) => {
        const productId = item?.product_id ?? item?.productId ?? null
        if (!productId) return null

        const requiresScheduling = !!(
          item?.requires_scheduling ??
          item?.requiresScheduling ??
          item?.scheduled_start_time ??
          item?.scheduledStartTime ??
          item?.scheduled_end_time ??
          item?.scheduledEndTime
        )
        const quantityRaw = Number(item?.quantity_used ?? item?.quantity ?? item?.quantityUsed ?? 1)
        const unitPriceRaw = Number(item?.unit_price ?? item?.price ?? item?.unitPrice ?? 0)

        const record = {
          job_id: jobId,
          product_id: productId,
          quantity_used: Number.isFinite(quantityRaw) ? quantityRaw : 1,
          unit_price: Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0,
          // Support legacy dateScheduled/lineItemPromisedDate fallbacks
          promised_date:
            item?.promised_date ?? item?.lineItemPromisedDate ?? item?.dateScheduled ?? null,
          requires_scheduling: requiresScheduling,
          no_schedule_reason: requiresScheduling
            ? null
            : item?.no_schedule_reason ?? item?.noScheduleReason ?? null,
          is_off_site: !!(item?.is_off_site ?? item?.isOffSite),
        }

        if (includeVendor) {
          const vendorId = item?.vendor_id ?? item?.vendorId ?? null
          record.vendor_id = vendorId && String(vendorId).trim() ? vendorId : null
        }

        if (includeTimes) {
          const start = normalizeTime(item?.scheduled_start_time ?? item?.scheduledStartTime ?? null)
          const end = normalizeTime(item?.scheduled_end_time ?? item?.scheduledEndTime ?? null)
          record.scheduled_start_time = requiresScheduling ? start : null
          record.scheduled_end_time = requiresScheduling ? end : null
        }

        return record
      })
      ?.filter(Boolean) || []

  const uniqueRecords = []
  const dedupeMap = new Map()

  for (const record of records) {
    const keyParts = [
      record.job_id,
      record.product_id,
      includeVendor ? record.vendor_id ?? VENDOR_PLACEHOLDER_UUID : VENDOR_PLACEHOLDER_UUID,
      includeTimes ? record.scheduled_start_time ?? TIME_PLACEHOLDER : TIME_PLACEHOLDER,
      includeTimes ? record.scheduled_end_time ?? TIME_PLACEHOLDER : TIME_PLACEHOLDER,
    ]
    const key = keyParts.join('|')
    dedupeMap.set(key, record) // last occurrence wins
  }

  dedupeMap.forEach((value) => uniqueRecords.push(value))

  return uniqueRecords
}

/**
 * Normalize and deduplicate job_parts rows
 * 
 * Takes raw line items and merges duplicates based on a composite key:
 * - product_id
 * - vendor_id (if available)
 * - scheduled_start_time (if available)
 * - scheduled_end_time (if available)
 * 
 * Duplicates are merged by summing quantity_used and keeping the first occurrence's other fields.
 * 
 * @param {Array} rows - Raw job_parts rows (already transformed to DB shape)
 * @param {Object} opts - Options: { includeTimes: boolean }
 * @returns {Array} - Deduplicated rows
 */
function normalizeAndDedupeJobPartRows(rows = [], opts = {}) {
  if (!rows || rows.length === 0) return []

  const includeTimes = opts?.includeTimes ?? JOB_PARTS_HAS_PER_LINE_TIMES
  const includeVendor = JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE

  // Build a map keyed by composite identifier
  const dedupeMap = new Map()

  for (const row of rows) {
    // Build composite key from fields that define "the same line"
    const keyParts = [
      row.product_id || 'null',
      includeVendor ? (row.vendor_id || 'null') : '',
      includeTimes ? (row.scheduled_start_time || 'null') : '',
      includeTimes ? (row.scheduled_end_time || 'null') : '',
    ]
    const compositeKey = keyParts.join('|')

    if (dedupeMap.has(compositeKey)) {
      // Duplicate found - merge by summing quantity_used
      const existing = dedupeMap.get(compositeKey)
      existing.quantity_used = (existing.quantity_used || 0) + (row.quantity_used || 0)

      if (import.meta.env.MODE === 'development') {
        console.warn(
          '[normalizeAndDedupeJobPartRows] Merged duplicate line item:',
          {
            product_id: row.product_id,
            vendor_id: row.vendor_id,
            scheduled_start_time: row.scheduled_start_time,
            scheduled_end_time: row.scheduled_end_time,
            old_quantity: existing.quantity_used - (row.quantity_used || 0),
            added_quantity: row.quantity_used,
            new_quantity: existing.quantity_used,
          }
        )
      }
    } else {
      // First occurrence - add to map
      dedupeMap.set(compositeKey, { ...row })
    }
  }

  const dedupedRows = Array.from(dedupeMap.values())

  if (import.meta.env.MODE === 'development' && rows.length !== dedupedRows.length) {
    console.log(
      `[normalizeAndDedupeJobPartRows] Deduplication: ${rows.length} rows → ${dedupedRows.length} rows (${rows.length - dedupedRows.length} duplicates merged)`
    )
  }

  return dedupedRows
}

/**
 * Convert line items to job_parts row format
 * Handles both camelCase and snake_case field names for robustness
 */
function toJobPartRows(jobId, items = [], opts = {}) {
  const includeTimes = opts?.includeTimes ?? JOB_PARTS_HAS_PER_LINE_TIMES
  const includeVendor = opts?.includeVendor ?? JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE

  const rows = (items || [])
    ?.map((it) => {
      const row = {
        job_id: jobId,
        product_id: it?.product_id ?? null,
        ...(includeVendor ? { vendor_id: it?.vendor_id ?? it?.vendorId ?? null } : {}),
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

  let includeTimes = opts?.includeTimes ?? JOB_PARTS_HAS_PER_LINE_TIMES
  let includeVendor = opts?.includeVendor ?? JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE

  let rows = buildJobPartsPayload(jobId, lineItems, { includeTimes, includeVendor })

  if (!rows || rows.length === 0) {
    if (import.meta.env.MODE === 'development') {
      console.log('[replaceJobPartsForJob] No valid rows after normalization/deduplication, done')
    }
    return
  }

  if (import.meta.env.MODE === 'development') {
    console.log('🧩 job_parts payload for save', {
      jobId: jobId.slice(0, 8) + '...',
      payloadCount: rows.length,
      jobPartsPayload: rows,
    })
  }

  // Try INSERT with retry logic for missing columns
  const { error: insErr } = await supabase?.from('job_parts')?.insert(rows)?.select()

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

          includeVendor = false
          const retryRows = buildJobPartsPayload(jobId, lineItems, { includeTimes, includeVendor })

          if (import.meta.env.MODE === 'development') {
            console.log('🧩 job_parts payload retry without vendor_id', {
              jobId: jobId.slice(0, 8) + '...',
              payloadCount: retryRows.length,
              jobPartsPayload: retryRows,
            })
          }

          const { error: retryErr } = await supabase
            ?.from('job_parts')
            ?.insert(retryRows)
            ?.select()
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

        includeTimes = false
        const retryRows = buildJobPartsPayload(jobId, lineItems, { includeTimes, includeVendor })

        if (import.meta.env.MODE === 'development') {
          console.log('🧩 job_parts payload retry without scheduled times', {
            jobId: jobId.slice(0, 8) + '...',
            payloadCount: retryRows.length,
            jobPartsPayload: retryRows,
          })
        }

        const { error: retryErr } = await supabase?.from('job_parts')?.insert(retryRows)?.select()
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

/**
 * Typed job parts creation (Section 20 pattern)
 * @param {import('@/db/schemas').JobPartInsert[]} jobParts - Array of typed job part data
 * @returns {Promise<{data: any, error: any}>}
 */
export async function createJobPartsTyped(jobParts) {
  try {
    // Validate each part with Zod schema
    const validated = jobParts.map((part) => jobPartInsertSchema.parse(part))
    
    const { data, error } = await supabase
      .from('job_parts')
      .insert(validated)
      .select()
    
    return { data, error }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return { 
        data: null, 
        error: { 
          message: 'Validation failed: ' + e.errors.map(err => err.message).join(', '),
          details: e.errors 
        }
      }
    }
    console.error('createJobPartsTyped failed', e)
    return { data: null, error: e }
  }
}
