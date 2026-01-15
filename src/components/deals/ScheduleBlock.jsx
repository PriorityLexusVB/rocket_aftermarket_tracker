import React from 'react'

const TZ = 'America/New_York'

function isDateOnlyValue(input) {
  if (!input) return false
  if (input instanceof Date) return false
  const str = String(input).trim()
  if (!str) return false
  // Treat bare dates (and a legacy local-midnight normalization) as NOT a scheduled window.
  // These values are commonly used for promise dates and should render as scheduled without time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true
  return /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0{1,3})?(?:Z|[+-]\d{2}:?\d{2})?$/.test(str)
}

function isPromisePlaceholderWindow(start, end, promiseDate, timeZone = TZ) {
  if (!start || !end || !promiseDate) return false
  if (isDateOnlyValue(start) || isDateOnlyValue(end)) return false

  const startDate = new Date(String(start))
  const endDate = new Date(String(end))
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false

  // Heuristic: some environments materialize a fake schedule window for promise-only jobs.
  // It appears as 12:00Z–12:30Z on the promise day (renders as 7:00–7:30 AM ET).
  const scheduleDayKey = getEtDayKey(startDate, timeZone)
  const promiseDayKey = getEtDayKey(promiseDate, timeZone)
  if (!scheduleDayKey || !promiseDayKey || scheduleDayKey !== promiseDayKey) return false

  const durationMs = endDate.getTime() - startDate.getTime()
  const expectedMs = 30 * 60 * 1000
  const withinTwoMinutes = Math.abs(durationMs - expectedMs) <= 2 * 60 * 1000

  return withinTwoMinutes
}

function hasAnyPerLineWindow(deal) {
  if (!deal || !Array.isArray(deal.job_parts)) return false
  return deal.job_parts.some(
    (p) => !!p?.scheduled_start_time && !isDateOnlyValue(p.scheduled_start_time)
  )
}

function extractDateOnlyScheduleStart(deal) {
  if (!deal) return null

  // 1) Earliest date-only per-line schedule
  if (Array.isArray(deal.job_parts)) {
    const dateOnlyStarts = deal.job_parts
      .map((p) => p?.scheduled_start_time)
      .filter((v) => !!v && isDateOnlyValue(v))
      .sort()
    if (dateOnlyStarts.length > 0) return dateOnlyStarts[0]
  }

  // 2) Legacy appt fields (date-only)
  if (deal.appt_start && isDateOnlyValue(deal.appt_start)) return deal.appt_start

  // 3) Job-level schedule (deprecated; date-only)
  if (deal.scheduled_start_time && isDateOnlyValue(deal.scheduled_start_time)) {
    return deal.scheduled_start_time
  }

  return null
}

function toSafeDateForTimeZone(input) {
  if (!input) return null
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input
  }

  const str = String(input)

  // Date-only values (YYYY-MM-DD) are interpreted by JS as UTC midnight.
  // When displayed in America/New_York this can shift to the previous day.
  // Anchor at noon UTC to keep the intended calendar day stable.
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  // Legacy normalization sometimes appends a midnight time.
  // Treat midnight ISO variants like date-only values to prevent the same day-shift.
  const m2 = /^([0-9]{4})-([0-9]{2})-([0-9]{2})T00:00:00(?:\.0{1,3})?(?:Z|[+-]\d{2}:?\d{2})?$/.exec(
    str
  )
  if (m2) {
    const y = Number(m2[1])
    const mo = Number(m2[2])
    const d = Number(m2[3])
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  const dt = new Date(str)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function extractScheduleTimes(deal, promiseDate) {
  if (!deal) return { startTime: null, endTime: null }

  // 1) Earliest line-item schedule (job_parts)
  if (Array.isArray(deal.job_parts)) {
    const scheduledParts = deal.job_parts
      .filter((p) => p?.scheduled_start_time && !isDateOnlyValue(p.scheduled_start_time))
      .sort(
        (a, b) =>
          new Date(a.scheduled_start_time).getTime() - new Date(b.scheduled_start_time).getTime()
      )

    if (scheduledParts.length > 0) {
      const candidateStart = scheduledParts[0].scheduled_start_time
      const candidateEnd = scheduledParts[0].scheduled_end_time || null
      if (isPromisePlaceholderWindow(candidateStart, candidateEnd, promiseDate)) {
        return { startTime: null, endTime: null }
      }
      return {
        startTime: candidateStart,
        endTime: candidateEnd,
      }
    }
  }

  // 2) Legacy appt fields
  if (deal.appt_start && !isDateOnlyValue(deal.appt_start)) {
    return {
      startTime: deal.appt_start,
      endTime: deal.appt_end || null,
    }
  }

  // 3) Job-level schedule (deprecated; keep only as a fallback)
  if (deal.scheduled_start_time && !isDateOnlyValue(deal.scheduled_start_time)) {
    // If no line items have a real scheduled window, suppress synthesized job-level placeholders.
    if (
      !hasAnyPerLineWindow(deal) &&
      isPromisePlaceholderWindow(deal.scheduled_start_time, deal.scheduled_end_time, promiseDate)
    ) {
      return { startTime: null, endTime: null }
    }
    return {
      startTime: deal.scheduled_start_time,
      endTime: deal.scheduled_end_time || null,
    }
  }

  return { startTime: null, endTime: null }
}

function buildDateLabelET(isoOrDate, timeZone = TZ) {
  if (!isoOrDate) return ''
  const d = toSafeDateForTimeZone(isoOrDate)
  if (!d) return ''

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).formatToParts(d)

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const weekday = map.weekday || ''
  const month = map.month || ''
  const day = map.day || ''
  return [weekday, month, day].filter(Boolean).join(' ')
}

function buildTimePartsET(isoOrDate, timeZone = TZ) {
  if (!isoOrDate) return null
  const d = toSafeDateForTimeZone(isoOrDate)
  if (!d) return null

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(d)

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const hour = map.hour || ''
  const minute = map.minute || ''
  const dayPeriod = map.dayPeriod || ''
  const hm = hour && minute ? `${hour}:${minute}` : ''
  return { hm, dayPeriod }
}

function getEtDayKey(isoOrDate, timeZone = TZ) {
  if (!isoOrDate) return ''
  const d = toSafeDateForTimeZone(isoOrDate)
  if (!d) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

/**
 * ScheduleBlock
 * - If scheduled start/end exist: primary "Tue Dec 30 • 4:30–6:30 PM ET"
 * - If no scheduled window (promise-only): primary "Promise: Tue Dec 30" + "Not scheduled" badge
 * - Promise shown as secondary only if present + meaningful (differs from scheduled day)
 */
export default function ScheduleBlock({
  deal,
  scheduledStart,
  scheduledEnd,
  promiseDate,
  timeZone = TZ,
  onClick,
  className = '',
}) {
  const derived = deal && !scheduledStart ? extractScheduleTimes(deal, promiseDate) : null
  const effectiveStartRaw = scheduledStart || derived?.startTime || null
  const effectiveEndRaw = scheduledEnd || derived?.endTime || null

  const effectiveStart = effectiveStartRaw
  const effectiveEnd = effectiveEndRaw

  const hasWindow = !!effectiveStart && !isDateOnlyValue(effectiveStart)

  const dateOnlyScheduleStart = !hasWindow ? extractDateOnlyScheduleStart(deal) : null
  const hasDateOnlySchedule = !!dateOnlyScheduleStart

  const scheduleDayKey = hasWindow
    ? getEtDayKey(effectiveStart, timeZone)
    : hasDateOnlySchedule
      ? getEtDayKey(dateOnlyScheduleStart, timeZone)
      : ''
  const promiseDayKey = promiseDate ? getEtDayKey(promiseDate, timeZone) : ''

  const primary = (() => {
    if (hasWindow) {
      const dateLabel = buildDateLabelET(effectiveStart, timeZone)
      const startParts = buildTimePartsET(effectiveStart, timeZone)
      const endParts = effectiveEnd ? buildTimePartsET(effectiveEnd, timeZone) : null
      if (!dateLabel || !startParts?.hm) return '—'

      if (!endParts?.hm) {
        return `${dateLabel} • ${startParts.hm} ${startParts.dayPeriod} ET`
      }

      const samePeriod =
        startParts.dayPeriod && endParts.dayPeriod && startParts.dayPeriod === endParts.dayPeriod
      const startLabel = samePeriod ? startParts.hm : `${startParts.hm} ${startParts.dayPeriod}`
      const endLabel = `${endParts.hm} ${endParts.dayPeriod}`
      return `${dateLabel} • ${startLabel}–${endLabel} ET`
    }

    if (hasDateOnlySchedule) {
      const dateLabel = buildDateLabelET(dateOnlyScheduleStart, timeZone)
      return dateLabel ? `${dateLabel} • Time TBD` : '—'
    }

    if (promiseDate) {
      const promiseLabel = buildDateLabelET(promiseDate, timeZone)
      return promiseLabel ? `Promise: ${promiseLabel}` : 'Promise: —'
    }

    return '—'
  })()

  const showSecondaryPromise =
    !!promiseDate &&
    (!!hasWindow || hasDateOnlySchedule) &&
    !!promiseDayKey &&
    !!scheduleDayKey &&
    promiseDayKey !== scheduleDayKey

  const secondary = showSecondaryPromise
    ? `Promise: ${buildDateLabelET(promiseDate, timeZone)}`
    : ''

  const Wrapper = onClick ? 'button' : 'div'
  const wrapperProps = onClick
    ? {
        type: 'button',
        onClick: (e) => {
          e?.stopPropagation?.()
          onClick?.(e)
        },
      }
    : {}

  return (
    <Wrapper
      {...wrapperProps}
      className={onClick ? `text-left hover:opacity-90 focus:outline-none ${className}` : className}
      aria-label={onClick ? primary : undefined}
    >
      <div className="flex items-start gap-2">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-slate-900">{primary}</div>
          {secondary ? (
            <div className="mt-0.5 truncate text-xs text-slate-500">{secondary}</div>
          ) : null}
        </div>
        {!hasWindow && !hasDateOnlySchedule && promiseDate ? (
          <span className="shrink-0 inline-flex items-center rounded-full bg-slate-200/60 px-2 py-0.5 text-xs font-medium text-slate-700">
            Not scheduled
          </span>
        ) : null}
      </div>
    </Wrapper>
  )
}
