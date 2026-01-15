const DEFAULT_TZ = 'America/New_York'

export function isDateOnlyValue(input) {
  if (!input) return false
  if (input instanceof Date) return false
  const str = String(input).trim()
  if (!str) return false
  // Treat pure dates and "midnight" ISO variants as date-only.
  // Supabase / PostgREST can materialize date-only values as strings like:
  // - YYYY-MM-DD
  // - YYYY-MM-DDT00:00:00
  // - YYYY-MM-DDT00:00:00Z
  // - YYYY-MM-DDT00:00:00.000Z
  // - YYYY-MM-DDT00:00:00+00:00
  // All of these should render as "Time TBD" rather than an actual time.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return true
  return /^\d{4}-\d{2}-\d{2}T00:00:00(?:\.0{1,3})?(?:Z|[+-]\d{2}:?\d{2})?$/.test(str)
}

export function toSafeDateForTimeZone(input) {
  if (!input) return null
  if (input instanceof Date) {
    return Number.isNaN(input.getTime()) ? null : input
  }

  const str = String(input).trim()
  if (!str) return null

  // Date-only values are interpreted by JS as UTC midnight.
  // Anchor at noon UTC to prevent day-shift when formatting in America/New_York.
  const m = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(str)
  if (m) {
    const y = Number(m[1])
    const mo = Number(m[2])
    const d = Number(m[3])
    const dt = new Date(Date.UTC(y, mo - 1, d, 12, 0, 0))
    return Number.isNaN(dt.getTime()) ? null : dt
  }

  // Midnight ISO variants should be treated like date-only values to avoid day-shift.
  // See isDateOnlyValue() for supported formats.
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

export function formatEtDateLabel(isoOrDate, { timeZone = DEFAULT_TZ, weekday = 'short' } = {}) {
  const d = toSafeDateForTimeZone(isoOrDate)
  if (!d) return ''

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday,
    month: 'short',
    day: 'numeric',
  }).formatToParts(d)

  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const w = map.weekday || ''
  const m = map.month || ''
  const day = map.day || ''
  return [w, m, day].filter(Boolean).join(' ')
}

function formatEtTimeParts(isoOrDate, { timeZone = DEFAULT_TZ } = {}) {
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

export function formatEtScheduleWindow(
  startIso,
  endIso,
  { timeZone = DEFAULT_TZ, includeEtSuffix = true } = {}
) {
  if (!startIso) return ''

  const startLabel = formatEtDateLabel(startIso, { timeZone })
  const startParts = formatEtTimeParts(startIso, { timeZone })
  if (!startLabel || !startParts?.hm) return ''

  if (!endIso) {
    const suffix = includeEtSuffix ? ' ET' : ''
    return `${startLabel} • ${startParts.hm} ${startParts.dayPeriod}${suffix}`
  }

  const endParts = formatEtTimeParts(endIso, { timeZone })
  if (!endParts?.hm) {
    const suffix = includeEtSuffix ? ' ET' : ''
    return `${startLabel} • ${startParts.hm} ${startParts.dayPeriod}${suffix}`
  }

  const samePeriod =
    startParts.dayPeriod && endParts.dayPeriod && startParts.dayPeriod === endParts.dayPeriod
  const startTime = samePeriod ? startParts.hm : `${startParts.hm} ${startParts.dayPeriod}`
  const endTime = `${endParts.hm} ${endParts.dayPeriod}`
  const suffix = includeEtSuffix ? ' ET' : ''
  return `${startLabel} • ${startTime}–${endTime}${suffix}`
}

export function getAppointmentScheduleDisplay(appointment, { timeZone = DEFAULT_TZ } = {}) {
  const scheduledStart =
    appointment?.scheduled_start_time ??
    appointment?.scheduledStart ??
    appointment?.appt_start ??
    null
  const scheduledEnd =
    appointment?.scheduled_end_time ?? appointment?.scheduledEnd ?? appointment?.appt_end ?? null
  const promised =
    appointment?.promised_date ?? appointment?.promisedAt ?? appointment?.next_promised_iso

  if (scheduledStart && !isDateOnlyValue(scheduledStart)) {
    return {
      primary: formatEtScheduleWindow(scheduledStart, scheduledEnd, { timeZone }),
      badge: '',
    }
  }

  if (scheduledStart && isDateOnlyValue(scheduledStart)) {
    const dateLabel = formatEtDateLabel(scheduledStart, { timeZone })
    return {
      primary: dateLabel ? `${dateLabel} • Time TBD` : '—',
      badge: '',
    }
  }

  if (promised) {
    const promiseLabel = formatEtDateLabel(promised, { timeZone })
    return {
      primary: promiseLabel ? `All-day (Time TBD) • ${promiseLabel}` : 'All-day (Time TBD)',
      badge: 'Scheduled (No Time)',
    }
  }

  return { primary: '—', badge: '' }
}
