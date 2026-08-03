import { describe, expect, it } from 'vitest'

import { buildUserAccountInvitePayload } from '@/pages/admin/userAccessPayloads'

describe('Admin User Accounts invite payload', () => {
  it('preserves the phone entered in the form through the service request', () => {
    expect(
      buildUserAccountInvitePayload(
        {
          email: 'sam@example.com',
          full_name: 'Sam Morgan',
          role: 'manager',
          department: 'Delivery Coordinators',
          phone: '555-0100',
        },
        'dealer-1'
      )
    ).toEqual({
      email: 'sam@example.com',
      full_name: 'Sam Morgan',
      role: 'manager',
      department: 'Delivery Coordinators',
      phone: '555-0100',
      dealer_id: 'dealer-1',
    })
  })
})
