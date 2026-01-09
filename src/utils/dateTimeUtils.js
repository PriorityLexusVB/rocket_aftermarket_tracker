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

/**
 * Combine a date string and time string into an ISO datetime string for timestamptz columns.
 * Used when the UI collects date and time separately and needs to send a proper datetime to Supabase.
 *
 * @param {string} dateStr - Date in YYYY-MM-DD format (e.g., "2025-12-06")
 * @param {string} timeStr - Time in HH:MM format (e.g., "13:07" or "09:30")
 * @returns {string|null} - ISO datetime string suitable for timestamptz, or null if inputs are invalid/missing
 *
 * @example
 * combineDateAndTime('2025-12-06', '13:07') // => "2025-12-06T18:07:00.000Z" (when ET is -05:00)
 * combineDateAndTime('2025-12-06', '') // => null
 * combineDateAndTime('', '13:07') // => null
 */
export function combineDateAndTime(dateStr, timeStr) {
  // Return null if either value is missing or empty
  if (!dateStr || !timeStr) return null
  if (typeof dateStr !== 'string' || typeof timeStr !== 'string') return null
  if (!dateStr.trim() || !timeStr.trim()) return null

  // Normalize time to HH:MM format (handle "9:30" -> "09:30", "9:5" -> "09:05")
  let normalizedTime = null
  if (timeStr.trim().includes(':')) {
    const [hours, minutes] = timeStr.trim().split(':')
    if (hours && minutes) {
      normalizedTime = `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`
    }
  }

  if (!normalizedTime) return null

  // Use the existing helper which properly handles America/New_York timezone
  return fromLocalDateTimeFields({ date: dateStr.trim(), time: normalizedTime })
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

  // Map error codes to user-friendly messages
  const errorMessages = {
    start_required: 'Start time is required',
    end_required: 'End time is required',
    invalid: 'Invalid date/time format',
    end_not_after_start: 'End time must be after start time',
  }

  const error = errors.length > 0 ? errorMessages[errors[0]] || 'Invalid schedule' : ''

  return { valid: errors.length === 0, errors, error }
}

/**
 * Convert an ISO datetime string to a date input value (YYYY-MM-DD).
 * Handles full ISO strings like "2025-12-12T18:35:00+00:00" and converts them
 * to the format expected by <input type="date">.
 *
 * @param {string|Date} isoOrDate - ISO datetime string or Date object
 * @returns {string} - Date string in YYYY-MM-DD format for date inputs
 *
 * @example
 * toDateInputValue('2025-12-12T18:35:00+00:00') // => "2025-12-12"
 * toDateInputValue('2025-12-12') // => "2025-12-12"
 * toDateInputValue(null) // => ""
 */
export function toDateInputValue(isoOrDate) {
  if (!isoOrDate) return ''
  try {
    const d = new Date(isoOrDate)
    if (isNaN(d.getTime())) return ''
    // Use en-CA locale which formats as YYYY-MM-DD in local timezone
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d)
  } catch {
    return ''
  }
}

/**
 * Convert an ISO datetime string to a time input value (HH:mm).
 * Handles full ISO strings like "2025-12-12T18:35:00+00:00" and converts them
 * to the format expected by <input type="time">.
 *
 * @param {string|Date} isoOrDate - ISO datetime string or Date object
 * @returns {string} - Time string in HH:mm format for time inputs
 *
 * @example
 * toTimeInputValue('2025-12-12T18:35:00+00:00') // => "13:35" (when ET is -05:00)
 * toTimeInputValue('2025-12-12T13:07:00Z') // => "08:07" (when ET is -05:00)
 * toTimeInputValue(null) // => ""
 */
export function toTimeInputValue(isoOrDate) {
  if (!isoOrDate) return ''
  try {
    const d = new Date(isoOrDate)
    if (isNaN(d.getTime())) return ''
    // Format as HH:mm in local timezone
    const raw = new Intl.DateTimeFormat('en-US', {
      timeZone: TZ,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
    // Normalize to HH:mm format (handles "9:30" -> "09:30")
    return normalizeTime(raw)
  } catch {
    return ''
  }
}

export default {
  toLocalDateTimeFields,
  fromLocalDateTimeFields,
  combineDateAndTime,
  formatScheduleRange,
  validateScheduleRange,
  formatTime,
  toDateInputValue,
  toTimeInputValue,
}
