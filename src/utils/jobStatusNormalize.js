// Maps any legacy status value to the new 5-state model.
// Defensive helper: any code that READS a job_status should pipe through this
// so the surface stays correct even if some path returns an old value during transition.

const LEGACY_MAP = {
  delivered: 'completed',
  cancelled: 'reversed',
  no_show: 'reversed',
  quality_check: 'in_progress',
  draft: 'pending',
  canceled: 'reversed',  // US-spelling defensive alias
}

export function normalizeJobStatus(raw) {
  if (raw == null) return raw
  const s = String(raw).trim().toLowerCase()
  return LEGACY_MAP[s] || s
}
