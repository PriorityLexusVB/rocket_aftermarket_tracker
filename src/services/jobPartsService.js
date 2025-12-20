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
  const stripZeroMs = (iso) => (typeof iso === 'string' ? iso.replace(/\.000Z$/, 'Z') : iso)

  if (value instanceof Date) return stripZeroMs(value.toISOString())
  if (typeof value === 'string') {
    const str = value.trim()
    if (!str) return null

    // Canonicalize common timestamp formats so dedupe keys match Postgres casting.
    // Examples seen in the wild:
    // - 2025-12-15T15:04:00.000Z
    // - 2025-12-15T10:04:00-05:00
    // - 2025-12-15 15:04:00+00
    let candidate = str

    // Convert Postgres-style "YYYY-MM-DD HH:MM:SS" to ISO-ish "YYYY-MM-DDTHH:MM:SS"
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(candidate)) {
      candidate = candidate.replace(' ', 'T')
    }

    // Normalize timezone offsets:
    // - +HH   -> +HH:00
    // - +HHMM -> +HH:MM
    // - -HH   -> -HH:00
    // - -HHMM -> -HH:MM
    if (/([+-]\d{2})$/.test(candidate)) {
      candidate = `${candidate}:00`
    } else if (/([+-]\d{4})$/.test(candidate)) {
      candidate = candidate.replace(/([+-]\d{2})(\d{2})$/, '$1:$2')
    }

    const parsed = Date.parse(candidate)
    if (!Number.isNaN(parsed)) {
      return stripZeroMs(new Date(parsed).toISOString())
    }

    // Fallback: keep original string if we can't parse reliably
    return str
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
    (msg.includes('does not exist') || msg.includes('not found') || msg.includes('could not find'))
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

function isUniqueViolationError(error) {
  if (!error) return false
  const code = String(error?.code || '')
  const msg = String(error?.message || '').toLowerCase()
  return (
    code === '23505' ||
    msg.includes('duplicate key value') ||
    msg.includes('unique constraint') ||
    msg.includes('violates unique')
  )
}

async function updateExistingJobParts(jobId, rows = [], opts = {}) {
  const includeTimes = opts?.includeTimes ?? JOB_PARTS_HAS_PER_LINE_TIMES
  const includeVendor = opts?.includeVendor ?? JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE

  for (const row of rows) {
    let query = supabase?.from('job_parts')?.update({
      quantity_used: row.quantity_used,
      unit_price: row.unit_price,
      promised_date: row.promised_date,
      requires_scheduling: row.requires_scheduling,
      no_schedule_reason: row.no_schedule_reason,
      is_off_site: row.is_off_site,
      ...(includeTimes
        ? {
            scheduled_start_time: row.scheduled_start_time,
            scheduled_end_time: row.scheduled_end_time,
          }
        : {}),
      ...(includeVendor ? { vendor_id: row.vendor_id } : {}),
    })

    query = query.eq('job_id', jobId).eq('product_id', row.product_id)

    if (row.promised_date) {
      query = query.eq('promised_date', row.promised_date)
    } else {
      query = query.is('promised_date', null)
    }

    if (includeVendor) {
      query = row.vendor_id ? query.eq('vendor_id', row.vendor_id) : query.is('vendor_id', null)
    }

    if (includeTimes) {
      query = row.scheduled_start_time
        ? query.eq('scheduled_start_time', row.scheduled_start_time)
        : query.is('scheduled_start_time', null)
      query = row.scheduled_end_time
        ? query.eq('scheduled_end_time', row.scheduled_end_time)
        : query.is('scheduled_end_time', null)
    }

    const { data, error } = await query.select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      // If we couldn't match a row to update, fall back to inserting just this row.
      // This should be rare; it also ensures we don't silently drop a line item.
      const { error: insErr } = await supabase?.from('job_parts')?.insert([row])
      if (insErr) throw insErr
    }
  }
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

        const promisedDateRaw =
          item?.promised_date ?? item?.lineItemPromisedDate ?? item?.dateScheduled ?? null
        const promisedDateNorm =
          promisedDateRaw || (requiresScheduling ? new Date().toISOString().slice(0, 10) : null)

        const record = {
          job_id: jobId,
          product_id: productId,
          quantity_used: Number.isFinite(quantityRaw) ? quantityRaw : 1,
          unit_price: Number.isFinite(unitPriceRaw) ? unitPriceRaw : 0,
          // Support legacy dateScheduled/lineItemPromisedDate fallbacks
          promised_date: promisedDateNorm,
          requires_scheduling: requiresScheduling,
          no_schedule_reason: requiresScheduling
            ? null
            : (item?.no_schedule_reason ?? item?.noScheduleReason ?? null),
          is_off_site: !!(item?.is_off_site ?? item?.isOffSite),
        }

        if (includeVendor) {
          const vendorId = item?.vendor_id ?? item?.vendorId ?? null
          record.vendor_id = vendorId && String(vendorId).trim() ? vendorId : null
        }

        if (includeTimes) {
          const start = normalizeTime(
            item?.scheduled_start_time ?? item?.scheduledStartTime ?? null
          )
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
      includeVendor ? (record.vendor_id ?? VENDOR_PLACEHOLDER_UUID) : VENDOR_PLACEHOLDER_UUID,
      includeTimes ? (record.scheduled_start_time ?? TIME_PLACEHOLDER) : TIME_PLACEHOLDER,
      includeTimes ? (record.scheduled_end_time ?? TIME_PLACEHOLDER) : TIME_PLACEHOLDER,
    ]
    const key = keyParts.join('|')

    const existing = dedupeMap.get(key)
    if (existing) {
      // Merge duplicate rows that would violate DB uniqueness constraints.
      // Preserve latest non-key fields (promised_date, flags) while summing quantity.
      const mergedQuantity = Number(existing.quantity_used || 0) + Number(record.quantity_used || 0)
      const next = {
        ...existing,
        ...record,
        quantity_used: mergedQuantity,
      }

      if (
        import.meta.env.MODE === 'development' &&
        Number(existing.unit_price || 0) !== Number(record.unit_price || 0)
      ) {
        console.warn('[buildJobPartsPayload] Merged duplicates with differing unit_price:', {
          product_id: record.product_id,
          vendor_id: record.vendor_id,
          scheduled_start_time: record.scheduled_start_time,
          scheduled_end_time: record.scheduled_end_time,
          existing_unit_price: existing.unit_price,
          incoming_unit_price: record.unit_price,
        })
      }

      dedupeMap.set(key, next)
    } else {
      dedupeMap.set(key, record)
    }
  }

  dedupeMap.forEach((value) => uniqueRecords.push(value))

  return uniqueRecords
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
          (it?.requiresScheduling ?? it?.requires_scheduling)
            ? null
            : it?.noScheduleReason || it?.no_schedule_reason || null,
        is_off_site: !!(it?.isOffSite ?? it?.is_off_site),
      }

      if (includeTimes) {
        row.scheduled_start_time = it?.scheduledStartTime || it?.scheduled_start_time || null
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
 * It uses an upsert on the logical key so saves are idempotent and avoid duplicates.
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

  // Remove existing rows so deletions are honored before upsert
  const { error: delErr } = await supabase?.from('job_parts')?.delete()?.eq('job_id', jobId)
  if (delErr) {
    console.error('[replaceJobPartsForJob] DELETE failed:', delErr)
    throw new Error(`Failed to delete existing job_parts: ${delErr?.message}`)
  }

  if (import.meta.env.MODE === 'development') {
    console.log('[replaceJobPartsForJob] DELETE successful')
  }

  if ((lineItems || []).length === 0) {
    if (import.meta.env.MODE === 'development') {
      console.log('[replaceJobPartsForJob] No line items to upsert, done')
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

  // Align with DB unique index job_parts_unique_job_product_schedule
  // (job_id, product_id, coalesce(vendor_id,...), coalesce(scheduled_start_time,...), coalesce(scheduled_end_time,...))
  const conflictColumns = ['job_id', 'product_id']
  if (includeVendor) conflictColumns.push('vendor_id')
  if (includeTimes) {
    conflictColumns.push('scheduled_start_time', 'scheduled_end_time')
  }
  const onConflict = conflictColumns.join(',')

  if (import.meta.env.MODE === 'development') {
    console.log('🧩 job_parts payload for save', {
      jobId: jobId.slice(0, 8) + '...',
      payloadCount: rows.length,
      jobPartsPayload: rows,
      onConflict,
    })
  }

  const { error: upsertErr } = await supabase
    ?.from('job_parts')
    ?.upsert(rows, { onConflict, ignoreDuplicates: false })
    ?.select()

  if (upsertErr) {
    // Handle missing column errors with retry
    if (isMissingColumnError(upsertErr)) {
      const errorCode = classifySchemaError(upsertErr)
      const lower = String(upsertErr?.message || '').toLowerCase()

      if (lower.includes('job_parts') && lower.includes('vendor_id')) {
        if (JOB_PARTS_VENDOR_ID_COLUMN_AVAILABLE) {
          console.warn(
            `[replaceJobPartsForJob] ${errorCode}: vendor_id column missing, retrying without it`
          )
          disableJobPartsVendorIdCapability()
          incrementTelemetry?.(TelemetryKey?.VENDOR_ID_FALLBACK)

          includeVendor = false
          const retryRows = buildJobPartsPayload(jobId, lineItems, { includeTimes, includeVendor })
          const retryConflict = ['job_id', 'product_id']
          retryConflict.push('promised_date')
          if (includeTimes) {
            retryConflict.push('scheduled_start_time', 'scheduled_end_time')
          }
          const retryOnConflict = retryConflict.join(',')

          const { error: retryErr } = await supabase
            ?.from('job_parts')
            ?.upsert(retryRows, { onConflict: retryOnConflict, ignoreDuplicates: false })
            ?.select()
          if (retryErr) {
            console.error('[replaceJobPartsForJob] Retry UPSERT failed:', retryErr)
            throw new Error(`Failed to upsert job_parts (retry): ${retryErr?.message}`)
          }

          if (import.meta.env.MODE === 'development') {
            console.log('[replaceJobPartsForJob] Retry UPSERT successful')
          }
          return
        }
      } else if (
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
        const retryConflict = ['job_id', 'product_id']
        if (includeVendor) retryConflict.push('vendor_id')
        retryConflict.push('promised_date')
        const retryOnConflict = retryConflict.join(',')

        const { error: retryErr } = await supabase
          ?.from('job_parts')
          ?.upsert(retryRows, { onConflict: retryOnConflict, ignoreDuplicates: false })
          ?.select()
        if (retryErr) {
          console.error('[replaceJobPartsForJob] Retry UPSERT failed:', retryErr)
          throw new Error(`Failed to upsert job_parts (retry): ${retryErr?.message}`)
        }

        if (import.meta.env.MODE === 'development') {
          console.log('[replaceJobPartsForJob] Retry UPSERT successful')
        }
        return
      }
    }

    // Unique violation should not happen with upsert, but recover by updating in place if it does
    if (isUniqueViolationError(upsertErr)) {
      try {
        await updateExistingJobParts(jobId, rows, { includeTimes, includeVendor })
        return
      } catch (updateErr) {
        console.error('[replaceJobPartsForJob] Unique violation recovery failed:', updateErr)
      }
    }

    console.error('[replaceJobPartsForJob] UPSERT failed:', upsertErr)
    throw new Error(`Failed to upsert job_parts: ${upsertErr?.message}`)
  }

  if (import.meta.env.MODE === 'development') {
    console.log('[replaceJobPartsForJob] UPSERT successful, completed')
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

    const { data, error } = await supabase.from('job_parts').insert(validated).select()

    return { data, error }
  } catch (e) {
    if (e instanceof z.ZodError) {
      return {
        data: null,
        error: {
          message: 'Validation failed: ' + e.errors.map((err) => err.message).join(', '),
          details: e.errors,
        },
      }
    }
    console.error('createJobPartsTyped failed', e)
    return { data: null, error: e }
  }
}
