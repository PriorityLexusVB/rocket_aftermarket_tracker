// Friendly expansion for work_tag abbreviations shown on cards.
// New abbreviations should land here so the chip tooltip stays in sync
// across VendorLaneView, calendar/index.jsx, AppointmentCard, and any future
// consumer.
const WORK_TAG_LABELS = {
  EXTERIOR: 'Exterior protection',
  INTERIOR: 'Interior protection',
  WINDSHIELD: 'Windshield protection',
  RG: 'Rust Guard',
  EVERNEW: 'EverNew protection',
  FILM: 'Window tint film',
}

export function getWorkTagLabel(tag) {
  if (!tag) return ''
  return WORK_TAG_LABELS[String(tag).toUpperCase()] || String(tag)
}

// Hard cap on how many work_tag chips a single card renders.
// Shared so a future "show 5" decision is a one-line edit, not a 3-file hunt.
export const MAX_WORK_TAGS_VISIBLE = 4
