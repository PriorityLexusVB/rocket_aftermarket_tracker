import { describe, expect, it } from 'vitest'
import { deliveryCoordinatorDepartments, isDeliveryCoordinator } from '@/utils/deliveryCoordinator'

describe('delivery coordinator normalization', () => {
  it.each([
    ['Delivery', 'staff'],
    ['Delivery Coordinator', 'admin'],
    ['Delivery Coordinators', 'manager'],
    [' delivery coordinators ', 'manager'],
  ])('recognizes %s for %s', (department, role) => {
    expect(isDeliveryCoordinator({ department, role })).toBe(true)
  })

  it('does not classify unrelated departments as delivery coordinators', () => {
    expect(isDeliveryCoordinator({ department: 'Finance Manager', role: 'manager' })).toBe(false)
    expect(isDeliveryCoordinator({ department: 'Delivery Coordinators', role: 'vendor' })).toBe(
      false
    )
    expect(isDeliveryCoordinator(null)).toBe(false)
  })

  it('keeps the supported persisted department variants queryable', () => {
    expect(deliveryCoordinatorDepartments).toEqual([
      'Delivery',
      'Delivery Coordinator',
      'Delivery Coordinators',
    ])
  })
})
