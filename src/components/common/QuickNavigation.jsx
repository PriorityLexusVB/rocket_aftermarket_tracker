import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Calendar, Car, BarChart3, Settings, Package } from 'lucide-react'
import Icon from '../AppIcon'

const QuickNavigation = () => {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const navigate = useNavigate()
  const inputRef = useRef()

  const navigationItems = [
    {
      name: 'Calendar & Scheduling',
      path: '/calendar',
      icon: Calendar,
      description: 'Manage appointments and scheduling',
      keywords: ['calendar', 'appointments', 'schedule', 'time'],
    },
    {
      name: 'Vehicle Management',
      path: '/vehicles',
      icon: Car,
      description: 'Vehicle inventory and tracking',
      keywords: ['vehicles', 'inventory', 'stock', 'cars'],
    },
    {
      name: 'Active Deals',
      path: '/deals',
      icon: Package,
      description: 'Track deals and installations',
      keywords: ['deals', 'sales', 'transactions', 'money'],
    },
    {
      name: 'Administration',
      path: '/admin',
      icon: Settings,
      description: 'Vendor management and system config',
      keywords: ['vendors', 'partners', 'suppliers', 'admin', 'settings', 'configuration', 'users'],
    },
    {
      name: 'Analytics Dashboard',
      path: '/calendar',
      icon: BarChart3,
      description: 'Business intelligence and reports',
      keywords: ['analytics', 'reports', 'dashboard', 'insights'],
    },
  ]

  useEffect(() => {
    if (query?.length > 1) {
      const filtered = navigationItems?.filter(
        (item) =>
          item?.name?.toLowerCase()?.includes(query?.toLowerCase()) ||
          item?.description?.toLowerCase()?.includes(query?.toLowerCase()) ||
          item?.keywords?.some((keyword) => keyword?.toLowerCase()?.includes(query?.toLowerCase()))
      )
      setResults(filtered)
    } else {
      setResults(navigationItems?.slice(0, 6))
    }
  }, [query])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e?.metaKey || e?.ctrlKey) && e?.key === 'k') {
        e?.preventDefault()
        setIsOpen(true)
        setTimeout(() => inputRef?.current?.focus(), 100)
      }

      if (e?.key === 'Escape') {
        setIsOpen(false)
        setQuery('')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleSelect = (item) => {
    navigate(item?.path)
    setIsOpen(false)
    setQuery('')
  }

  // Close popup when clicking outside
  const handleBackdropClick = () => {
    setIsOpen(false)
    setQuery('')
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center space-x-2 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
      >
        <Search className="w-4 h-4" />
        <span>Quick search...</span>
        <kbd className="hidden sm:inline-flex items-center px-2 py-0.5 border border-gray-200 rounded text-xs">
          ⌘K
        </kbd>
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-25 flex items-start justify-center pt-16 z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4"
        onClick={(e) => e?.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages and features..."
              value={query}
              onChange={(e) => setQuery(e?.target?.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="max-h-96 overflow-y-auto">
          {results?.map((item, index) => {
            const Icon = item?.icon
            return (
              <button
                key={item?.path}
                onClick={() => handleSelect(item)}
                className="w-full text-left px-4 py-3 hover:bg-gray-50 focus:bg-gray-50 focus:outline-none border-b border-gray-100 last:border-b-0"
              >
                <div className="flex items-center space-x-3">
                  <Icon className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="font-medium text-gray-900">{item?.name}</div>
                    <div className="text-sm text-gray-500">{item?.description}</div>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="p-3 border-t border-gray-200 text-xs text-gray-500 flex items-center justify-between">
          <span>Press ESC to close</span>
          <span>↵ to navigate</span>
        </div>
      </div>
    </div>
  )
}

export default QuickNavigation
