// Unified Scheduling Utilities (America/New_York timezone)
// Provides canonical helpers for converting, validating, and formatting scheduling datetimes.
// NOTE: Do not introduce external date libraries per guardrails.

const TZ = 'America/New_York'

// Internal: build Date from local date + time (YYYY-MM-DD + HH:MM) in target timezone
function makeDateFromLocalFields(dateStr, timeStr) {
  if (!dateStr || !timeStr) return null
  // Construct in timezone by parsing components and then using Date.UTC adjusted by offset.
  // Simpler approach: create an ISO by assuming local TZ then rely on Date to parse.
  const [year, month, day] = dateStr.split('-').map(Number)
  const [hour, minute] = timeStr.split(':').map(Number)
  if ([year, month, day, hour, minute].some((n) => Number.isNaN(n))) return null
  // Create a Date in UTC based on NY local components by subtracting the NY offset at that local time.
  // Acquire offset by constructing a date in NY via Intl and diffing.
  const temp = new Date(Date.UTC(year, month - 1, day, hour, minute, 0, 0))
  // offset in minutes for NY at that moment
  const tzOffsetMinutes = getTimeZoneOffsetMinutes(temp)
  // Adjust the UTC time so that when displayed in NY it matches given local fields.
  const adjusted = new Date(temp.getTime() - tzOffsetMinutes * 60000)
  return adjusted
}

// Internal: get timezone offset (minutes) for given Date in target TZ
function getTimeZoneOffsetMinutes(date) {
  // Format the date parts in target tz and reconstruct a Date to compute difference
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
  const diffMinutes = (reconstructedUTC - date.getTime()) / 60000
  return diffMinutes
}

// Convert an ISO string (UTC or any timezone) into local date/time fields for form controls.
export function toLocalDateTimeFields(iso) {
  if (!iso) return { date: '', time: '' }
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return { date: '', time: '' }
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d) // YYYY-MM-DD
    const t = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d) // HH:MM
    // en-US hour may be "08" or "8" depending; ensure 2-digit
    const time = t.length === 4 ? '0' + t : t
    return { date: f, time }
  } catch {
    return { date: '', time: '' }
  }
}

// Convert local fields back to an ISO string (UTC) while preserving NY original meaning.
export function fromLocalDateTimeFields({ date, time }) {
  if (!date || !time) return null
  try {
    const adjusted = makeDateFromLocalFields(date, time)
    if (!adjusted) return null
    return adjusted.toISOString()
  } catch {
    return null
  }
}

// Format a schedule range (start & end ISO). Same-day => "Nov 13, 10:00–11:30 ET"; multi-day => "Nov 13 10:00 – Nov 14 09:00 ET"
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

// Simple time formatting for chip-level display (HH:MM) local TZ
export function formatTime(iso) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const t = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    return normalizeTime(t)
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

// Validate schedule range: both present & end > start (millis). Returns { valid, errors }
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
