// src/tests/capabilityTelemetry.test.js
// Tests for capability telemetry utility
import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  incrementTelemetry,
  getTelemetry,
  getAllTelemetry,
  resetTelemetry,
  resetAllTelemetry,
  getTelemetrySummary,
  TelemetryKey,
} from '../utils/capabilityTelemetry'

describe('Capability Telemetry', () => {
  beforeEach(() => {
    // Clear sessionStorage before each test
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.clear()
    }
  })

  describe('incrementTelemetry', () => {
    it('should increment counter from 0 to 1', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      const value = getTelemetry(TelemetryKey.VENDOR_FALLBACK)
      expect(value).toBe(1)
    })

    it('should increment counter multiple times', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      const value = getTelemetry(TelemetryKey.VENDOR_FALLBACK)
      expect(value).toBe(3)
    })

    it('should handle different counters independently', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
      
      expect(getTelemetry(TelemetryKey.VENDOR_FALLBACK)).toBe(2)
      expect(getTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)).toBe(1)
    })
  })

  describe('getTelemetry', () => {
    it('should return 0 for uninitialized counter', () => {
      const value = getTelemetry(TelemetryKey.VENDOR_FALLBACK)
      expect(value).toBe(0)
    })

    it('should return correct value after increments', () => {
      incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
      incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
      const value = getTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
      expect(value).toBe(2)
    })

    it('should handle invalid key gracefully', () => {
      const value = getTelemetry('invalid_key')
      expect(value).toBe(0)
    })
  })

  describe('getAllTelemetry', () => {
    it('should return all counters with default values', () => {
      const telemetry = getAllTelemetry()
      expect(telemetry).toEqual({
        vendorFallback: 0,
        vendorIdFallback: 0,
        vendorRelFallback: 0,
        scheduledTimesFallback: 0,
        userProfileNameFallback: 0,
        rlsLoanerDenied: 0,
      })
    })

    it('should return all counters with actual values', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
      
      const telemetry = getAllTelemetry()
      expect(telemetry.vendorFallback).toBe(1)
      expect(telemetry.vendorIdFallback).toBe(2)
      expect(telemetry.vendorRelFallback).toBe(0)
    })
  })

  describe('resetTelemetry', () => {
    it('should reset specific counter to 0', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      expect(getTelemetry(TelemetryKey.VENDOR_FALLBACK)).toBe(2)
      
      resetTelemetry(TelemetryKey.VENDOR_FALLBACK)
      expect(getTelemetry(TelemetryKey.VENDOR_FALLBACK)).toBe(0)
    })

    it('should not affect other counters', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
      
      resetTelemetry(TelemetryKey.VENDOR_FALLBACK)
      
      expect(getTelemetry(TelemetryKey.VENDOR_FALLBACK)).toBe(0)
      expect(getTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)).toBe(1)
    })
  })

  describe('resetAllTelemetry', () => {
    it('should reset all counters to 0', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_ID_FALLBACK)
      incrementTelemetry(TelemetryKey.VENDOR_REL_FALLBACK)
      incrementTelemetry(TelemetryKey.SCHEDULED_TIMES_FALLBACK)
      
      resetAllTelemetry()
      
      const telemetry = getAllTelemetry()
      expect(telemetry.vendorFallback).toBe(0)
      expect(telemetry.vendorIdFallback).toBe(0)
      expect(telemetry.vendorRelFallback).toBe(0)
      expect(telemetry.scheduledTimesFallback).toBe(0)
    })
  })

  describe('getTelemetrySummary', () => {
    it('should return summary with timestamp', () => {
      const summary = getTelemetrySummary()
      expect(summary).toHaveProperty('timestamp')
      expect(summary).toHaveProperty('counters')
      expect(summary).toHaveProperty('sessionActive')
      expect(typeof summary.timestamp).toBe('string')
      expect(typeof summary.sessionActive).toBe('boolean')
    })

    it('should include all counters in summary', () => {
      incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      const summary = getTelemetrySummary()
      
      expect(summary.counters).toHaveProperty('vendorFallback')
      expect(summary.counters).toHaveProperty('vendorIdFallback')
      expect(summary.counters).toHaveProperty('vendorRelFallback')
      expect(summary.counters).toHaveProperty('scheduledTimesFallback')
      expect(summary.counters.vendorFallback).toBe(1)
    })

    it('should have valid ISO timestamp format', () => {
      const summary = getTelemetrySummary()
      const timestamp = new Date(summary.timestamp)
      expect(timestamp.toString()).not.toBe('Invalid Date')
    })

    it('should include lastResetAt and secondsSinceReset fields', () => {
      const summary = getTelemetrySummary()
      expect(summary).toHaveProperty('lastResetAt')
      expect(summary).toHaveProperty('secondsSinceReset')
    })

    it('should have null lastResetAt before any reset', () => {
      const summary = getTelemetrySummary()
      expect(summary.lastResetAt).toBeNull()
      expect(summary.secondsSinceReset).toBeNull()
    })

    it('should set lastResetAt timestamp after resetAllTelemetry', () => {
      const beforeReset = Date.now()
      resetAllTelemetry()
      const summary = getTelemetrySummary()
      
      expect(summary.lastResetAt).not.toBeNull()
      expect(typeof summary.lastResetAt).toBe('string')
      
      // Verify it's a valid ISO timestamp
      const resetDate = new Date(summary.lastResetAt)
      expect(resetDate.toString()).not.toBe('Invalid Date')
      
      // Verify the timestamp is recent (within last second)
      expect(resetDate.getTime()).toBeGreaterThanOrEqual(beforeReset)
      expect(resetDate.getTime()).toBeLessThanOrEqual(Date.now() + 1000)
    })

    it('should calculate secondsSinceReset correctly', () => {
      resetAllTelemetry()
      
      // Get summary immediately
      const summary = getTelemetrySummary()
      
      expect(summary.secondsSinceReset).not.toBeNull()
      expect(typeof summary.secondsSinceReset).toBe('number')
      
      // Should be very recent (0-2 seconds to account for processing time)
      expect(summary.secondsSinceReset).toBeGreaterThanOrEqual(0)
      expect(summary.secondsSinceReset).toBeLessThan(3)
    })
  })

  describe('TelemetryKey constants', () => {
    it('should have all expected keys', () => {
      expect(TelemetryKey).toHaveProperty('VENDOR_FALLBACK')
      expect(TelemetryKey).toHaveProperty('VENDOR_ID_FALLBACK')
      expect(TelemetryKey).toHaveProperty('VENDOR_REL_FALLBACK')
      expect(TelemetryKey).toHaveProperty('SCHEDULED_TIMES_FALLBACK')
      expect(TelemetryKey).toHaveProperty('USER_PROFILE_NAME_FALLBACK')
    })

    it('should have unique values for each key', () => {
      const values = Object.values(TelemetryKey)
      const uniqueValues = new Set(values)
      expect(uniqueValues.size).toBe(values.length)
    })
  })

  describe('Edge cases', () => {
    it('should handle concurrent increments correctly', () => {
      // Simulate multiple rapid increments
      for (let i = 0; i < 10; i++) {
        incrementTelemetry(TelemetryKey.VENDOR_FALLBACK)
      }
      expect(getTelemetry(TelemetryKey.VENDOR_FALLBACK)).toBe(10)
    })

    it('should handle string numbers in sessionStorage', () => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(TelemetryKey.VENDOR_FALLBACK, '5')
        const value = getTelemetry(TelemetryKey.VENDOR_FALLBACK)
        expect(value).toBe(5)
      }
    })

    it('should handle invalid string in sessionStorage', () => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(TelemetryKey.VENDOR_FALLBACK, 'invalid')
        const value = getTelemetry(TelemetryKey.VENDOR_FALLBACK)
        expect(value).toBe(0) // Should fallback to 0 for NaN
      }
    })
  })
})
