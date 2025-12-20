// src/tests/capabilityTelemetry.enhanced.test.js
// Tests for enhanced telemetry features
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  TelemetryKey,
  incrementTelemetry,
  getTelemetry,
  resetAllTelemetry,
  exportTelemetry,
  importTelemetry,
  persistToLocalStorage,
  restoreFromLocalStorage,
  getTelemetrySummary,
} from '@/utils/capabilityTelemetry'

describe('Enhanced Telemetry Features', () => {
  beforeEach(() => {
    // Clear all storage before each test
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  afterEach(() => {
    // Clean up after each test
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.clear()
    }
  })

  describe('export/import functionality', () => {
    it('should export telemetry as JSON string', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)

      const exported = exportTelemetry()
      expect(exported).toBeTruthy()

      const parsed = JSON.parse(exported)
      expect(parsed.counters.vendorFallback).toBe(2)
      expect(parsed.counters.scheduledTimesFallback).toBe(1)
      expect(parsed.timestamp).toBeTruthy()
    })

    it('should import telemetry from JSON string', () => {
      const data = {
        timestamp: new Date().toISOString(),
        counters: {
          vendorFallback: 5,
          vendorIdFallback: 3,
          scheduledTimesFallback: 2,
        },
      }

      const success = importTelemetry(JSON.stringify(data))
      expect(success).toBe(true)

      expect(getTelemetry(TelemetryKey.VENDOR_FALLBACK)).toBe(5)
      expect(getTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)).toBe(3)
      expect(getTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)).toBe(2)
    })

    it('should handle invalid JSON during import', () => {
      const success = importTelemetry('invalid json')
      expect(success).toBe(false)
    })

    it('should handle empty counters object during import', () => {
      const data = { timestamp: new Date().toISOString() }
      const success = importTelemetry(JSON.stringify(data))
      expect(success).toBe(false)
    })
  })

  describe('localStorage persistence', () => {
    it('should persist sessionStorage to localStorage', () => {
      if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') {
        // Skip test in environments without storage
        return
      }

      sessionStorage.setItem(TelemetryKey.VENDOR_FALLBACK, '7')
      sessionStorage.setItem(TelemetryKey.VENDOR_ID_FALLBACK, '4')

      const success = persistToLocalStorage()
      expect(success).toBe(true)

      expect(localStorage.getItem(TelemetryKey.VENDOR_FALLBACK)).toBe('7')
      expect(localStorage.getItem(TelemetryKey.VENDOR_ID_FALLBACK)).toBe('4')
    })

    it('should restore from localStorage to sessionStorage', () => {
      if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') {
        return
      }

      localStorage.setItem(TelemetryKey.VENDOR_FALLBACK, '9')
      localStorage.setItem(TelemetryKey.SCHEDULED_TIMES_FALLBACK, '6')

      const success = restoreFromLocalStorage()
      expect(success).toBe(true)

      expect(sessionStorage.getItem(TelemetryKey.VENDOR_FALLBACK)).toBe('9')
      expect(sessionStorage.getItem(TelemetryKey.SCHEDULED_TIMES_FALLBACK)).toBe('6')
    })

    it('should handle missing values during persist', () => {
      if (typeof sessionStorage === 'undefined' || typeof localStorage === 'undefined') {
        return
      }

      const success = persistToLocalStorage()
      // Should return false if no values to persist
      expect(success).toBe(false)
    })
  })

  describe('telemetry summary', () => {
    it('should include storage type in summary', () => {
      const summary = getTelemetrySummary()
      expect(summary.storageType).toBeDefined()
      expect(['sessionStorage', 'localStorage', 'none']).toContain(summary.storageType)
    })

    it('should indicate session active status', () => {
      const summary = getTelemetrySummary()
      expect(typeof summary.sessionActive).toBe('boolean')
    })

    it('should track lastResetAt after full reset', () => {
      resetAllTelemetry()
      const summary = getTelemetrySummary()
      // lastResetAt may be null if storage not available; only assert when storage is present
      if (summary.sessionActive) {
        expect(summary.lastResetAt).toBeTruthy()
        expect(typeof summary.secondsSinceReset === 'number').toBe(true)
        expect(summary.secondsSinceReset).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('localStorage fallback', () => {
    it('should use storage when available', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      const value = getTelemetry(TelemetryKey.VENDOR_FALLBACK)
      expect(value).toBe(1)
    })

    it('should handle storage being unavailable gracefully', () => {
      // Mock storage being unavailable by clearing the reference
      const originalSessionStorage = global.sessionStorage
      const originalLocalStorage = global.localStorage

      try {
        global.sessionStorage = undefined
        global.localStorage = undefined

        // Should not throw errors
        incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
        const value = getTelemetry(TelemetryKey.VENDOR_FALLBACK)
        expect(value).toBe(0) // Should return 0 when storage unavailable
      } finally {
        global.sessionStorage = originalSessionStorage
        global.localStorage = originalLocalStorage
      }
    })
  })
})
