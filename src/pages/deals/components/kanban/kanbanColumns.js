// Wave XXX-AA: kanban column config for 5-state deal lifecycle
// Column order: pending → scheduled → in_progress → completed → reversed

export const KANBAN_COLUMNS = [
  {
    status: 'pending',
    title: 'Not Started',
    borderColor: 'border-l-slate-400',
  },
  {
    status: 'scheduled',
    title: 'Scheduled',
    borderColor: 'border-l-blue-500',
  },
  {
    status: 'in_progress',
    title: 'In Progress',
    borderColor: 'border-l-amber-500',
  },
  {
    status: 'completed',
    title: 'Completed',
    borderColor: 'border-l-emerald-600',
  },
  {
    status: 'reversed',
    title: 'Reversed',
    borderColor: 'border-l-red-600',
  },
]
