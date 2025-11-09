// src/tests/structuredLogger.test.js
// Tests for structured logging utility
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  LogLevel,
  LogCategory,
  log,
  logCapabilityFallback,
  logSchemaError,
  getLogs,
  getCriticalLogs,
  clearLogs,
  clearCriticalLogs,
  exportLogs,
  getLogStats,
} from '@/utils/structuredLogger'

describe('Structured Logger', () => {
  beforeEach(() => {
    clearLogs()
    clearCriticalLogs()
  })

  afterEach(() => {
    clearLogs()
    clearCriticalLogs()
  })

  describe('basic logging', () => {
    it('should log messages with correct structure', () => {
      log(LogLevel.INFO, LogCategory.USER_ACTION, 'Test message', { userId: 123 })

      const logs = getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe(LogLevel.INFO)
      expect(logs[0].category).toBe(LogCategory.USER_ACTION)
      expect(logs[0].message).toBe('Test message')
      expect(logs[0].context.userId).toBe(123)
      expect(logs[0].timestamp).toBeTruthy()
    })

    it('should include stack trace for errors', () => {
      log(LogLevel.ERROR, LogCategory.DATABASE_ERROR, 'Database error', {})

      const logs = getLogs()
      expect(logs[0].stackTrace).toBeTruthy()
    })

    it('should include stack trace for critical logs', () => {
      log(LogLevel.CRITICAL, LogCategory.SCHEMA_ERROR, 'Critical error', {})

      const logs = getLogs()
      expect(logs[0].stackTrace).toBeTruthy()
    })

    it('should not include stack trace for non-error logs', () => {
      log(LogLevel.INFO, LogCategory.USER_ACTION, 'Info message', {})

      const logs = getLogs()
      expect(logs[0].stackTrace).toBeUndefined()
    })
  })

  describe('specialized logging functions', () => {
    it('should log capability fallback', () => {
      logCapabilityFallback('vendorRelationship', 'Missing FK', { table: 'job_parts' })

      const logs = getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe(LogLevel.WARN)
      expect(logs[0].category).toBe(LogCategory.CAPABILITY_FALLBACK)
      expect(logs[0].context.capabilityName).toBe('vendorRelationship')
      expect(logs[0].context.reason).toBe('Missing FK')
    })

    it('should log schema error', () => {
      logSchemaError('MISSING_COLUMN', 'Column not found', { column: 'vendor_id' })

      const logs = getLogs()
      expect(logs.length).toBe(1)
      expect(logs[0].level).toBe(LogLevel.ERROR)
      expect(logs[0].category).toBe(LogCategory.SCHEMA_ERROR)
      expect(logs[0].context.errorType).toBe('MISSING_COLUMN')
    })
  })

  describe('log filtering', () => {
    beforeEach(() => {
      log(LogLevel.INFO, LogCategory.USER_ACTION, 'Info 1', {})
      log(LogLevel.ERROR, LogCategory.DATABASE_ERROR, 'Error 1', {})
      log(LogLevel.WARN, LogCategory.CAPABILITY_FALLBACK, 'Warning 1', {})
      log(LogLevel.INFO, LogCategory.USER_ACTION, 'Info 2', {})
    })

    it('should filter by level', () => {
      const errorLogs = getLogs({ level: LogLevel.ERROR })
      expect(errorLogs.length).toBe(1)
      expect(errorLogs[0].message).toBe('Error 1')
    })

    it('should filter by category', () => {
      const userActionLogs = getLogs({ category: LogCategory.USER_ACTION })
      expect(userActionLogs.length).toBe(2)
    })

    it('should filter by timestamp', () => {
      const now = new Date()
      const future = new Date(now.getTime() + 1000)

      const futureLogs = getLogs({ since: future.toISOString() })
      expect(futureLogs.length).toBe(0)
    })
  })

  describe('log buffer management', () => {
    it('should maintain buffer with maximum size', () => {
      // Log more than MAX_BUFFER_SIZE (100)
      for (let i = 0; i < 150; i++) {
        log(LogLevel.INFO, LogCategory.USER_ACTION, `Message ${i}`, {})
      }

      const logs = getLogs()
      expect(logs.length).toBeLessThanOrEqual(100)

      // Should keep most recent logs
      expect(logs[logs.length - 1].message).toBe('Message 149')
    })

    it('should clear log buffer', () => {
      log(LogLevel.INFO, LogCategory.USER_ACTION, 'Test', {})
      expect(getLogs().length).toBe(1)

      clearLogs()
      expect(getLogs().length).toBe(0)
    })
  })

  describe('critical logs persistence', () => {
    it('should persist critical logs to localStorage', () => {
      if (typeof localStorage === 'undefined') {
        return // Skip in environments without localStorage
      }

      log(LogLevel.CRITICAL, LogCategory.SCHEMA_ERROR, 'Critical error', {})

      const criticalLogs = getCriticalLogs()
      expect(criticalLogs.length).toBeGreaterThan(0)
      expect(criticalLogs[0].level).toBe(LogLevel.CRITICAL)
    })

    it('should persist error logs to localStorage', () => {
      if (typeof localStorage === 'undefined') {
        return
      }

      log(LogLevel.ERROR, LogCategory.DATABASE_ERROR, 'Database error', {})

      const criticalLogs = getCriticalLogs()
      expect(criticalLogs.length).toBeGreaterThan(0)
    })

    it('should clear critical logs', () => {
      if (typeof localStorage === 'undefined') {
        return
      }

      log(LogLevel.CRITICAL, LogCategory.SCHEMA_ERROR, 'Critical', {})
      expect(getCriticalLogs().length).toBeGreaterThan(0)

      clearCriticalLogs()
      expect(getCriticalLogs().length).toBe(0)
    })
  })

  describe('log export', () => {
    it('should export logs as JSON', () => {
      log(LogLevel.INFO, LogCategory.USER_ACTION, 'Test', {})
      log(LogLevel.ERROR, LogCategory.DATABASE_ERROR, 'Error', {})

      const exported = exportLogs(false)
      expect(exported).toBeTruthy()

      const parsed = JSON.parse(exported)
      expect(parsed.bufferLogs.length).toBe(2)
      expect(parsed.timestamp).toBeTruthy()
    })

    it('should include critical logs when requested', () => {
      if (typeof localStorage === 'undefined') {
        return
      }

      log(LogLevel.CRITICAL, LogCategory.SCHEMA_ERROR, 'Critical', {})

      const exported = exportLogs(true)
      const parsed = JSON.parse(exported)

      expect(parsed.criticalLogs).toBeDefined()
      expect(parsed.criticalLogs.length).toBeGreaterThan(0)
    })
  })

  describe('log statistics', () => {
    beforeEach(() => {
      log(LogLevel.INFO, LogCategory.USER_ACTION, 'Info 1', {})
      log(LogLevel.INFO, LogCategory.USER_ACTION, 'Info 2', {})
      log(LogLevel.ERROR, LogCategory.DATABASE_ERROR, 'Error 1', {})
      log(LogLevel.WARN, LogCategory.CAPABILITY_FALLBACK, 'Warning 1', {})
      log(LogLevel.CRITICAL, LogCategory.SCHEMA_ERROR, 'Critical 1', {})
    })

    it('should calculate total logs', () => {
      const stats = getLogStats()
      expect(stats.total).toBe(5)
    })

    it('should count logs by level', () => {
      const stats = getLogStats()
      expect(stats.byLevel[LogLevel.INFO]).toBe(2)
      expect(stats.byLevel[LogLevel.ERROR]).toBe(1)
      expect(stats.byLevel[LogLevel.WARN]).toBe(1)
      expect(stats.byLevel[LogLevel.CRITICAL]).toBe(1)
    })

    it('should count logs by category', () => {
      const stats = getLogStats()
      expect(stats.byCategory[LogCategory.USER_ACTION]).toBe(2)
      expect(stats.byCategory[LogCategory.DATABASE_ERROR]).toBe(1)
      expect(stats.byCategory[LogCategory.CAPABILITY_FALLBACK]).toBe(1)
      expect(stats.byCategory[LogCategory.SCHEMA_ERROR]).toBe(1)
    })

    it('should include critical log count', () => {
      const stats = getLogStats()
      expect(stats.criticalCount).toBeGreaterThanOrEqual(0)
    })
  })
})
