import React, { useMemo } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { Calendar, List, LayoutGrid } from 'lucide-react'
import {
  getCalendarDestination,
  trackCalendarNavigation,
} from '@/lib/navigation/calendarNavigation'
import { isCalendarUnifiedShellEnabled } from '@/config/featureFlags'

const SIMPLE_AGENDA_ENABLED =
  String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'

export default function CalendarViewTabs() {
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const unifiedShellEnabled = isCalendarUnifiedShellEnabled()
  const agendaEnabled = SIMPLE_AGENDA_ENABLED || unifiedShellEnabled

  const viewItems = useMemo(() => {
    if (unifiedShellEnabled) {
      return [
        { key: 'board', label: 'Board', target: 'board', icon: Calendar },
        { key: 'calendar', label: 'Calendar', target: 'calendar', icon: LayoutGrid },
        { key: 'list', label: 'List', target: 'list', icon: List, disabled: !agendaEnabled },
      ]
    }

    return [
      { key: 'grid', label: 'Grid', target: 'grid', icon: LayoutGrid },
      { key: 'flow', label: 'Flow', target: 'board', icon: Calendar },
      ...(agendaEnabled ? [{ key: 'agenda', label: 'Agenda', target: 'list', icon: List }] : []),
    ]
  }, [agendaEnabled, unifiedShellEnabled])

  const isActive = (href, item) => {
    if (unifiedShellEnabled) {
      const activeView = String(searchParams.get('view') || '').toLowerCase() || 'board'
      return location?.pathname === '/calendar' && activeView === item?.target
    }
    return location?.pathname === href || location?.pathname?.startsWith(`${href}/`)
  }
  const getSourceForKey = (key) => {
    if (key === 'board') return 'CalendarViewTabs.SwitchToBoard'
    if (key === 'calendar') return 'CalendarViewTabs.SwitchToCalendar'
    if (key === 'list') return 'CalendarViewTabs.SwitchToList'
    if (key === 'grid') return 'CalendarViewTabs.SwitchToGrid'
    if (key === 'flow') return 'CalendarViewTabs.SwitchToBoard'
    if (key === 'agenda') return 'CalendarViewTabs.SwitchToAgenda'
    return 'CalendarViewTabs.Switch'
  }

  return (
    <div
      className="relative z-20 flex flex-wrap items-center gap-2 pointer-events-auto"
      aria-label="Calendar views"
    >
      <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
        Calendar views
      </span>
      <div className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-slate-200 bg-white p-1 pointer-events-auto">
        {viewItems.map((item) => {
          const Icon = item.icon
          const href = getCalendarDestination({ target: item.target })
          const active = isActive(href, item)
          const isDisabled = !!item.disabled
          return (
            <span key={item.key} className="inline-flex">
              {isDisabled ? (
                <span
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-slate-300"
                  aria-disabled="true"
                >
                  <Icon size={14} />
                  {item.label}
                </span>
              ) : (
                <Link
                  to={href}
                  onClick={() => {
                    trackCalendarNavigation({
                      source: getSourceForKey(item.key),
                      destination: href,
                      context: { from: `${location?.pathname || ''}${location?.search || ''}` },
                    })
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-slate-900 text-white'
                      : 'bg-white text-slate-600 hover:bg-slate-100'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  <Icon size={14} />
                  {item.label}
                </Link>
              )}
            </span>
          )
        })}
      </div>
    </div>
  )
}
