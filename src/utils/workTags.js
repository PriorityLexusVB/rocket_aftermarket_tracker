// Friendly expansion for work_tag / op_code abbreviations shown on cards.
// New abbreviations should land here so the chip tooltip stays in sync
// across VendorLaneView, calendar/index.jsx, AppointmentCard, deals card
// chips, and any future consumer.
//
// Long-form variants (EXTERIOR / INTERIOR / WINDSHIELD) come from
// `roundUpExport.classifyProduct`; short op_code variants (EXT / INT / WS /
// EN3) come from `getDealProductLabelSummary` reading `job_parts[].product.op_code`.
const WORK_TAG_LABELS = {
  EXTERIOR: 'Exterior protection',
  EXT: 'Exterior protection',
  INTERIOR: 'Interior protection',
  INT: 'Interior protection',
  WINDSHIELD: 'Windshield protection',
  WS: 'Windshield protection',
  RG: 'Rust Guard',
  EVERNEW: 'EverNew protection',
  EN: 'EverNew protection',
  PACKAGE: 'EverNew package',
  FILM: 'Window tint film',
}

export function getWorkTagLabel(tag) {
  if (!tag) return ''
  const key = String(tag).toUpperCase()
  // Exact match first.
  if (WORK_TAG_LABELS[key]) return WORK_TAG_LABELS[key]
  // EverNew variants — EN1, EN2, EN3, EN4, EN5 all map to a duration suffix.
  const evMatch = key.match(/^EN(\d+)$/)
  if (evMatch) return `EverNew protection (${evMatch[1]}-yr)`
  return String(tag)
}

// Hard cap on how many work_tag chips a single card renders.
// Shared so a future "show 5" decision is a one-line edit, not a 3-file hunt.
export const MAX_WORK_TAGS_VISIBLE = 4
