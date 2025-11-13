// src/utils/dateTimeUtils.js
// Consolidated date/time utilities for scheduling with America/New_York timezone support

import { format, parseISO } from 'date-fns'
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const TIMEZONE = 'America/New_York'

/**
 * Convert UTC ISO string to local datetime fields (YYYY-MM-DDTHH:mm)
 * for use in datetime-local inputs
 * @param {string} isoString - UTC ISO datetime string
 * @returns {string} Local datetime string in format YYYY-MM-DDTHH:mm
 */
export function toLocalDateTimeFields(isoString) {
  if (!isoString) return ''
  
  try {
    const date = parseISO(isoString)
    const zonedDate = toZonedTime(date, TIMEZONE)
    return format(zonedDate, "yyyy-MM-dd'T'HH:mm")
  } catch (error) {
    console.error('toLocalDateTimeFields error:', error)
    return ''
  }
}

/**
 * Convert local datetime fields (YYYY-MM-DDTHH:mm) to UTC ISO string
 * interpreting the input as America/New_York time
 * @param {string} localDateTime - Local datetime string in format YYYY-MM-DDTHH:mm
 * @returns {string} UTC ISO datetime string
 */
export function fromLocalDateTimeFields(localDateTime) {
  if (!localDateTime) return null
  
  try {
    // Parse the local datetime string as if it's in the specified timezone
    const localDate = new Date(localDateTime)
    const utcDate = fromZonedTime(localDate, TIMEZONE)
    return utcDate.toISOString()
  } catch (error) {
    console.error('fromLocalDateTimeFields error:', error)
    return null
  }
}

/**
 * Format a schedule time range for display
 * @param {string} startISO - Start time in ISO format
 * @param {string} endISO - End time in ISO format
 * @param {object} options - Formatting options
 * @param {boolean} options.includeDate - Include date in output (default: false)
 * @param {boolean} options.short - Use short format (default: false)
 * @returns {string} Formatted time range
 */
export function formatScheduleRange(startISO, endISO, options = {}) {
  const { includeDate = false, short = false } = options
  
  if (!startISO) return '—'
  
  try {
    const startDate = parseISO(startISO)
    const startZoned = toZonedTime(startDate, TIMEZONE)
    
    if (includeDate) {
      const dateStr = format(startZoned, 'MMM d')
      const startTime = format(startZoned, short ? 'h:mm a' : 'h:mm a')
      
      if (!endISO) {
        return `${dateStr} • ${startTime}`
      }
      
      const endDate = parseISO(endISO)
      const endZoned = toZonedTime(endDate, TIMEZONE)
      const endTime = format(endZoned, short ? 'h:mm a' : 'h:mm a')
      
      // Check if same time (avoid redundant display)
      if (startTime === endTime) {
        return `${dateStr} • ${startTime}`
      }
      
      return `${dateStr} • ${startTime}–${endTime}`
    } else {
      // Time only
      const startTime = format(startZoned, short ? 'h:mm a' : 'h:mm a')
      
      if (!endISO) {
        return startTime
      }
      
      const endDate = parseISO(endISO)
      const endZoned = toZonedTime(endDate, TIMEZONE)
      const endTime = format(endZoned, short ? 'h:mm a' : 'h:mm a')
      
      // Check if same time (avoid redundant display)
      if (startTime === endTime) {
        return startTime
      }
      
      return `${startTime}–${endTime}`
    }
  } catch (error) {
    console.error('formatScheduleRange error:', error)
    return '—'
  }
}

/**
 * Validate that end time is after start time
 * @param {string} startISO - Start time in ISO format
 * @param {string} endISO - End time in ISO format
 * @returns {boolean} True if valid (end > start)
 */
export function validateScheduleRange(startISO, endISO) {
  if (!startISO || !endISO) return true // Empty is valid
  
  try {
    const start = parseISO(startISO)
    const end = parseISO(endISO)
    return end > start
  } catch (error) {
    console.error('validateScheduleRange error:', error)
    return false
  }
}
