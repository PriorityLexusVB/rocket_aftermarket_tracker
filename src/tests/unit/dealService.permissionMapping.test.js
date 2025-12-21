// src/tests/unit/dealService.permissionMapping.test.js
import { describe, it, expect } from 'vitest'
import { mapPermissionError } from '@/services/dealService'

describe('dealService - permission error mapping', () => {
  describe('mapPermissionError', () => {
    it('should map "permission denied for table users" to friendly guidance', () => {
      const mockError = new Error('permission denied for table users')

      expect(() => mapPermissionError(mockError)).toThrow(
        /Failed to save: RLS prevented update on auth\.users/
      )
      expect(() => mapPermissionError(mockError)).toThrow(/NOTIFY pgrst, 'reload schema'/)
      expect(() => mapPermissionError(mockError)).toThrow(
        /update policy to reference public\.user_profiles/
      )
      expect(() => mapPermissionError(mockError)).toThrow(/docs\/MCP-NOTES\.md/)
      expect(() => mapPermissionError(mockError)).toThrow(
        /\.artifacts\/mcp-introspect\/INTROSPECTION\.md/
      )
    })

    it('should map "permission denied for relation users" variant', () => {
      const mockError = new Error('permission denied for relation users')

      expect(() => mapPermissionError(mockError)).toThrow(
        /Failed to save: RLS prevented update on auth\.users/
      )
      expect(() => mapPermissionError(mockError)).toThrow(/NOTIFY pgrst/)
    })

    it('should handle case-insensitive matching', () => {
      const mockError = new Error('PERMISSION DENIED FOR TABLE USERS')

      expect(() => mapPermissionError(mockError)).toThrow(
        /Failed to save: RLS prevented update on auth\.users/
      )
    })

    it('should handle mixed case', () => {
      const mockError = new Error('Permission Denied for Table users')

      expect(() => mapPermissionError(mockError)).toThrow(
        /Failed to save: RLS prevented update on auth\.users/
      )
    })

    it('should include all remediation steps in message', () => {
      const mockError = new Error('permission denied for table users')

      try {
        mapPermissionError(mockError)
        throw new Error('Should have thrown')
      } catch (err) {
        const message = err.message
        expect(message).toContain('Failed to save')
        expect(message).toContain('RLS prevented update on auth.users')
        expect(message).toContain('Likely a policy references auth.users')
        expect(message).toContain("NOTIFY pgrst, 'reload schema'")
        expect(message).toContain('update policy to reference public.user_profiles')
        expect(message).toContain('tenant-scoped conditions')
        expect(message).toContain('docs/MCP-NOTES.md')
        expect(message).toContain('.artifacts/mcp-introspect/INTROSPECTION.md')
      }
    })

    it('should re-throw original error if not a known permission pattern', () => {
      const mockError = new Error('Some other database error')

      expect(() => mapPermissionError(mockError)).toThrow('Some other database error')
    })

    it('should re-throw errors that do not match permission denied pattern', () => {
      const mockError = new Error('duplicate key value violates unique constraint')

      expect(() => mapPermissionError(mockError)).toThrow(
        'duplicate key value violates unique constraint'
      )
    })

    it('should handle permission denied for other tables (not auth.users)', () => {
      const mockError = new Error('permission denied for table jobs')

      // Should re-throw as-is since it's not the specific auth.users pattern
      expect(() => mapPermissionError(mockError)).toThrow('permission denied for table jobs')
    })

    it('should handle error objects without message property', () => {
      const mockError = { code: 'PGRST000', details: 'some details' }

      expect(() => mapPermissionError(mockError)).toThrow()
    })

    it('should handle null or undefined errors gracefully', () => {
      expect(() => mapPermissionError(null)).toThrow()
      expect(() => mapPermissionError(undefined)).toThrow()
    })
  })

  describe('integration with wrapDbError pattern', () => {
    it('should provide consistent messaging for UPDATE operations', () => {
      const mockError = new Error('permission denied for table users')

      try {
        mapPermissionError(mockError)
        throw new Error('Should have thrown')
      } catch (err) {
        // Verify the error message is actionable
        expect(err.message).toMatch(/RLS prevented update/)
        expect(err.message).toMatch(/Remediation:/)
        expect(err.message).toMatch(/reload schema/)
      }
    })

    it('should provide consistent messaging for INSERT operations', () => {
      const mockError = new Error('INSERT failed: permission denied for table users')

      try {
        mapPermissionError(mockError)
        throw new Error('Should have thrown')
      } catch (err) {
        expect(err.message).toContain('RLS prevented update on auth.users')
      }
    })
  })

  describe('real-world error scenarios', () => {
    it('should handle Supabase PostgrestError format', () => {
      const mockError = {
        message: 'permission denied for table users',
        code: '42501',
        details: 'Policy violation',
        hint: 'Check RLS policies',
      }

      try {
        mapPermissionError(mockError)
        throw new Error('Should have thrown')
      } catch (err) {
        expect(err.message).toContain('Failed to save')
        expect(err.message).toContain('RLS prevented update')
      }
    })

    it('should handle errors with additional context', () => {
      const mockError = new Error(
        'Error updating job_parts: permission denied for table users at line 42'
      )

      try {
        mapPermissionError(mockError)
        throw new Error('Should have thrown')
      } catch (err) {
        expect(err.message).toContain('Failed to save')
        expect(err.message).toContain('NOTIFY pgrst')
      }
    })
  })

  describe('documentation references', () => {
    it('should reference both MCP-NOTES.md and INTROSPECTION.md', () => {
      const mockError = new Error('permission denied for table users')

      try {
        mapPermissionError(mockError)
        throw new Error('Should have thrown')
      } catch (err) {
        expect(err.message).toContain('docs/MCP-NOTES.md')
        expect(err.message).toContain('.artifacts/mcp-introspect/INTROSPECTION.md')
      }
    })

    it('should provide specific remediation steps', () => {
      const mockError = new Error('permission denied for table users')

      try {
        mapPermissionError(mockError)
        throw new Error('Should have thrown')
      } catch (err) {
        // Verify all key remediation steps are present
        const steps = [
          'NOTIFY pgrst',
          'reload schema',
          'update policy',
          'public.user_profiles',
          'tenant-scoped conditions',
        ]

        steps.forEach((step) => {
          expect(err.message).toContain(step)
        })
      }
    })
  })
})
