// src/utils/dateTimeUtils.js
// Consolidated date/time formatting utilities with America/New_York timezone support
// All datetime-local fields use America/New_York timezone for consistency

/**
 * Convert an ISO timestamp to datetime-local format (YYYY-MM-DDTHH:MM) in America/New_York timezone
 * Used for populating datetime-local inputs
 * @param {string} iso - ISO 8601 timestamp
 * @returns {string} Local datetime string in format YYYY-MM-DDTHH:MM
 */
export function toLocalDateTimeFields(iso) {
  if (!iso) return ''
  
  try {
    const d = new Date(iso)
    
    // Format in America/New_York timezone
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
    
    const parts = formatter.formatToParts(d)
    const partsMap = {}
    parts.forEach((part) => {
      partsMap[part.type] = part.value
    })
    
    // Return in datetime-local format: YYYY-MM-DDTHH:MM
    return `${partsMap.year}-${partsMap.month}-${partsMap.day}T${partsMap.hour}:${partsMap.minute}`
  } catch (e) {
    console.warn('[dateTimeUtils] toLocalDateTimeFields failed:', e)
    return ''
  }
}

/**
 * Convert datetime-local value (YYYY-MM-DDTHH:MM) from America/New_York to ISO timestamp
 * Used when submitting datetime-local inputs to the backend
 * @param {string} localValue - Local datetime string from datetime-local input
 * @returns {string} ISO 8601 timestamp
 */
export function fromLocalDateTimeFields(localValue) {
  if (!localValue) return null
  
  try {
    // Parse the local datetime string
    const [datePart, timePart] = localValue.split('T')
    if (!datePart || !timePart) return null
    
    const [year, month, day] = datePart.split('-').map(Number)
    const [hour, minute] = timePart.split(':').map(Number)
    
    // Create a date string that will be interpreted as America/New_York
    // We use Intl.DateTimeFormat to get the offset, then adjust accordingly
    const testDate = new Date(year, month - 1, day, hour, minute)
    
    // Format this date in both UTC and NY timezone to calculate offset
    const utcTime = testDate.getTime()
    
    // Get the timezone offset for America/New_York at this specific date/time
    // (accounts for DST)
    const nyFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    })
    
    // Build a date in UTC that represents the same wall-clock time in NY
    // We need to find the UTC timestamp that, when displayed in NY timezone, shows our target time
    const targetNYString = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`
    
    // Use a more reliable method: create Date treating input as UTC, then adjust
    const utcDate = new Date(`${datePart}T${timePart}:00Z`)
    
    // Get what time it would be in NY if this were UTC
    const nyParts = nyFormatter.formatToParts(utcDate)
    const nyPartsMap = {}
    nyParts.forEach((part) => {
      nyPartsMap[part.type] = part.value
    })
    
    // Calculate the offset by comparing what we want vs what we got
    const actualHour = parseInt(nyPartsMap.hour, 10)
    const actualMinute = parseInt(nyPartsMap.minute, 10)
    const targetHourMinutes = hour * 60 + minute
    const actualHourMinutes = actualHour * 60 + actualMinute
    
    let offsetMinutes = targetHourMinutes - actualHourMinutes
    
    // Handle day boundary crossing
    if (offsetMinutes > 12 * 60) {
      offsetMinutes -= 24 * 60
    } else if (offsetMinutes < -12 * 60) {
      offsetMinutes += 24 * 60
    }
    
    // Adjust the UTC date by the offset
    const adjustedDate = new Date(utcDate.getTime() + offsetMinutes * 60 * 1000)
    
    return adjustedDate.toISOString()
  } catch (e) {
    console.warn('[dateTimeUtils] fromLocalDateTimeFields failed:', e)
    return null
  }
}

/**
 * Format a schedule time range for display
 * Returns "Today h:mm–h:mm AM/PM" if today in America/New_York
 * Otherwise returns "MMM d, h:mm–h:mm AM/PM"
 * Handles missing end time gracefully
 * 
 * @param {string} startISO - Start time ISO timestamp
 * @param {string} endISO - End time ISO timestamp (optional)
 * @returns {string} Formatted schedule range
 */
export function formatScheduleRange(startISO, endISO) {
  if (!startISO) return '—'
  
  try {
    const startDate = new Date(startISO)
    const endDate = endISO ? new Date(endISO) : null
    
    // Check if start date is today in America/New_York
    const now = new Date()
    const todayNY = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(now)
    
    const startDateNY = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(startDate)
    
    const isToday = todayNY === startDateNY
    
    // Format time parts
    const startTime = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(startDate)
    
    const endTime = endDate
      ? new Intl.DateTimeFormat('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }).format(endDate)
      : null
    
    if (isToday) {
      // Format: "Today h:mm–h:mm AM/PM" or "Today h:mm AM/PM" if no end
      return endTime ? `Today ${startTime}–${endTime}` : `Today ${startTime}`
    } else {
      // Format: "MMM d, h:mm–h:mm AM/PM"
      const dateStr = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'short',
        day: 'numeric',
      }).format(startDate)
      
      return endTime ? `${dateStr}, ${startTime}–${endTime}` : `${dateStr}, ${startTime}`
    }
  } catch (e) {
    console.warn('[dateTimeUtils] formatScheduleRange failed:', e)
    return '—'
  }
}

/**
 * Format a single timestamp as a time in America/New_York
 * Returns "h:mm AM/PM"
 * 
 * @param {string} iso - ISO timestamp
 * @returns {string} Formatted time
 */
export function formatTime(iso) {
  if (!iso) return ''
  
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d)
  } catch (e) {
    console.warn('[dateTimeUtils] formatTime failed:', e)
    return ''
  }
}

/**
 * Format a date as "MMM d, yyyy" in America/New_York
 * 
 * @param {string} iso - ISO timestamp
 * @returns {string} Formatted date
 */
export function formatDate(iso) {
  if (!iso) return ''
  
  try {
    const d = new Date(iso)
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d)
  } catch (e) {
    console.warn('[dateTimeUtils] formatDate failed:', e)
    return ''
  }
}

/**
 * Validate that end time is after start time
 * Used for form validation in scheduling UI
 * 
 * @param {string} startISO - Start time ISO timestamp
 * @param {string} endISO - End time ISO timestamp
 * @returns {boolean} True if valid (end > start), true if either is empty
 */
export function validateScheduleRange(startISO, endISO) {
  if (!startISO || !endISO) return true // Empty is valid
  
  try {
    const start = new Date(startISO)
    const end = new Date(endISO)
    return end > start
  } catch (e) {
    console.warn('[dateTimeUtils] validateScheduleRange failed:', e)
    return false
  }
}
