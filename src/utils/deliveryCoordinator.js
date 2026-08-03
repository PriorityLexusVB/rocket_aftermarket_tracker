const DELIVERY_COORDINATOR_DEPARTMENTS = new Set([
  'delivery',
  'delivery coordinator',
  'delivery coordinators',
])
const DELIVERY_COORDINATOR_ROLES = new Set(['staff', 'manager', 'admin'])

export function isDeliveryCoordinator(profile) {
  const department = DELIVERY_COORDINATOR_DEPARTMENTS.has(
    String(profile?.department || '')
      .trim()
      .toLowerCase()
  )
  const role = DELIVERY_COORDINATOR_ROLES.has(
    String(profile?.role || '')
      .trim()
      .toLowerCase()
  )
  return department && role
}

export const deliveryCoordinatorDepartments = [
  'Delivery',
  'Delivery Coordinator',
  'Delivery Coordinators',
]
