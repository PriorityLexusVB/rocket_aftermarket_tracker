import { describe, expect, it } from 'vitest'

import { buildUserProfileUpdateRequest } from '@/services/adminService'

describe('adminService user profile update request', () => {
  it('sends only the fields accepted by the trusted endpoint', () => {
    const request = buildUserProfileUpdateRequest('profile-1', {
      full_name: 'Sam Morgan',
      role: 'staff',
      department: 'Sales Consultants',
      phone: '555-0100',
      email: 'sam@example.com',
      dealer_id: 'must-not-reach-the-endpoint',
      org_id: 'must-not-reach-the-endpoint',
      auth_user_id: 'must-not-reach-the-endpoint',
      is_active: true,
      vendor_id: 'must-not-reach-the-endpoint',
    })

    expect(request).toEqual({
      action: 'update',
      profileId: 'profile-1',
      full_name: 'Sam Morgan',
      role: 'staff',
      department: 'Sales Consultants',
      phone: '555-0100',
      email: 'sam@example.com',
    })
    expect(request).not.toHaveProperty('dealer_id')
    expect(request).not.toHaveProperty('org_id')
    expect(request).not.toHaveProperty('auth_user_id')
    expect(request).not.toHaveProperty('is_active')
    expect(request).not.toHaveProperty('vendor_id')
  })
})
