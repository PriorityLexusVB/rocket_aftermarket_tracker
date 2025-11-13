// Unified Scheduling Utilities (America/New_York timezone)
// Provides canonical helpers for converting, validating, and formatting scheduling datetimes.
// NOTE: Do not introduce external date libraries per guardrails.

const TZ = 'America/New_York'

// Internal: build Date from local date + time (YYYY-MM-DD + HH:MM) in target timezone
function makeDateFromLocalFields(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null
  const temp = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
  const tzOffsetMinutes = getTimeZoneOffsetMinutes(temp)
  return new Date(temp.getTime() - tzOffsetMinutes * 60000)
}

// Internal: get timezone offset (minutes) for given Date in target TZ
function getTimeZoneOffsetMinutes(date) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = formatter.formatToParts(date)
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]))
  const year = Number(map.year)
  const month = Number(map.month)
  const day = Number(map.day)
  const hour = Number(map.hour)
  const minute = Number(map.minute)
  const reconstructedUTC = Date.UTC(year, month - 1, day, hour, minute)
  return (reconstructedUTC - date.getTime()) / 60000
}

// Convert an ISO string (UTC or any timezone) into local date/time fields.
export function toLocalDateTimeFields(iso) {
  if (!iso) return { date: '', time: '' }
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return { date: '', time: '' }
    const dateStr = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
    const rawTime = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    const timeStr = rawTime.length === 4 ? '0' + rawTime : rawTime
    return { date: dateStr, time: timeStr }
  } catch {
    return { date: '', time: '' }
  }
}

// Convert local fields back to ISO (UTC) while preserving meaning.
export function fromLocalDateTimeFields(fields) {
  if (!fields || typeof fields !== 'object') return null
  const { date, time } = fields
  if (!date || !time) return null
  try {
    const adjusted = makeDateFromLocalFields(date, time)
    return adjusted ? adjusted.toISOString() : null
  } catch {
    return null
  }
}

// Format schedule range for display.
export function formatScheduleRange(startIso, endIso) {
  if (!startIso) return ''
  try {
    const start = new Date(startIso)
    if (isNaN(start.getTime())) return ''
    const end = endIso ? new Date(endIso) : null
    const sameDay = end && isSameDayTZ(start, end, TZ)
    const dateFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      month: 'short',
      day: 'numeric',
    })
    const timeFmt = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    const startDateStr = dateFmt.format(start)
    const startTimeStr = normalizeTime(timeFmt.format(start))
    if (!end) return `${startDateStr}, ${startTimeStr} ET`
    const endTimeStr = normalizeTime(timeFmt.format(end))
    if (sameDay) return `${startDateStr}, ${startTimeStr}–${endTimeStr} ET`
    const endDateStr = dateFmt.format(end)
    return `${startDateStr} ${startTimeStr} – ${endDateStr} ${endTimeStr} ET`
  } catch {
    return ''
  }
}

// Simple HH:MM formatting in local TZ.
export function formatTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const raw = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    return normalizeTime(raw)
  } catch {
    return ''
  }
}

function normalizeTime(t) {
  return t.length === 4 ? '0' + t : t
}

function isSameDayTZ(a, b, tz) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(a) === fmt.format(b)
}

// Validate schedule range.
export function validateScheduleRange(startIso, endIso) {
  const errors = []
  if (!startIso) errors.push('start_required')
  if (!endIso) errors.push('end_required')
  if (startIso && endIso) {
    const s = new Date(startIso)
    const e = new Date(endIso)
    if (isNaN(s.getTime()) || isNaN(e.getTime())) errors.push('invalid')
    else if (e.getTime() <= s.getTime()) errors.push('end_not_after_start')
  }
  return { valid: errors.length === 0, errors }
}

export default {
  toLocalDateTimeFields,
  fromLocalDateTimeFields,
  formatScheduleRange,
  validateScheduleRange,
  formatTime,
}
