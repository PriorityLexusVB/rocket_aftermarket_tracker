// src/tests/schemaErrorClassifier.test.js
// Unit tests for schema error classification utility
import { describe, it, expect } from 'vitest'
import {
  classifySchemaError,
  SchemaErrorCode,
  isMissingColumnError,
  isMissingRelationshipError,
  isStaleCacheError,
} from '@/utils/schemaErrorClassifier'

describe('schemaErrorClassifier', () => {
  describe('classifySchemaError', () => {
    it('should classify missing column errors', () => {
      const error1 = new Error('column "vendor_id" does not exist')
      const error2 = new Error('PGRST202 column "xyz" not found')
      const error3 = 'column "nonexistent_field" does not exist'

      expect(classifySchemaError(error1)).toBe(SchemaErrorCode.MISSING_COLUMN)
      expect(classifySchemaError(error2)).toBe(SchemaErrorCode.MISSING_COLUMN)
      expect(classifySchemaError(error3)).toBe(SchemaErrorCode.MISSING_COLUMN)
    })

    it('should classify missing relationship errors', () => {
      const error1 = new Error(
        'Could not find a relationship between "job_parts" and "vendors" in the schema cache'
      )
      const error2 = new Error('relationship between tables not found in schema cache')

      expect(classifySchemaError(error1)).toBe(SchemaErrorCode.MISSING_FK)
      expect(classifySchemaError(error2)).toBe(SchemaErrorCode.MISSING_FK)
    })

    it('should classify stale cache errors', () => {
      const error1 = new Error('schema cache outdated')
      const error2 = new Error('Cached schema issue detected')

      expect(classifySchemaError(error1)).toBe(SchemaErrorCode.STALE_CACHE)
      expect(classifySchemaError(error2)).toBe(SchemaErrorCode.STALE_CACHE)
    })

    it('should classify generic errors', () => {
      const error1 = new Error('Network timeout')
      const error2 = new Error('Permission denied for table')
      const error3 = new Error('Connection refused')
      const error4 = ''

      expect(classifySchemaError(error1)).toBe(SchemaErrorCode.GENERIC)
      expect(classifySchemaError(error2)).toBe(SchemaErrorCode.GENERIC)
      expect(classifySchemaError(error3)).toBe(SchemaErrorCode.GENERIC)
      expect(classifySchemaError(error4)).toBe(SchemaErrorCode.GENERIC)
    })

    it('should handle string error messages', () => {
      const msg = 'column "test" does not exist'
      expect(classifySchemaError(msg)).toBe(SchemaErrorCode.MISSING_COLUMN)
    })

    it('should handle null and undefined', () => {
      expect(classifySchemaError(null)).toBe(SchemaErrorCode.GENERIC)
      expect(classifySchemaError(undefined)).toBe(SchemaErrorCode.GENERIC)
    })
  })

  describe('helper functions', () => {
    it('isMissingColumnError should work correctly', () => {
      const columnError = new Error('column "test" does not exist')
      const otherError = new Error('Could not find a relationship')

      expect(isMissingColumnError(columnError)).toBe(true)
      expect(isMissingColumnError(otherError)).toBe(false)
    })

    it('isMissingRelationshipError should work correctly', () => {
      const relationshipError = new Error(
        'Could not find a relationship between tables in the schema cache'
      )
      const otherError = new Error('column "test" does not exist')

      expect(isMissingRelationshipError(relationshipError)).toBe(true)
      expect(isMissingRelationshipError(otherError)).toBe(false)
    })

    it('isStaleCacheError should work correctly', () => {
      const cacheError = new Error('schema cache issue detected')
      const relationshipError = new Error('Could not find a relationship in the schema cache')
      const otherError = new Error('Network timeout')

      expect(isStaleCacheError(cacheError)).toBe(true)
      expect(isStaleCacheError(relationshipError)).toBe(false) // Classified as MISSING_FK
      expect(isStaleCacheError(otherError)).toBe(false)
    })
  })

  describe('edge cases', () => {
    it('should be case-insensitive', () => {
      const error1 = new Error('COLUMN "test" DOES NOT EXIST')
      const error2 = new Error('COULD NOT FIND A RELATIONSHIP')

      expect(classifySchemaError(error1)).toBe(SchemaErrorCode.MISSING_COLUMN)
      expect(classifySchemaError(error2)).toBe(SchemaErrorCode.MISSING_FK)
    })

    it('should handle error objects without message property', () => {
      const error = { code: 'SOME_CODE' }
      expect(classifySchemaError(error)).toBe(SchemaErrorCode.GENERIC)
    })

    it('should prioritize relationship errors over cache errors', () => {
      // When both patterns match, relationship error takes precedence
      const error = new Error('Could not find a relationship in the schema cache')
      expect(classifySchemaError(error)).toBe(SchemaErrorCode.MISSING_FK)
    })
  })
})
