import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, Car, BarChart3, Settings, Package, Clock, Plus } from 'lucide-react'
import { getCalendarDestination } from '@/lib/navigation/calendarNavigation'

const GROUP_ORDER = ['Actions', 'Navigation']
const RECENT_STORAGE_KEY = 'quick-navigation:recent-ids'
const MAX_RECENT_ITEMS = 6
const HOTKEY_CODE_INDEX_MAP = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Digit5: 4,
  Digit6: 5,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
  Numpad5: 4,
  Numpad6: 5,
}

const isEditableTarget = (target) => {
  const el = target
  if (!el) return false
  const tag = String(el.tagName || '').toLowerCase()
  return tag === 'input' || tag === 'textarea' || el.isContentEditable
}

const QuickNavigation = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [recentIds, setRecentIds] = useState([])
  const [hasLoadedRecents, setHasLoadedRecents] = useState(false)

  const navigate = useNavigate()
  const inputRef = useRef()

  const items = useMemo(() => {
    const actions = [
      {
        id: 'action:new-deal',
        group: 'Actions',
        type: 'nav',
        name: 'New Deal',
        path: '/deals/new',
        icon: Plus,
        description: 'Start a new deal',
        keywords: ['new', 'create', 'deal', 'start', 'sale'],
      },
      {
        id: 'action:calendar-month',
        group: 'Actions',
        type: 'nav',
        name: 'Calendar (Month)',
        path: getCalendarDestination({ target: 'calendar', range: 'month' }),
        icon: Calendar,
        description: 'Open calendar in month view',
        keywords: ['calendar', 'month', 'schedule', 'appointments'],
      },
      {
        id: 'action:calendar-week',
        group: 'Actions',
        type: 'nav',
        name: 'Calendar (Week)',
        path: getCalendarDestination({ target: 'calendar', range: 'week' }),
        icon: Calendar,
        description: 'Open calendar in week view',
        keywords: ['calendar', 'week', 'schedule', 'appointments'],
      },
      {
        id: 'action:active-appts',
        group: 'Actions',
        type: 'nav',
        name: 'Active Appointments',
        path: '/currently-active-appointments',
        icon: Clock,
        description: 'Open currently active appointments',
        keywords: ['active', 'appointments', 'today', 'status', 'in progress'],
      },
      {
        id: 'action:deals-list',
        group: 'Actions',
        type: 'nav',
        name: 'Deals List',
        path: '/deals',
        icon: Package,
        description: 'Open deals list',
        keywords: ['deals', 'sales', 'transactions', 'pipeline'],
      },
    ]

    const navigation = [
      {
        id: 'nav:calendar-scheduling',
        group: 'Navigation',
        type: 'nav',
        name: 'Calendar & Scheduling',
        path: getCalendarDestination({ target: 'calendar', range: 'month' }),
        icon: Calendar,
        description: 'Manage appointments and scheduling',
        keywords: ['calendar', 'appointments', 'schedule', 'time'],
      },
      {
        id: 'nav:vehicle-management',
        group: 'Navigation',
        type: 'nav',
        name: 'Vehicle Management',
        path: '/vehicles',
        icon: Car,
        description: 'Vehicle inventory and tracking',
        keywords: ['vehicles', 'inventory', 'stock', 'cars'],
      },
      {
        id: 'nav:active-deals',
        group: 'Navigation',
        type: 'nav',
        name: 'Active Deals',
        path: '/deals',
        icon: Package,
        description: 'Track deals and installations',
        keywords: ['deals', 'sales', 'transactions', 'money'],
      },
      {
        id: 'nav:administration',
        group: 'Navigation',
        type: 'nav',
        name: 'Administration',
        path: '/admin',
        icon: Settings,
        description: 'Vendor management and system config',
        keywords: [
          'vendors',
          'partners',
          'suppliers',
          'admin',
          'settings',
          'configuration',
          'users',
        ],
      },
      {
        id: 'nav:analytics',
        group: 'Navigation',
        type: 'nav',
        name: 'Analytics Dashboard',
        path: '/advanced-business-intelligence-analytics',
        icon: BarChart3,
        description: 'Business intelligence and reports',
        keywords: ['analytics', 'reports', 'dashboard', 'insights'],
      },
    ]

    return [...actions, ...navigation]
  }, [])

  const itemsById = useMemo(() => {
    const map = new Map()
    ;(items || []).forEach((item) => {
      if (item?.id) map.set(item.id, item)
    })
    return map
  }, [items])

  const recentItems = useMemo(() => {
    return recentIds.map((id) => itemsById.get(id)).filter(Boolean)
  }, [itemsById, recentIds])

  const hasRecents = recentItems.length > 0

  const addRecentId = useCallback((id) => {
    if (!id) return
    setRecentIds((prev) => {
      const next = [id, ...(prev || []).filter((existingId) => existingId !== id)]
      return next.slice(0, MAX_RECENT_ITEMS)
    })
  }, [])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(RECENT_STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      const cleaned = parsed
        .filter((id) => typeof id === 'string' && id.length > 0)
        .slice(0, MAX_RECENT_ITEMS)
      setRecentIds(cleaned)
    } catch {
      setRecentIds([])
    } finally {
      setHasLoadedRecents(true)
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedRecents) return
    try {
      localStorage.setItem(RECENT_STORAGE_KEY, JSON.stringify((recentIds || []).slice(0, MAX_RECENT_ITEMS)))
    } catch {
      void 0
    }
  }, [hasLoadedRecents, recentIds])

  const close = useCallback(() => {
    setIsOpen(false)
    setQuery('')
    setSelectedIndex(0)
  }, [])

  const open = useCallback(() => {
    setIsOpen(true)
    setTimeout(() => inputRef?.current?.focus(), 100)
  }, [])

  const handleSelect = useCallback(
    async (item) => {
      addRecentId(item?.id)
      try {
        if (item?.type === 'action' && typeof item?.run === 'function') {
          await item.run({ navigate })
        } else if (item?.path) {
          navigate(item.path)
        }
      } finally {
        close()
      }
    },
    [addRecentId, close, navigate]
  )

  useEffect(() => {
    const q = String(query || '').trim().toLowerCase()
    const recents = (recentItems || []).map((item) => ({ ...item, group: 'Recent' }))
    const recentSet = new Set((recentItems || []).map((item) => item?.id).filter(Boolean))
    if (q.length > 1) {
      const filtered = items.filter((item) => {
        const name = String(item?.name || '').toLowerCase()
        const desc = String(item?.description || '').toLowerCase()
        const keywords = Array.isArray(item?.keywords) ? item.keywords : []
        return (
          name.includes(q) ||
          desc.includes(q) ||
          keywords.some((kw) => String(kw || '').toLowerCase().includes(q))
        )
      })
      const deduped = filtered.filter((item) => !recentSet.has(item?.id))
      setResults([...recents, ...deduped])
    } else {
      const deduped = items.slice(0, 8).filter((item) => !recentSet.has(item?.id))
      setResults([...recents, ...deduped])
    }
  }, [items, query, recentItems])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query, results?.length])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e?.metaKey || e?.ctrlKey) && e?.key === 'k') {
        if (isEditableTarget(e.target) && !isOpen) return
        e?.preventDefault()
        open()
        return
      }

      if (!isOpen) return

      if (e?.key === 'Escape') {
        e?.preventDefault()
        close()
        return
      }

      if (e?.key === 'ArrowDown') {
        e?.preventDefault()
        setSelectedIndex((prev) => {
          const max = Math.max(0, (results?.length || 0) - 1)
          return Math.min(max, prev + 1)
        })
        return
      }

      if (e?.key === 'ArrowUp') {
        e?.preventDefault()
        setSelectedIndex((prev) => Math.max(0, prev - 1))
        return
      }

      if (e?.key === 'Enter') {
        const item = results?.[selectedIndex]
        if (!item) return
        e?.preventDefault()
        handleSelect(item)
        return
      }

      if (e?.altKey && !e?.ctrlKey && !e?.metaKey) {
        const code = String(e?.code || '')
        const fallbackKey = String(e?.key || '')
        const fallbackIndex =
          fallbackKey >= '1' && fallbackKey <= '6' ? Number.parseInt(fallbackKey, 10) - 1 : null
        const hotkeyIndex = HOTKEY_CODE_INDEX_MAP[code] ?? fallbackIndex
        if (hotkeyIndex == null) return

        const item = recentItems[hotkeyIndex]
        if (!item) return

        e?.preventDefault()
        e?.stopPropagation()
        handleSelect(item)
        return
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [close, handleSelect, isOpen, open, recentItems, results, selectedIndex])

  const handleBackdropClick = () => close()

  const grouped = useMemo(() => {
    const map = new Map()
    ;(results || []).forEach((item) => {
      const group = item?.group || 'Other'
      if (!map.has(group)) map.set(group, [])
      map.get(group).push(item)
    })
    return map
  }, [results])

  const renderGroup = (groupName) => {
    const groupItems = grouped.get(groupName) || []
    if (!groupItems.length) return null

    return (
      <div key={groupName}>
        <div className="px-4 pt-3 pb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          {groupName}
        </div>

        {groupItems.map((item) => {
          const idx = results.findIndex((r) => r?.id === item?.id)
          const Icon = item?.icon || Search
          const isSelected = idx === selectedIndex

          return (
            <button
              key={item?.id || item?.path || item?.name}
              onMouseEnter={() => setSelectedIndex(idx)}
              onClick={() => handleSelect(item)}
              className={`w-full text-left px-4 py-3 border-b border-border last:border-b-0 focus:outline-none ${
                isSelected ? 'bg-accent' : 'hover:bg-accent'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon className="w-5 h-5 text-muted-foreground" />
                <div>
                  <div className="font-medium text-foreground">{item?.name}</div>
                  <div className="text-sm text-muted-foreground">{item?.description}</div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  if (!isOpen) {
    return (
      <button
        onClick={open}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Quick search...</span>
        <kbd className="hidden sm:inline-flex px-1.5 py-0.5 text-xs bg-muted rounded border border-border">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={handleBackdropClick} />

      <div className="relative w-full max-w-2xl bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
        <div className="p-4 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Type a command or search… (e.g., 'new deal', 'calendar week')"
              value={query}
              onChange={(e) => setQuery(e?.target?.value)}
              className="w-full pl-10 pr-4 py-2 border border-input bg-background rounded-lg focus:ring-2 focus:ring-ring focus:ring-offset-2 ring-offset-background"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {renderGroup('Recent')}
          {GROUP_ORDER.map((g) => renderGroup(g))}
        </div>

        <div className="p-3 border-t border-border text-xs text-muted-foreground flex items-center justify-between">
          <span>Esc to close</span>
          <span>{`↑/↓ select • Enter run${hasRecents ? ' • Alt+1..6 recent' : ''}`}</span>
        </div>
      </div>
    </div>
  )
}

export default QuickNavigation
