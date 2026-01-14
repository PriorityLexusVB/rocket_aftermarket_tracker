import { calendarService } from '@/services/calendarService'
import { jobService } from '@/services/jobService'
import { getCapabilities } from '@/services/dealService'
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

export function classifyScheduleState({
  scheduledStart,
  scheduledEnd,
  promisedAt,
  jobStatus,
  now,
}) {
  const start = safeDate(scheduledStart)
  const promised = safeDate(promisedAt)

  // Canonical rule: if there is a promised day/date, the job is considered scheduled even
  // when no time exists yet.
  if (!start) {
    if (promised) {
      const nowDate = safeDate(now) || new Date()
      const status = String(jobStatus || '').toLowerCase()
      if (status === 'in_progress' || status === 'quality_check') return 'in_progress'

      // Date-only overdue logic is evaluated by promised day (UTC day key).
      const nowDayUtc = new Date(
        Date.UTC(nowDate.getUTCFullYear(), nowDate.getUTCMonth(), nowDate.getUTCDate())
      )
      const promisedDayUtc = new Date(
        Date.UTC(promised.getUTCFullYear(), promised.getUTCMonth(), promised.getUTCDate())
      )

      if (promisedDayUtc.getTime() < nowDayUtc.getTime()) {
        const days = Math.floor(
          (nowDayUtc.getTime() - promisedDayUtc.getTime()) / (24 * 60 * 60 * 1000)
        )
        return days <= 7 ? 'overdue_recent' : 'overdue_old'
      }

      return 'scheduled_no_time'
    }
    return 'unscheduled'
  }

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
    promisedAt,
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
 * Snapshot support: include unscheduled items in a controlled bucket.
 *
 * Definition (per requirements):
 * - location = On-Site / In-House (job.service_type)
 * - status ∈ in_progress | quality_check
 * - scheduled_start_time and scheduled_end_time are null
 * - AND there is no effective scheduled window from job_parts (canonical truth)
 */
export async function getUnscheduledInProgressInHouseItems({ orgId } = {}) {
  try {
    let q = supabase
      ?.from('jobs')
      ?.select('id')
      ?.in('job_status', ['in_progress', 'quality_check'])
      ?.in('service_type', ['onsite', 'in_house'])
      ?.is('scheduled_start_time', null)
      ?.is('scheduled_end_time', null)
      ?.order('created_at', { ascending: false })

    // Back-compat: orgId param is treated as dealer_id.
    if (orgId) q = q?.eq('dealer_id', orgId)

    const data = await safeSelect(q, 'scheduleItems:unscheduledInHouse:ids')
    const ids = (Array.isArray(data) ? data : []).map((r) => r?.id).filter(Boolean)
    if (!ids.length) return { items: [], debug: { candidateIds: 0, hydrated: 0, kept: 0 } }

    const jobs = await jobService.getJobsByIds(ids, { orgId })
    const withLoaners = await attachActiveLoanerFlags(jobs, orgId)

    const now = new Date()
    const items = []

    for (const job of withLoaners) {
      const schedule = getEffectiveScheduleWindowFromJob(job)
      // Canonical truth: if job_parts has a schedule window, it is scheduled and must not
      // appear in the unscheduled bucket.
      if (schedule?.start) continue

      const item = normalizeScheduleItemFromJob(job, {
        now,
        scheduleOverride: { start: null, end: null, source: 'none' },
      })

      if (item) items.push(item)
    }

    return {
      items,
      debug: {
        candidateIds: ids.length,
        hydrated: withLoaners.length,
        kept: items.length,
      },
    }
  } catch {
    return { items: [], debug: { reason: 'unscheduled_query_failed' } }
  }
}

function isoDateKey(d) {
  const dt = safeDate(d)
  if (!dt) return null
  return dt.toISOString().slice(0, 10)
}

/**
 * Needs Scheduling support: promise-only items with no effective schedule window.
 *
 * Definition (per requirements):
 * - Has at least one job_part with requires_scheduling = true AND promised_date set
 * - Has no scheduled_start_time / scheduled_end_time on those job_parts
 * - AND there is no effective scheduled window from job_parts/job/legacy (canonical truth)
 * - Excludes completed/cancelled/draft via normalizeScheduleItemFromJob
 */
export async function getNeedsSchedulingPromiseItems({ orgId, rangeStart, rangeEnd } = {}) {
  const startKey = isoDateKey(rangeStart)
  const endKey = isoDateKey(rangeEnd)
  if (!startKey || !endKey) return { items: [], debug: { reason: 'invalid_range' } }

  try {
    const caps = getCapabilities?.() || {}
    let q = supabase
      ?.from('job_parts')
      ?.select('job_id, promised_date')
      ?.eq('requires_scheduling', true)
      ?.not('promised_date', 'is', null)
      ?.gte('promised_date', startKey)
      ?.lt('promised_date', endKey)

    // Some environments don't have per-line scheduled_* columns yet.
    // When absent, treat job_parts as inherently lacking per-line time windows and rely on the
    // canonical effective schedule window check below to exclude truly scheduled jobs.
    if (caps?.jobPartsHasTimes) {
      q = q?.is('scheduled_start_time', null)?.is('scheduled_end_time', null)
    }

    // Tenant scoping: orgId param is treated as dealer_id (canonical tenant key in this app).
    // Fall back to org_id only for environments that haven't adopted dealer_id.
    let data
    if (orgId) {
      try {
        data = await safeSelect(
          q?.eq('dealer_id', orgId),
          'scheduleItems:needsScheduling:partIds:dealer_id'
        )
      } catch (e) {
        if (e?.type === 'missing_column' && e?.details?.column === 'dealer_id') {
          data = await safeSelect(
            q?.eq('org_id', orgId),
            'scheduleItems:needsScheduling:partIds:org_id'
          )
        } else {
          throw e
        }
      }
    } else {
      data = await safeSelect(q, 'scheduleItems:needsScheduling:partIds')
    }
    let jobIds = Array.from(
      new Set((Array.isArray(data) ? data : []).map((r) => r?.job_id).filter(Boolean))
    )

    // Some environments don't populate job_parts.dealer_id consistently (jobs are the canonical tenant).
    // Always attempt a jobs + inner join job_parts candidate discovery and union ids.
    if (orgId) {
      try {
        let jq = supabase
          ?.from('jobs')
          ?.select('id, job_parts!inner(job_id, promised_date, requires_scheduling)')
          ?.eq('dealer_id', orgId)
          ?.eq('job_parts.requires_scheduling', true)
          ?.not('job_parts.promised_date', 'is', null)
          ?.gte('job_parts.promised_date', startKey)
          ?.lt('job_parts.promised_date', endKey)

        if (caps?.jobPartsHasTimes) {
          jq = jq
            ?.is('job_parts.scheduled_start_time', null)
            ?.is('job_parts.scheduled_end_time', null)
        }

        const viaJobs = await safeSelect(jq, 'scheduleItems:needsScheduling:candidates:jobsJoin')
        const viaJobIds = (Array.isArray(viaJobs) ? viaJobs : []).map((r) => r?.id).filter(Boolean)
        if (viaJobIds.length) {
          jobIds = Array.from(new Set([...jobIds, ...viaJobIds]))
        }
      } catch {
        // Keep graceful behavior; downstream will return empty if no candidates.
      }
    }

    if (!jobIds.length) {
      return { items: [], debug: { candidateJobs: 0, hydrated: 0, kept: 0 } }
    }

    // Hydrate jobs. Prefer the shared service, but fall back to a minimal select if it yields no rows.
    // This helps in environments where expanded selects (profiles/relationships) are restricted.
    let hydratePath = 'jobService'
    let jobs = await jobService.getJobsByIds(jobIds, { orgId })

    if (orgId && (!Array.isArray(jobs) || jobs.length === 0)) {
      try {
        let jq = supabase
          ?.from('jobs')
          ?.select(
            '*, job_parts(id,product_id,vendor_id,unit_price,quantity_used,promised_date,scheduled_start_time,scheduled_end_time,requires_scheduling,no_schedule_reason,is_off_site)'
          )
          ?.in('id', jobIds)

        // Keep tenant scoping consistent with the rest of the app (dealer_id). If missing, fall back.
        try {
          jq = jq?.eq('dealer_id', orgId)
        } catch (e) {
          if (e?.type === 'missing_column' && e?.details?.column === 'dealer_id') {
            jq = jq?.eq('org_id', orgId)
          } else {
            throw e
          }
        }

        const fallbackJobs = await safeSelect(jq, 'scheduleItems:needsScheduling:hydrate:fallback')
        if (Array.isArray(fallbackJobs) && fallbackJobs.length > 0) {
          hydratePath = 'fallback'
          jobs = fallbackJobs
        }
      } catch {
        // Leave jobs as-is; downstream will return empty.
      }
    }

    const withLoaners = await attachActiveLoanerFlags(jobs, orgId)

    const now = new Date()
    const items = []
    for (const job of withLoaners) {
      const schedule = getEffectiveScheduleWindowFromJob(job)
      if (schedule?.start) continue

      const item = normalizeScheduleItemFromJob(job, {
        now,
        scheduleOverride: { start: null, end: null, source: 'needs_scheduling_promise' },
      })

      if (!item?.promisedAt) continue
      const promiseDate = safeDate(item.promisedAt)
      if (!promiseDate) continue
      if (promiseDate.toISOString().slice(0, 10) < startKey) continue
      if (promiseDate.toISOString().slice(0, 10) >= endKey) continue

      items.push(item)
    }

    items.sort((a, b) => {
      const aMs = safeDate(a?.promisedAt)?.getTime() || 0
      const bMs = safeDate(b?.promisedAt)?.getTime() || 0
      return aMs - bMs
    })

    return {
      items,
      debug: {
        candidateJobs: jobIds.length,
        hydratePath,
        sampleJobId: jobIds[0] ?? null,
        sampleJobIdType: jobIds[0] == null ? 'null' : typeof jobIds[0],
        hydrated: withLoaners.length,
        kept: items.length,
      },
    }
  } catch {
    return { items: [], debug: { reason: 'needs_scheduling_query_failed' } }
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
