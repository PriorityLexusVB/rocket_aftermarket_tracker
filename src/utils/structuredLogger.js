// src/utils/structuredLogger.js
// Structured logging utility for capability fallbacks and anomalies

/**
 * Log severity levels
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
  CRITICAL: 'critical',
}

/**
 * Log categories for better filtering
 */
export const LogCategory = {
  CAPABILITY_FALLBACK: 'capability_fallback',
  SCHEMA_ERROR: 'schema_error',
  DATABASE_ERROR: 'database_error',
  AUTHENTICATION: 'authentication',
  PERFORMANCE: 'performance',
  USER_ACTION: 'user_action',
}

/**
 * In-memory log buffer (max 100 entries)
 */
let logBuffer = []
const MAX_BUFFER_SIZE = 100

/**
 * Structured log entry
 * @typedef {Object} LogEntry
 * @property {string} timestamp - ISO timestamp
 * @property {string} level - Log level
 * @property {string} category - Log category
 * @property {string} message - Log message
 * @property {Object} context - Additional context
 * @property {string} [stackTrace] - Stack trace for errors
 */

/**
 * Log a structured message
 * @param {string} level - Log level (from LogLevel)
 * @param {string} category - Log category (from LogCategory)
 * @param {string} message - Log message
 * @param {Object} context - Additional context object
 */
export function log(level, category, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    category,
    message,
    context,
  }

  // Capture stack trace for errors
  if (level === LogLevel.ERROR || level === LogLevel.CRITICAL) {
    entry.stackTrace = new Error().stack
  }

  // Add to buffer
  logBuffer.push(entry)
  if (logBuffer.length > MAX_BUFFER_SIZE) {
    logBuffer.shift() // Remove oldest entry
  }

  // Also log to console with appropriate method
  const consoleMethod = level === LogLevel.ERROR || level === LogLevel.CRITICAL ? 'error' : level === LogLevel.WARN ? 'warn' : 'log'
  
  const prefix = `[${level.toUpperCase()}][${category}]`
  console[consoleMethod](prefix, message, context)

  // Try to persist critical logs to localStorage
  if (level === LogLevel.CRITICAL || level === LogLevel.ERROR) {
    try {
      if (typeof localStorage !== 'undefined') {
        const persistKey = 'logs_critical'
        const existing = JSON.parse(localStorage.getItem(persistKey) || '[]')
        existing.push(entry)
        // Keep only last 50 critical logs
        if (existing.length > 50) {
          existing.splice(0, existing.length - 50)
        }
        localStorage.setItem(persistKey, JSON.stringify(existing))
      }
    } catch (e) {
      // Ignore persistence errors
    }
  }
}

/**
 * Log capability fallback event
 * @param {string} capabilityName - Name of the capability that failed
 * @param {string} reason - Reason for fallback
 * @param {Object} context - Additional context
 */
export function logCapabilityFallback(capabilityName, reason, context = {}) {
  log(LogLevel.WARN, LogCategory.CAPABILITY_FALLBACK, `Capability fallback: ${capabilityName}`, {
    capabilityName,
    reason,
    ...context,
  })
}

/**
 * Log schema error
 * @param {string} errorType - Type of schema error
 * @param {string} message - Error message
 * @param {Object} context - Additional context
 */
export function logSchemaError(errorType, message, context = {}) {
  log(LogLevel.ERROR, LogCategory.SCHEMA_ERROR, message, {
    errorType,
    ...context,
  })
}

/**
 * Get all logs from buffer
 * @param {Object} filters - Optional filters (level, category, since)
 * @returns {Array<LogEntry>} - Filtered log entries
 */
export function getLogs(filters = {}) {
  let filtered = [...logBuffer]

  if (filters.level) {
    filtered = filtered.filter((entry) => entry.level === filters.level)
  }

  if (filters.category) {
    filtered = filtered.filter((entry) => entry.category === filters.category)
  }

  if (filters.since) {
    const sinceDate = new Date(filters.since)
    filtered = filtered.filter((entry) => new Date(entry.timestamp) >= sinceDate)
  }

  return filtered
}

/**
 * Get critical logs from localStorage
 * @returns {Array<LogEntry>} - Critical log entries
 */
export function getCriticalLogs() {
  try {
    if (typeof localStorage !== 'undefined') {
      const logs = JSON.parse(localStorage.getItem('logs_critical') || '[]')
      return logs
    }
  } catch (e) {
    console.warn('[structuredLogger] Failed to read critical logs:', e)
  }
  return []
}

/**
 * Clear log buffer
 */
export function clearLogs() {
  logBuffer = []
}

/**
 * Clear critical logs from localStorage
 */
export function clearCriticalLogs() {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('logs_critical')
    }
  } catch (e) {
    console.warn('[structuredLogger] Failed to clear critical logs:', e)
  }
}

/**
 * Export logs as JSON
 * @param {boolean} includeCritical - Include critical logs from localStorage
 * @returns {string} - JSON string of logs
 */
export function exportLogs(includeCritical = true) {
  const data = {
    timestamp: new Date().toISOString(),
    bufferLogs: logBuffer,
  }

  if (includeCritical) {
    data.criticalLogs = getCriticalLogs()
  }

  return JSON.stringify(data, null, 2)
}

/**
 * Get log statistics
 * @returns {Object} - Statistics about logs
 */
export function getLogStats() {
  const stats = {
    total: logBuffer.length,
    byLevel: {},
    byCategory: {},
    criticalCount: getCriticalLogs().length,
  }

  logBuffer.forEach((entry) => {
    stats.byLevel[entry.level] = (stats.byLevel[entry.level] || 0) + 1
    stats.byCategory[entry.category] = (stats.byCategory[entry.category] || 0) + 1
  })

  return stats
}
