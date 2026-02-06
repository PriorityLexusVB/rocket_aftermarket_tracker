export const LOCATION_FILTER_OPTIONS = ['All', 'In-House', 'Off-Site', 'Mixed']

export function getJobLocationType(job) {
  if (!job) return null
  const parts = Array.isArray(job?.job_parts) ? job.job_parts : []
  const hasOff = parts.some((p) => p?.is_off_site === true)
  const hasOn = parts.some((p) => p?.is_off_site === false)

  if (hasOff && hasOn) return 'Mixed'
  if (hasOff) return 'Off-Site'
  if (hasOn) return 'In-House'

  if (job?.location === 'off_site' || job?.service_type === 'vendor' || job?.vendor_id) {
    return 'Off-Site'
  }
  if (job?.location === 'on_site' || job?.service_type === 'onsite') return 'In-House'

  return null
}
