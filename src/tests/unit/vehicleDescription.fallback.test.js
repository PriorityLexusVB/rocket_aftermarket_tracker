// src/tests/unit/vehicleDescription.fallback.test.js
/**
 * Vehicle Description Fallback Test Suite
 * 
 * This test file explicitly verifies the vehicle description fallback logic
 * as specified in Task 2 of the RLS & Reliability Hardening initiative.
 * 
 * The tests verify that deriveVehicleDescription() correctly implements the priority:
 * 1. Non-generic title (when deal.title doesn't match /^(Deal\s+[\w-]+|Untitled Deal)$/i)
 * 2. Vehicle fields (year, make, model) formatted as "YYYY Make Model"
 * 3. Empty string (when neither title nor vehicle fields are available)
 * 
 * Note: vehicle_description is a COMPUTED field (not stored in DB).
 * It's derived on-the-fly in dealService functions.
 */

import { describe, it, expect } from 'vitest'
import { deriveVehicleDescription } from '@/services/dealService'

describe('Vehicle Description Fallback Logic', () => {
  describe('Priority 1: Non-generic title takes precedence', () => {
    it('should use custom title when provided', () => {
      const deal = {
        title: '2015 Honda Civic Repair',
        vehicle_year: null,
        vehicle_make: null,
        vehicle_model: null,
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2015 Honda Civic Repair')
    })

    it('should use title even when vehicle fields are present', () => {
      const deal = {
        title: 'Custom Job Name',
        vehicle_year: 2020,
        vehicle_make: 'Toyota',
        vehicle_model: 'Camry',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('Custom Job Name')
    })

    it('should NOT use generic "Deal XXX" pattern - fall through to vehicle fields', () => {
      const deal = {
        title: 'Deal ABC-123',
        vehicle_year: 2020,
        vehicle_make: 'Ford',
        vehicle_model: 'F-150',
      }

      const result = deriveVehicleDescription(deal)

      // Should fall through to vehicle fields since "Deal XXX" is generic
      expect(result).toBe('2020 Ford F-150')
    })

    it('should NOT use "Untitled Deal" - fall through to vehicle fields', () => {
      const deal = {
        title: 'Untitled Deal',
        vehicle_year: 2019,
        vehicle_make: 'Chevrolet',
        vehicle_model: 'Silverado',
      }

      const result = deriveVehicleDescription(deal)

      // Should fall through to vehicle fields since "Untitled Deal" is generic
      expect(result).toBe('2019 Chevrolet Silverado')
    })
  })

  describe('Priority 2: Vehicle fields (year make model)', () => {
    it('should format as "YYYY Make Model" when all fields present', () => {
      const deal = {
        title: null,
        vehicle_year: 2021,
        vehicle_make: 'Nissan',
        vehicle_model: 'Altima',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2021 Nissan Altima')
    })

    it('should handle partial vehicle fields (year + make only)', () => {
      const deal = {
        title: null,
        vehicle_year: 2018,
        vehicle_make: 'Honda',
        vehicle_model: null,
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2018 Honda')
    })

    it('should handle partial vehicle fields (make + model only)', () => {
      const deal = {
        title: null,
        vehicle_year: null,
        vehicle_make: 'Mazda',
        vehicle_model: 'CX-5',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('Mazda CX-5')
    })

    it('should handle single vehicle field (make only)', () => {
      const deal = {
        title: null,
        vehicle_year: null,
        vehicle_make: 'Subaru',
        vehicle_model: null,
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('Subaru')
    })

    it('should use vehicle fields when title is generic "Deal" pattern', () => {
      const deal = {
        title: 'Deal 12345',
        vehicle_year: 2022,
        vehicle_make: 'Kia',
        vehicle_model: 'Sorento',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2022 Kia Sorento')
    })

    it('should use vehicle fields when title is "Untitled Deal"', () => {
      const deal = {
        title: 'Untitled Deal',
        vehicle_year: 2023,
        vehicle_make: 'Hyundai',
        vehicle_model: 'Tucson',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2023 Hyundai Tucson')
    })
  })

  describe('Priority 3: Empty string fallback', () => {
    it('should return empty string when no title and no vehicle fields', () => {
      const deal = {
        title: null,
        vehicle_year: null,
        vehicle_make: null,
        vehicle_model: null,
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('')
    })

    it('should return empty string when title is generic and no vehicle fields', () => {
      const deal = {
        title: 'Deal ABC',
        vehicle_year: null,
        vehicle_make: null,
        vehicle_model: null,
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('')
    })

    it('should return empty string when title is "Untitled Deal" and no vehicle fields', () => {
      const deal = {
        title: 'Untitled Deal',
        vehicle_year: null,
        vehicle_make: null,
        vehicle_model: null,
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('')
    })
  })

  describe('Generic title regex pattern verification', () => {
    it('should recognize "Deal [ID]" as generic', () => {
      const genericTitles = [
        'Deal 123',
        'Deal ABC-456',
        'Deal xyz-789',
        'deal 999', // case insensitive
      ]

      genericTitles.forEach(title => {
        const deal = {
          title,
          vehicle_year: 2020,
          vehicle_make: 'Toyota',
          vehicle_model: 'Corolla',
        }
        const result = deriveVehicleDescription(deal)
        expect(result).toBe('2020 Toyota Corolla')
      })
    })

    it('should recognize "Untitled Deal" as generic', () => {
      const deal = {
        title: 'Untitled Deal',
        vehicle_year: 2021,
        vehicle_make: 'Honda',
        vehicle_model: 'Accord',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2021 Honda Accord')
    })

    it('should NOT treat custom titles as generic', () => {
      const customTitles = [
        'Oil Change Service',
        'Brake Repair - Urgent',
        '2015 Honda Civic Maintenance',
      ]

      customTitles.forEach(title => {
        const deal = {
          title,
          vehicle_year: 2020,
          vehicle_make: 'Ford',
          vehicle_model: 'Focus',
        }
        const result = deriveVehicleDescription(deal)
        expect(result).toBe(title) // Should use the custom title
      })
    })
  })

  describe('Edge cases and data validation', () => {
    it('should handle undefined deal object gracefully', () => {
      const result = deriveVehicleDescription(undefined)
      expect(result).toBe('')
    })

    it('should handle null deal object gracefully', () => {
      const result = deriveVehicleDescription(null)
      expect(result).toBe('')
    })

    it('should handle empty object', () => {
      const result = deriveVehicleDescription({})
      expect(result).toBe('')
    })

    it('should trim whitespace from vehicle fields', () => {
      const deal = {
        title: null,
        vehicle_year: 2020,
        vehicle_make: '  Toyota  ',
        vehicle_model: '  Camry  ',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2020 Toyota Camry')
    })

    it('should handle numeric year as number', () => {
      const deal = {
        title: null,
        vehicle_year: 2020,
        vehicle_make: 'Lexus',
        vehicle_model: 'RX',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2020 Lexus RX')
    })

    it('should handle year as string', () => {
      const deal = {
        title: null,
        vehicle_year: '2019',
        vehicle_make: 'BMW',
        vehicle_model: 'X5',
      }

      const result = deriveVehicleDescription(deal)

      expect(result).toBe('2019 BMW X5')
    })
  })
})
