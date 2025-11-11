// src/utils/dateDisplay.js
/**
 * Format a promise date for display, handling null/invalid cases gracefully.
 *
 * @param {string|null|undefined} promiseDate - The promise date (YYYY-MM-DD format or ISO)
 * @returns {string} - Formatted date or "No promise date"
 */
import { parse, parseISO, isValid as isValidDate, format as formatDate } from 'date-fns'

export function formatPromiseDate(promiseDate) {
  if (!promiseDate || promiseDate === '') {
    return 'No promise date'
  }

  try {
    let date
    // If we have a plain date (YYYY-MM-DD), parse as a local date to avoid UTC shifts
    if (typeof promiseDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(promiseDate)) {
      date = parse(promiseDate, 'yyyy-MM-dd', new Date())
    } else if (typeof promiseDate === 'string') {
      // Otherwise, try ISO parse (keeps exact calendar day for ISO strings)
      date = parseISO(promiseDate)
    } else if (promiseDate instanceof Date) {
      date = promiseDate
    }

    if (!date || !isValidDate(date)) {
      return 'No promise date'
    }

    // Stable formatting independent of environment timezone
    return formatDate(date, 'MMM d, yyyy')
  } catch (err) {
    return 'No promise date'
  }
}

/**
 * Format a scheduled time window for display.
 *
 * @param {string|null} startTime - ISO datetime string
 * @param {string|null} endTime - ISO datetime string
 * @returns {string} - Formatted time window or "Not scheduled"
 */
export function formatTimeWindow(startTime, endTime) {
  if (!startTime || !endTime) {
    return 'Not scheduled'
  }

  try {
    const start = new Date(startTime)
    const end = new Date(endTime)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return 'Not scheduled'
    }

    const startStr = start.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    const endStr = end.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })

    return `${startStr} - ${endStr}`
  } catch (err) {
    return 'Not scheduled'
  }
}
