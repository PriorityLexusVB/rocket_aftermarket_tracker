// src/utils/timeWindow.ts
// Utility for formatting appointment time windows

/**
 * Format an appointment time window
 * - If start === end, show single time (e.g., "2:44 PM")
 * - If start !== end, show range (e.g., "2:00 PM – 4:00 PM")
 * - If only one time exists, show that time
 * - If neither exists, return empty string (caller can show date badge)
 */
export function formatWindow(start?: string | null, end?: string | null): string {
  const fmt = (ts?: string | null) => {
    if (!ts) return ''
    try {
      const date = new Date(ts)
      if (isNaN(date.getTime())) return ''
      return date.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
      })
    } catch {
      return ''
    }
  }

  const s = fmt(start)
  const e = fmt(end)

  // If both exist and are different, show range
  if (s && e && s !== e) {
    return `${s} – ${e}`
  }

  // If both exist and are the same, or only one exists, show single time
  if (s || e) {
    return s || e
  }

  // Neither exists
  return ''
}

/**
 * Format a date without time
 */
export function formatDate(dateStr?: string | null): string {
  if (!dateStr) return ''
  try {
    const date = new Date(dateStr)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return ''
  }
}
