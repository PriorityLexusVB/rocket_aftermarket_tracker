import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Calendar, List, LayoutGrid } from 'lucide-react'

const SIMPLE_AGENDA_ENABLED =
  String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

const CALENDAR_VIEWS = [
  { key: 'grid', label: 'Grid', href: '/calendar', icon: LayoutGrid },
  { key: 'flow', label: 'Flow', href: '/calendar-flow-management-center', icon: Calendar },
  ...(SIMPLE_AGENDA_ENABLED
    ? [{ key: 'agenda', label: 'Agenda', href: '/calendar/agenda', icon: List }]
    : []),
]

export default function CalendarViewTabs() {
  const location = useLocation()
  const isActive = (href) =>
    location?.pathname === href || location?.pathname?.startsWith(`${href}/`)

  return (
    <div
      className="relative z-20 flex flex-wrap items-center gap-2 pointer-events-auto"
      aria-label="Calendar views"
    >
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Calendar views
      </span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 pointer-events-auto">
        {CALENDAR_VIEWS.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)
          return (
            <Link
              key={item.key}
              to={item.href}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                active ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={14} />
              {item.label}
            </Link>
          )
        })}
      </div>
    </div>
  )
}
