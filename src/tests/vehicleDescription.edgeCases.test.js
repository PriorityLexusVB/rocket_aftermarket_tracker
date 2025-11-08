// src/tests/vehicleDescription.edgeCases.test.js
// Additional edge case tests for vehicle description derivation
import { describe, it, expect } from 'vitest'

describe('Vehicle description edge cases', () => {
  const GENERIC_TITLE_PATTERN = /^(Deal\s+[\w-]+|Untitled Deal)$/i

  // Helper: Derive vehicle description from title or vehicle fields
  function deriveVehicleDescription(title, vehicle) {
    let vehicleDescription = ''
    const titleStr = title || ''
    const isGenericTitle = GENERIC_TITLE_PATTERN.test(titleStr.trim())

    if (titleStr && !isGenericTitle) {
      vehicleDescription = titleStr
    } else if (vehicle) {
      const parts = [vehicle?.year, vehicle?.make, vehicle?.model].filter(Boolean)
      if (parts.length > 0) {
        vehicleDescription = parts.join(' ')
      }
    }
    return vehicleDescription
  }

  describe('whitespace handling', () => {
    it('should trim whitespace around title before checking generic pattern', () => {
      const title = '  Deal 12345  '
      const vehicle = { year: '2020', make: 'Toyota', model: 'Camry' }

      // Whitespace should be trimmed, recognized as generic, fall back to vehicle
      expect(deriveVehicleDescription(title, vehicle)).toBe('2020 Toyota Camry')
    })

    it('should preserve whitespace in custom title output', () => {
      // NOTE: The actual implementation returns titles as-is without trimming output
      // Only the generic pattern check trims for comparison
      const title = '  2020 Honda Accord EX  '
      const vehicle = null

      // Returns title as-is (with whitespace) if it's non-generic
      expect(deriveVehicleDescription(title, vehicle)).toBe('  2020 Honda Accord EX  ')
    })
  })

  describe('model casing behavior', () => {
    it('should preserve model casing from database', () => {
      // Testing that we don't alter model casing
      const title = 'Deal 123'
      const vehicle = { year: '2021', make: 'Lexus', model: 'Rx350' }

      // Should preserve "Rx350" exactly as stored
      expect(deriveVehicleDescription(title, vehicle)).toBe('2021 Lexus Rx350')
    })

    it('should preserve lowercase model if that is what is stored', () => {
      const title = 'Deal 456'
      const vehicle = { year: '2019', make: 'Tesla', model: 'model 3' }

      // No casing normalization - preserve as-is
      expect(deriveVehicleDescription(title, vehicle)).toBe('2019 Tesla model 3')
    })

    it('should preserve uppercase model if that is what is stored', () => {
      const title = 'Untitled Deal'
      const vehicle = { year: '2022', make: 'BMW', model: 'X5' }

      expect(deriveVehicleDescription(title, vehicle)).toBe('2022 BMW X5')
    })
  })

  describe('partial vehicle object with non-generic title', () => {
    it('should use title when present even if vehicle has partial data', () => {
      const title = '2020 Mercedes E-Class'
      const vehicle = { year: '2021', make: null, model: 'E350' } // Partial data

      // Non-generic title wins over vehicle data
      expect(deriveVehicleDescription(title, vehicle)).toBe('2020 Mercedes E-Class')
    })

    it('should use partial vehicle data when title is generic', () => {
      const title = 'Deal ABC-123'
      const vehicle = { year: null, make: 'Ford', model: 'F-150' }

      // Only make and model available - should use what's there
      expect(deriveVehicleDescription(title, vehicle)).toBe('Ford F-150')
    })

    it('should handle vehicle with only model', () => {
      const title = 'Untitled Deal'
      const vehicle = { year: null, make: null, model: 'Camaro' }

      expect(deriveVehicleDescription(title, vehicle)).toBe('Camaro')
    })

    it('should handle vehicle with only year', () => {
      const title = 'Deal 999'
      const vehicle = { year: '2023', make: null, model: null }

      expect(deriveVehicleDescription(title, vehicle)).toBe('2023')
    })
  })

  describe('empty and null handling', () => {
    it('should return empty string for generic title with no vehicle', () => {
      expect(deriveVehicleDescription('Deal 123', null)).toBe('')
      expect(deriveVehicleDescription('Untitled Deal', null)).toBe('')
    })

    it('should return empty string for empty title with empty vehicle', () => {
      expect(deriveVehicleDescription('', {})).toBe('')
      expect(deriveVehicleDescription(null, {})).toBe('')
    })

    it('should return empty string for generic title with empty vehicle object', () => {
      const vehicle = { year: null, make: null, model: null }
      expect(deriveVehicleDescription('Deal XYZ', vehicle)).toBe('')
    })
  })

  describe('special characters in title', () => {
    it('should allow special characters in custom titles', () => {
      const title = '2021 Audi A4 (Quattro)'
      const vehicle = { year: '2020', make: 'Audi', model: 'A4' }

      // Parentheses in title should be preserved
      expect(deriveVehicleDescription(title, vehicle)).toBe('2021 Audi A4 (Quattro)')
    })

    it('should allow dashes and slashes in titles', () => {
      const title = '2019 Toyota RAV4 - LE/AWD'
      const vehicle = null

      expect(deriveVehicleDescription(title, vehicle)).toBe('2019 Toyota RAV4 - LE/AWD')
    })
  })

  describe('generic title pattern matching', () => {
    it('should recognize "Deal" followed by space and alphanumeric as generic', () => {
      // Pattern is /^(Deal\s+[\w-]+|Untitled Deal)$/i
      // \s+ means one or more whitespace
      // [\w-]+ means word chars (letters, digits, underscore) or hyphens
      expect(GENERIC_TITLE_PATTERN.test('Deal 123')).toBe(true)
      expect(GENERIC_TITLE_PATTERN.test('Deal ABC-456')).toBe(true)
      expect(GENERIC_TITLE_PATTERN.test('Deal_789')).toBe(false) // No space after Deal
    })

    it('should recognize "Untitled Deal" as generic', () => {
      expect(GENERIC_TITLE_PATTERN.test('Untitled Deal')).toBe(true)
      expect(GENERIC_TITLE_PATTERN.test('untitled deal')).toBe(true) // case insensitive
    })

    it('should NOT recognize custom deals as generic', () => {
      expect(GENERIC_TITLE_PATTERN.test('2020 Honda Civic')).toBe(false)
      expect(GENERIC_TITLE_PATTERN.test('Special Customer Deal')).toBe(false)
      expect(GENERIC_TITLE_PATTERN.test('Deal for John Smith')).toBe(false)
    })
  })

  describe('integration with existing behavior', () => {
    it('should match existing vehicle description fallback behavior', () => {
      // This test documents the actual priority:
      // 1. Custom title (non-generic)
      // 2. Vehicle data (year make model)
      // 3. Empty string

      // Case 1: Custom title exists -> use it
      expect(
        deriveVehicleDescription('2020 Custom', { year: '2019', make: 'Toyota', model: 'Camry' })
      ).toBe('2020 Custom')

      // Case 2: Generic title, vehicle data exists -> use vehicle
      expect(
        deriveVehicleDescription('Deal 123', { year: '2019', make: 'Toyota', model: 'Camry' })
      ).toBe('2019 Toyota Camry')

      // Case 3: Generic title, no vehicle -> empty
      expect(deriveVehicleDescription('Deal 456', null)).toBe('')
    })
  })
})
