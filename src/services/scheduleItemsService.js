import { calendarService } from '@/services/calendarService'
import { jobService } from '@/services/jobService'
import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

const MS_DAY = 24 * 60 * 60 * 1000

function safeDate(input) {
  const d = input instanceof Date ? input : new Date(input)
  return Number.isNaN(d.getTime()) ? null : d
}

function minIso(a, b) {
  if (!a) return b
  if (!b) return a
  return String(a) < String(b) ? a : b
}

function computeLocationType(jobParts) {
  const parts = Array.isArray(jobParts) ? jobParts : []
  if (!parts.length) return null

  const hasOffSite = parts.some((p) => p?.is_off_site === true)
  const hasInHouse = parts.some((p) => p?.is_off_site === false)

  if (hasOffSite && hasInHouse) return 'Mixed'
  if (hasOffSite) return 'Off-Site'
  if (hasInHouse) return 'In-House'
  return null
}

export function getEffectiveScheduleWindowFromJob(job) {
  if (!job) return { start: null, end: null, source: 'none' }

  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  const scheduledParts = parts
    .filter((p) => p?.scheduled_start_time)
    .sort((a, b) => String(a.scheduled_start_time).localeCompare(String(b.scheduled_start_time)))

  if (scheduledParts.length > 0) {
    const start = scheduledParts[0]?.scheduled_start_time || null
    const end =
      scheduledParts
        .map((p) => p?.scheduled_end_time)
        .filter(Boolean)
        .sort()
        .slice(-1)?.[0] ||
      scheduledParts[0]?.scheduled_end_time ||
      start

    return { start: start || null, end: end || start || null, source: 'job_parts' }
  }

  if (job?.scheduled_start_time) {
    return {
      start: job.scheduled_start_time,
      end: job.scheduled_end_time || job.scheduled_start_time || null,
      source: 'job',
    }
  }

  if (job?.appt_start) {
    return {
      start: job.appt_start,
      end: job.appt_end || job.appt_start || null,
      source: 'legacy_appt',
    }
  }

  return { start: null, end: null, source: 'none' }
}

function getPromiseIso(job) {
  if (!job) return null

  const explicit = job?.next_promised_iso || job?.promised_date || job?.promisedAt
  let earliest = explicit || null

  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  for (const p of parts) {
    const v = p?.promised_date
    if (!v) continue
    const iso = String(v).includes('T') ? v : `${v}T00:00:00Z`
    earliest = minIso(earliest, iso)
  }

  return earliest
}

function safeMoneyAmount(job) {
  if (!job) return null

  if (typeof job?.total_amount === 'number') return job.total_amount
  if (typeof job?.totalAmount === 'number') return job.totalAmount

  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  const sum = parts.reduce((acc, p) => {
    const total =
      typeof p?.total_price === 'number'
        ? p.total_price
        : typeof p?.unit_price === 'number'
          ? p.unit_price * (typeof p?.quantity_used === 'number' ? p.quantity_used : 1)
          : 0
    return acc + (Number.isFinite(total) ? total : 0)
  }, 0)
  return Number.isFinite(sum) && sum > 0 ? sum : null
}

export function classifyScheduleState({ scheduledStart, scheduledEnd, jobStatus, now }) {
  const start = safeDate(scheduledStart)
  if (!start) return 'unscheduled'

  const end = safeDate(scheduledEnd) || start
  const nowDate = safeDate(now) || new Date()
  const nowMs = nowDate.getTime()
  const endMs = end.getTime()

  const status = String(jobStatus || '').toLowerCase()
  if (status === 'in_progress' || status === 'quality_check') return 'in_progress'

  if (endMs < nowMs) {
    const days = Math.floor((nowMs - endMs) / MS_DAY)
    return days <= 7 ? 'overdue_recent' : 'overdue_old'
  }

  return 'scheduled'
}

export function normalizeScheduleItemFromJob(job, { now = new Date(), scheduleOverride } = {}) {
  if (!job) return null

  const excluded = new Set(['cancelled', 'canceled', 'completed', 'draft'])
  const status = String(job?.job_status || '').toLowerCase()
  if (excluded.has(status)) return null

  const vehicle = job?.vehicle || job?.vehicles || null
  const vendor = job?.vendor || job?.vendors || null

  const schedule = scheduleOverride || getEffectiveScheduleWindowFromJob(job)
  const promisedAt = getPromiseIso(job)

  const scheduledStart = schedule?.start || null
  const scheduledEnd = schedule?.end || null

  const scheduleState = classifyScheduleState({
    scheduledStart,
    scheduledEnd,
    jobStatus: job?.job_status,
    now,
  })

  const customerName =
    job?.customer_name || job?.customerName || vehicle?.owner_name || vehicle?.ownerName || ''

  const salesName =
    job?.sales_consultant_name ||
    job?.salesName ||
    job?.assigned_to_profile?.display_name ||
    job?.assigned_to_profile?.full_name ||
    ''

  const vehicleLabel = (() => {
    if (!vehicle) return ''
    const base = `${vehicle?.year || ''} ${vehicle?.make || ''} ${vehicle?.model || ''}`.trim()
    const stock = vehicle?.stock_number ? ` • Stock ${vehicle.stock_number}` : ''
    return `${base}${stock}`.trim()
  })()

  const locationType = computeLocationType(job?.job_parts)

  return {
    id: job?.id,
    createdAt: job?.created_at || null,
    promisedAt,
    scheduledStart,
    scheduledEnd,
    customerName,
    salesName,
    vehicleLabel,
    vendorId: job?.vendor_id || vendor?.id || null,
    vendorName: vendor?.name || job?.vendor_name || 'Unassigned',
    locationType,
    loanerTag: job?.loaner_number || job?.has_active_loaner ? 'Loaner' : null,
    amount: safeMoneyAmount(job),
    scheduleState,
    raw: job,
    scheduleSource: schedule?.source || 'none',
  }
}

/**
 * Hydrate job rows for a date range using the canonical overlap window from the calendar RPC.
 *
 * Unlike getScheduleItems(), this does NOT normalize into schedule-item shapes and does NOT
 * filter out completed/cancelled jobs. It exists for views that need full job rows but still
 * must respect the canonical overlap-based scheduled window.
 */
export async function getScheduledJobsByDateRange({ rangeStart, rangeEnd, orgId } = {}) {
  const start = safeDate(rangeStart)
  const end = safeDate(rangeEnd)
  if (!start || !end) return { jobs: [], debug: { reason: 'invalid_range' } }

  const { data: ranged, error } = await calendarService.getJobsByDateRange(start, end, { orgId })
  if (error) return { jobs: [], debug: { rpcCount: 0, reason: 'rpc_error' } }

  const scheduleById = new Map(
    (Array.isArray(ranged) ? ranged : []).map((r) => [
      r?.id,
      {
        start: r?.scheduled_start_time || null,
        end: r?.scheduled_end_time || r?.scheduled_start_time || null,
      },
    ])
  )

  const ids = Array.from(scheduleById.keys()).filter(Boolean)
  if (!ids.length) {
    return {
      jobs: [],
      debug: { rpcCount: 0, jobCount: 0 },
    }
  }

  const jobs = await jobService.getJobsByIds(ids, { orgId })
  const withLoaners = await attachActiveLoanerFlags(jobs, orgId)

  const patched = withLoaners.map((job) => {
    const override = scheduleById.get(job?.id)
    if (!override) return job

    const promisedIso = getPromiseIso(job)

    return {
      ...job,
      scheduled_start_time: override.start,
      scheduled_end_time: override.end,
      promised_date: job?.promised_date ?? promisedIso,
      next_promised_iso: job?.next_promised_iso ?? promisedIso,
    }
  })

  // Keep stable ordering (by scheduled start) for consumers that render chronologically.
  patched.sort((a, b) => {
    const aStart = safeDate(a?.scheduled_start_time)?.getTime() || 0
    const bStart = safeDate(b?.scheduled_start_time)?.getTime() || 0
    return aStart - bStart
  })

  return {
    jobs: patched,
    debug: { rpcCount: ids.length, jobCount: patched.length },
  }
}

async function attachActiveLoanerFlags(jobRows, orgId) {
  const jobs = Array.isArray(jobRows) ? jobRows : []
  const ids = jobs.map((j) => j?.id).filter(Boolean)
  if (!ids.length) return jobs

  try {
    let q = supabase
      ?.from('loaner_assignments')
      ?.select('job_id, id')
      ?.in('job_id', ids)
      ?.is('returned_at', null)

    // Back-compat: orgId param is treated as dealer_id.
    if (orgId) q = q?.eq?.('dealer_id', orgId) ?? q

    const data = await safeSelect(q, 'scheduleItems:loaners')
    const loaners = Array.isArray(data) ? data : []
    const hasLoaner = new Set(loaners.map((l) => l?.job_id).filter(Boolean))

    return jobs.map((j) => ({ ...j, has_active_loaner: hasLoaner.has(j?.id) }))
  } catch {
    return jobs
  }
}

/**
 * Canonical schedule pipeline.
 * - Uses the DB calendar range function to identify scheduled jobs by overlap.
 * - Hydrates full job records (with job_parts) via jobService.
 * - Normalizes into a single shape for Deals/Agenda/Snapshot/Calendar.
 */
export async function getScheduleItems({ rangeStart, rangeEnd, orgId } = {}) {
  const start = safeDate(rangeStart)
  const end = safeDate(rangeEnd)
  if (!start || !end) return { items: [], debug: { reason: 'invalid_range' } }

  const now = new Date()

  const { data: ranged, error } = await calendarService.getJobsByDateRange(start, end, { orgId })
  if (error) return { items: [], debug: { rpcCount: 0, reason: 'rpc_error' } }

  const scheduleById = new Map(
    (Array.isArray(ranged) ? ranged : []).map((r) => [
      r?.id,
      {
        start: r?.scheduled_start_time || null,
        end: r?.scheduled_end_time || r?.scheduled_start_time || null,
        source: 'job_parts',
      },
    ])
  )

  const ids = Array.from(scheduleById.keys()).filter(Boolean)
  if (!ids.length) {
    return {
      items: [],
      debug: { rpcCount: 0, jobCount: 0, normalized: 0 },
    }
  }

  const jobs = await jobService.getJobsByIds(ids, { orgId })
  const withLoaners = await attachActiveLoanerFlags(jobs, orgId)

  const normalized = []
  let scheduleFromJobParts = 0
  let scheduleFromJob = 0
  let scheduleFromLegacy = 0

  for (const job of withLoaners) {
    const override = scheduleById.get(job?.id) || null
    const schedule = override || getEffectiveScheduleWindowFromJob(job)

    if (schedule?.source === 'job_parts') scheduleFromJobParts++
    else if (schedule?.source === 'job') scheduleFromJob++
    else if (schedule?.source === 'legacy_appt') scheduleFromLegacy++

    const item = normalizeScheduleItemFromJob(job, { now, scheduleOverride: schedule })
    if (item) normalized.push(item)
  }

  // Sort by scheduled start asc
  normalized.sort((a, b) => {
    const aStart = safeDate(a?.scheduledStart)?.getTime() || 0
    const bStart = safeDate(b?.scheduledStart)?.getTime() || 0
    return aStart - bStart
  })

  return {
    items: normalized,
    debug: {
      rpcCount: ids.length,
      jobCount: withLoaners.length,
      normalized: normalized.length,
      scheduleSources: {
        job_parts: scheduleFromJobParts,
        job: scheduleFromJob,
        legacy_appt: scheduleFromLegacy,
      },
    },
  }
}
