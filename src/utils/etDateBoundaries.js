// Shared Eastern-Time date boundary helpers.
// Used by roundUpExport.js and CalendarShell.jsx to produce UTC-correct
// .gte/.lte query bounds so jobs at 23:45 ET (03:45Z next day) are not
// silently dropped from date-range queries.
//
// No external deps — uses only Intl.DateTimeFormat (browser + Node v12+).

const ET_TIMEZONE = 'America/New_York'

function getTimeZoneOffsetMs(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    timeZoneName: 'shortOffset',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  const parts = fmt.formatToParts(date)
  const tzName = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+0'
  if (tzName === 'GMT' || tzName === 'UTC') return 0
  const m = tzName.match(/GMT([+-])(\d{1,2})(?::?(\d{2}))?/)
  if (!m) return 0
  const sign = m[1] === '-' ? -1 : 1
  const hours = Number(m[2] || 0)
  const minutes = Number(m[3] || 0)
  return sign * (hours * 60 + minutes) * 60 * 1000
}

function getZonedYmd(date, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  const ymd = fmt.format(date) // YYYY-MM-DD
  const [year, month, day] = ymd.split('-').map(Number)
  return { year, month, day }
}

function zonedStartOfDay(date, timeZone) {
  const { year, month, day } = getZonedYmd(date, timeZone)
  const baseUtc = Date.UTC(year, month - 1, day, 0, 0, 0, 0)
  const guess = new Date(baseUtc)
  const offset1 = getTimeZoneOffsetMs(guess, timeZone)
  const utc1 = baseUtc - offset1
  const d1 = new Date(utc1)
  const offset2 = getTimeZoneOffsetMs(d1, timeZone)
  const utc2 = baseUtc - offset2
  return new Date(utc2)
}

function zonedEndOfDay(date, timeZone) {
  const { year, month, day } = getZonedYmd(date, timeZone)
  const baseUtc = Date.UTC(year, month - 1, day, 23, 59, 59, 999)
  const guess = new Date(baseUtc)
  const offset1 = getTimeZoneOffsetMs(guess, timeZone)
  const utc1 = baseUtc - offset1
  const d1 = new Date(utc1)
  const offset2 = getTimeZoneOffsetMs(d1, timeZone)
  const utc2 = baseUtc - offset2
  return new Date(utc2)
}

/**
 * Returns the ET-midnight (as UTC) for the start of the given date.
 * Suitable for use as a .gte filter on UTC-stored timestamps.
 */
export function etStartOfDay(date) {
  const d = date instanceof Date ? date : new Date(date)
  return zonedStartOfDay(d, ET_TIMEZONE)
}

/**
 * Returns the ET 23:59:59.999 (as UTC) for the end of the given date.
 * Suitable for use as a .lte filter on UTC-stored timestamps.
 */
export function etEndOfDay(date) {
  const d = date instanceof Date ? date : new Date(date)
  return zonedEndOfDay(d, ET_TIMEZONE)
}
