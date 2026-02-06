// Minimal helpers for micro-interaction class toggles.
// Kept small and side-effect free for easy testing.

export function getMicroFlashClass({ enabled, activeId, itemId }) {
  if (!enabled || !activeId || !itemId) return ''
  return String(activeId) === String(itemId) ? 'calendar-micro-flash' : ''
}
