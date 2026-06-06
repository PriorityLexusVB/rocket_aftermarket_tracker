// Wave XXX-AA: kanban column config for 5-state deal lifecycle
// Column order: pending → scheduled → in_progress → completed → reversed

export const KANBAN_COLUMNS = [
  {
    // Wave XXX-AB hotfix-4 fix #1 (sense-check + clarity-auditor REQUIRED):
    // Was 'Not Started' — caused label mismatch with the filter tab's
    // 'Pending Work'. Same status, two labels = Ashley confusion. Aligned
    // to the tab's established vocabulary.
    status: 'pending',
    title: 'Pending Work',
    borderColor: 'border-l-slate-400',
    emptyHint: 'Nothing waiting',
  },
  {
    status: 'scheduled',
    title: 'Scheduled',
    borderColor: 'border-l-blue-500',
    emptyHint: 'Nothing booked',
  },
  {
    status: 'in_progress',
    title: 'In Progress',
    borderColor: 'border-l-amber-500',
    // Wave XXX-AB hotfix-5 (Codex H): "Clear floor" was shop-floor
    // jargon, not coordinator voice. Clearer + still warm.
    emptyHint: 'Nothing in progress',
  },
  {
    status: 'completed',
    title: 'Completed',
    borderColor: 'border-l-emerald-600',
    emptyHint: 'Nothing wrapped yet',
  },
  {
    status: 'reversed',
    title: 'Reversed',
    borderColor: 'border-l-red-600',
    emptyHint: 'Clean slate',
  },
]
