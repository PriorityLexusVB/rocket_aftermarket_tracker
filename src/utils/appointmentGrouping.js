/**
 * Appointment Grouping Utilities
 *
 * Pure helper functions for grouping appointments by vendor or service type.
 * Used for calendar lane organization and appointment list rendering.
 */

/**
 * Group appointments by vendor
 * @param {Array} appointments - Array of appointment/job objects
 * @returns {Object} Map of vendorId -> array of appointments
 */
export function groupVendorJobs(appointments) {
  if (!Array.isArray(appointments)) {
    return {}
  }

  return appointments.reduce((acc, apt) => {
    if (!apt || !apt.id) return acc

    const vendorId = apt.vendor_id || 'unassigned'
    if (!acc[vendorId]) {
      acc[vendorId] = []
    }
    acc[vendorId].push(apt)
    return acc
  }, {})
}

/**
 * Group appointments by service type (onsite vs offsite)
 * @param {Array} appointments - Array of appointment/job objects
 * @returns {Object} Object with onsite and offsite arrays
 */
export function groupOnsiteJobs(appointments) {
  if (!Array.isArray(appointments)) {
    return { onsite: [], offsite: [] }
  }

  const onsite = []
  const offsite = []

  appointments.forEach((apt) => {
    if (!apt || !apt.id) return

    // is_off_site or service_type indicates offsite work
    if (apt.is_off_site === true || apt.service_type === 'vendor') {
      offsite.push(apt)
    } else {
      onsite.push(apt)
    }
  })

  return { onsite, offsite }
}

/**
 * Group appointments by both vendor and service type
 * Useful for complex calendar views with multiple lanes
 * @param {Array} appointments - Array of appointment/job objects
 * @returns {Object} Nested structure: serviceType -> vendorId -> appointments
 */
export function groupByVendorAndType(appointments) {
  if (!Array.isArray(appointments)) {
    return { onsite: {}, offsite: {} }
  }

  const { onsite, offsite } = groupOnsiteJobs(appointments)

  return {
    onsite: groupVendorJobs(onsite),
    offsite: groupVendorJobs(offsite),
  }
}
