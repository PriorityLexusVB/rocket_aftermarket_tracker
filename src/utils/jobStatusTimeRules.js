import { getEtDayUtcMs, isDateOnlyValue, toSafeDateForTimeZone } from './scheduleDisplay.js'

function normalizeStatus(status) {
  return String(status || '')
    .trim()
    .toLowerCase()
}

function safeDate(input) {
  const d = toSafeDateForTimeZone(input)
  return d && !Number.isNaN(d.getTime()) ? d : null
}

function isScheduledLike(status) {
  const s = normalizeStatus(status)
  return s === 'scheduled' || s === 'booked'
}

/**
 * Returns the effective status for schedule automation:
 * - If status is scheduled/booked and the scheduled day/time has "hit", treat as in_progress
 * - Otherwise return the normalized base status.
 */
export function getEffectiveJobStatus(job, { now = new Date() } = {}) {
  const base = normalizeStatus(job?.job_status)

  // Terminal/explicit statuses are never auto-changed.
  if (
    base === 'completed' ||
    base === 'cancelled' ||
    base === 'canceled' ||
    base === 'no_show' ||
    base === 'draft' ||
    base === 'quality_check' ||
    base === 'delivered' ||
    base === 'in_progress'
  ) {
    return base
  }

  if (!isScheduledLike(base)) return base

  const nowDate = safeDate(now) || new Date()
  const startRaw = job?.scheduled_start_time || job?.scheduledStartTime || null
  const start = safeDate(startRaw)

  // If no start time exists, we can't apply the "time hits" rule.
  if (!start) return base

  // Date-only: promote at ET day boundary.
  if (isDateOnlyValue(startRaw)) {
    const nowDay = getEtDayUtcMs(nowDate)
    const startDay = getEtDayUtcMs(startRaw)
    if (nowDay != null && startDay != null && nowDay >= startDay) return 'in_progress'
    return base
  }

  // Timestamp: promote when start time arrives.
  if (start.getTime() <= nowDate.getTime()) return 'in_progress'
  return base
}

/**
 * Uncomplete target:
 * - If scheduled day/time is still in the future, go back to scheduled
 * - Otherwise go back to in_progress
 */
export function getUncompleteTargetStatus(job, { now = new Date() } = {}) {
  const nowDate = safeDate(now) || new Date()

  const startRaw = job?.scheduled_start_time || job?.scheduledStartTime || null
  const start = safeDate(startRaw)

  if (start) {
    if (isDateOnlyValue(startRaw)) {
      const nowDay = getEtDayUtcMs(nowDate)
      const startDay = getEtDayUtcMs(startRaw)
      if (nowDay != null && startDay != null && startDay > nowDay) return 'scheduled'
      return 'in_progress'
    }

    return start.getTime() > nowDate.getTime() ? 'scheduled' : 'in_progress'
  }

  // No schedule info: default to in_progress when uncompleting.
  return 'in_progress'
}

/**
 * Reopen target:
 * - If completed, move to the safest allowed next state (quality_check)
 * - Otherwise, defer to uncomplete schedule logic
 */
export function getReopenTargetStatus(job, { now = new Date() } = {}) {
  const base = normalizeStatus(job?.job_status)
  if (base === 'completed') return 'quality_check'
  return getUncompleteTargetStatus(job, { now })
}
