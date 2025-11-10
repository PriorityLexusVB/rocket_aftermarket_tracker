// src/utils/dateDisplay.js
/**
 * Format a promise date for display, handling null/invalid cases gracefully.
 *
 * @param {string|null|undefined} promiseDate - The promise date (YYYY-MM-DD format or ISO)
 * @returns {string} - Formatted date or "No promise date"
 */
export function formatPromiseDate(promiseDate) {
  if (!promiseDate || promiseDate === '') {
    return 'No promise date'
  }

  try {
    const date = new Date(promiseDate)
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return 'No promise date'
    }

    // Return formatted date (e.g., "Jan 15, 2025")
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
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
