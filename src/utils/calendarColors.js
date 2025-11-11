/**
 * Calendar Color Mapping Utilities
 * 
 * Deterministic color assignment for calendar events based on service type and status.
 * Ensures visual consistency and lane clarity in calendar views.
 */

/**
 * Service type color mappings
 * These colors provide visual distinction between onsite and vendor work
 */
const SERVICE_TYPE_COLORS = {
  onsite: {
    bg: 'bg-blue-100',
    border: 'border-blue-300',
    text: 'text-blue-900',
    gradient: 'from-blue-500 to-blue-600',
    hex: '#3B82F6', // blue-500
  },
  vendor: {
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-900',
    gradient: 'from-purple-500 to-purple-600',
    hex: '#A855F7', // purple-500
  },
  offsite: {
    // Alias for vendor
    bg: 'bg-purple-100',
    border: 'border-purple-300',
    text: 'text-purple-900',
    gradient: 'from-purple-500 to-purple-600',
    hex: '#A855F7', // purple-500
  },
}

/**
 * Status-based color overlays (applied on top of service type colors)
 */
const STATUS_OVERLAYS = {
  scheduled: {
    opacity: 'opacity-90',
    badge: 'bg-blue-500 text-white',
  },
  in_progress: {
    opacity: 'opacity-100',
    badge: 'bg-orange-500 text-white',
    pulse: true,
  },
  completed: {
    opacity: 'opacity-60',
    badge: 'bg-green-500 text-white',
  },
  quality_check: {
    opacity: 'opacity-80',
    badge: 'bg-green-400 text-white',
  },
}

/**
 * Get color classes for a calendar event based on service type and status
 * @param {string} serviceType - 'onsite', 'vendor', or 'offsite'
 * @param {string} jobStatus - Job status like 'scheduled', 'in_progress', etc.
 * @returns {Object} Color classes and metadata
 */
export function getEventColors(serviceType, jobStatus) {
  // Default to onsite if not specified
  const type = serviceType === 'vendor' || serviceType === 'offsite' ? serviceType : 'onsite'
  const colors = SERVICE_TYPE_COLORS[type]
  const statusOverlay = STATUS_OVERLAYS[jobStatus] || STATUS_OVERLAYS.scheduled

  return {
    bg: colors.bg,
    border: colors.border,
    text: colors.text,
    gradient: colors.gradient,
    hex: colors.hex,
    opacity: statusOverlay.opacity,
    badge: statusOverlay.badge,
    pulse: statusOverlay.pulse || false,
    // Combined className for quick use
    className: `${colors.bg} ${colors.border} ${colors.text} ${statusOverlay.opacity}`,
  }
}

/**
 * Get lane color for vendor lane views
 * @param {string} serviceType - 'onsite' or 'vendor'/'offsite'
 * @returns {Object} Lane styling
 */
export function getLaneColors(serviceType) {
  const type = serviceType === 'vendor' || serviceType === 'offsite' ? serviceType : 'onsite'
  const colors = SERVICE_TYPE_COLORS[type]

  return {
    bg: colors.bg,
    border: colors.border,
    text: colors.text,
    headerGradient: colors.gradient,
    hex: colors.hex,
  }
}

/**
 * Get legend items for calendar color guide
 * @returns {Array} Legend items with labels and colors
 */
export function getColorLegend() {
  return [
    {
      label: 'Onsite Service',
      description: 'Work performed at dealership',
      ...SERVICE_TYPE_COLORS.onsite,
      icon: 'Building',
    },
    {
      label: 'Vendor/Offsite',
      description: 'Work performed by external vendor',
      ...SERVICE_TYPE_COLORS.vendor,
      icon: 'Truck',
    },
  ]
}

/**
 * Get status legend for job states
 * @returns {Array} Status legend items
 */
export function getStatusLegend() {
  return [
    {
      label: 'Scheduled',
      className: STATUS_OVERLAYS.scheduled.badge,
      opacity: STATUS_OVERLAYS.scheduled.opacity,
    },
    {
      label: 'In Progress',
      className: STATUS_OVERLAYS.in_progress.badge,
      opacity: STATUS_OVERLAYS.in_progress.opacity,
      pulse: true,
    },
    {
      label: 'Quality Check',
      className: STATUS_OVERLAYS.quality_check.badge,
      opacity: STATUS_OVERLAYS.quality_check.opacity,
    },
    {
      label: 'Completed',
      className: STATUS_OVERLAYS.completed.badge,
      opacity: STATUS_OVERLAYS.completed.opacity,
    },
  ]
}

/**
 * Generate a deterministic event ID from job data
 * Ensures uniqueness and consistency across renders
 * @param {Object} job - Job/appointment object
 * @returns {string} Unique event ID
 */
export function generateEventId(job) {
  if (!job || !job.id) {
    console.warn('generateEventId: Invalid job object', job)
    return `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  // Combine job ID with scheduled time for uniqueness
  const timestamp = job.scheduled_start_time || job.created_at || Date.now()
  return `event-${job.id}-${new Date(timestamp).getTime()}`
}
