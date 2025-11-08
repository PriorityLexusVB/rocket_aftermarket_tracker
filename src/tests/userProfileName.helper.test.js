import { describe, it, expect, beforeEach } from 'vitest'
import {
  setProfileCaps,
  buildUserProfileSelectFragment,
  resolveUserProfileName,
  getProfileCaps,
} from '@/utils/userProfileName'

// NOTE: These tests operate in a Node/Vitest environment; sessionStorage isn't available.
// setProfileCaps writes to sessionStorage only if defined, so no side-effects between tests.

function resetCaps() {
  // Re-enable all caps before each test
  setProfileCaps({ name: true, full_name: true, display_name: true })
}

describe('userProfileName helper', () => {
  beforeEach(resetCaps)

  describe('buildUserProfileSelectFragment', () => {
    it('prioritizes name when available', () => {
      setProfileCaps({ name: true, full_name: true, display_name: true })
      const frag = buildUserProfileSelectFragment()
      expect(frag).toBe('(id, name, email)')
    })

    it('falls back to full_name when name disabled', () => {
      setProfileCaps({ name: false, full_name: true, display_name: true })
      const frag = buildUserProfileSelectFragment()
      expect(frag).toBe('(id, full_name, email)')
    })

    it('falls back to display_name when both name and full_name disabled', () => {
      setProfileCaps({ name: false, full_name: false, display_name: true })
      const frag = buildUserProfileSelectFragment()
      expect(frag).toBe('(id, display_name, email)')
    })

    it('still returns id,email when all name columns disabled', () => {
      setProfileCaps({ name: false, full_name: false, display_name: false })
      const frag = buildUserProfileSelectFragment()
      expect(frag).toBe('(id, email)')
    })
  })

  describe('resolveUserProfileName', () => {
    it('returns name when present', () => {
      expect(resolveUserProfileName({ name: 'Alice', email: 'alice@example.com' })).toBe('Alice')
    })

    it('returns full_name when name missing', () => {
      expect(
        resolveUserProfileName({ full_name: 'Alice Smith', email: 'alice.smith@example.com' })
      ).toBe('Alice Smith')
    })

    it('returns display_name when name and full_name missing', () => {
      expect(
        resolveUserProfileName({ display_name: 'Alice S.', email: 'alice.s@example.com' })
      ).toBe('Alice S.')
    })

    it('returns email local-part when no name fields populated', () => {
      expect(resolveUserProfileName({ email: 'localpart@example.com' })).toBe('localpart')
    })

    it('returns null when no usable fields present', () => {
      expect(resolveUserProfileName({})).toBeNull()
      expect(resolveUserProfileName(null)).toBeNull()
    })
  })

  describe('caps interaction with getProfileCaps', () => {
    it('reflects current capability state', () => {
      setProfileCaps({ name: true, full_name: false, display_name: true })
      expect(getProfileCaps()).toEqual({ name: true, full_name: false, display_name: true })
    })
    it('updates after disabling all', () => {
      setProfileCaps({ name: false, full_name: false, display_name: false })
      expect(getProfileCaps()).toEqual({ name: false, full_name: false, display_name: false })
    })
  })
})
