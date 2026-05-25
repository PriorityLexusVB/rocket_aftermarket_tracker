// User-facing labels for the location filter. Values mirror getJobLocationType()
// output ('Mixed' is the canonical internal value); 'Split Work' is the
// user-facing label for that state across cards, legends, and pills.
export const LOCATION_FILTER_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'In-House', label: 'In-House' },
  { value: 'Off-Site', label: 'Off-Site' },
  { value: 'Mixed', label: 'Split Work' },
]

// Defer to the canonical multi-source classifier so Mixed jobs are correctly
// treated as off-site (they have at least one off-site line item).
// Falls back to the legacy `job.location` / `vendor_id` heuristic when neither
// job_parts nor location/service_type signal a clear answer.
export function isJobOnSite(job) {
  const locType = getJobLocationType(job)
  if (locType === 'In-House') return true
  if (locType === 'Off-Site' || locType === 'Mixed') return false
  // Unknown / no signal — fall back to legacy logic
  if (job?.location === 'on_site') return true
  if (job?.location === 'off_site') return false
  return !job?.vendor_id
}

export function getJobLocationType(job) {
  if (!job) return null
  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  const hasOff = parts.some((p) => p?.is_off_site === true)
  const hasOn = parts.some((p) => p?.is_off_site === false)

  if (hasOff && hasOn) return 'Mixed'
  if (hasOff) return 'Off-Site'
  if (hasOn) return 'In-House'

  if (job?.location === 'on_site' || job?.service_type === 'onsite') return 'In-House'
  if (job?.location === 'off_site' || job?.service_type === 'vendor' || job?.vendor_id) {
    return 'Off-Site'
  }

  return null
}
