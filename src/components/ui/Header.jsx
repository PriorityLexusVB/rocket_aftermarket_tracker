import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Icon from '../AppIcon'
import Button from './Button'
import { testSupabaseConnection } from '@/lib/supabase'

const Header = ({ onMenuToggle, isMenuOpen = false }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [sbStatus, setSbStatus] = useState('unknown') // 'unknown' | 'ok' | 'error'
  const [sbChecking, setSbChecking] = useState(false)

  useEffect(() => {
    // lightweight background check once on mount
    let mounted = true
    ;(async () => {
      try {
        setSbChecking(true)
        const ok = await testSupabaseConnection?.(1)
        if (!mounted) return
        setSbStatus(ok ? 'ok' : 'error')
      } catch (_) {
        if (!mounted) return
        setSbStatus('error')
      } finally {
        if (mounted) setSbChecking(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [])

  const handleSearch = (e) => {
    e?.preventDefault()
    if (searchQuery?.trim()) {
      // Intelligent search routing
      if (searchQuery?.match(/^[A-Z0-9]{17}$/)) {
        navigate('/vehicle-detail-workstation')
      } else if (searchQuery?.toLowerCase()?.includes('vendor')) {
        navigate('/vendor-operations-center')
      } else if (searchQuery?.toLowerCase()?.includes('sale')) {
        navigate('/sales-tracker')
      } else {
        navigate('/business-intelligence-reports')
      }
      setSearchQuery('')
    }
  }

  const getPageTitle = () => {
    const pathTitles = {
      '/': 'Authentication Portal',
      '/authentication-portal': 'Authentication Portal',
      '/dashboard': 'Executive Analytics Dashboard',
      '/executive-analytics-dashboard': 'Executive Analytics Dashboard',
      '/sales-tracker': 'Sales Tracker',
      '/vehicle-management-hub': 'Vehicle Management Hub',
      '/vehicle-detail-workstation': 'Vehicle Detail Workstation',
      '/vendor-operations-center': 'Vendor Operations Center',
      '/vendor-job-dashboard': 'Vendor Job Dashboard',
      '/sales-transaction-interface': 'Sales Transaction Interface',
      '/business-intelligence-reports': 'Business Intelligence Reports',
      '/administrative-configuration-center': 'Administrative Configuration Center',
      '/calendar-scheduling-center': 'Calendar Scheduling Center',
      '/kanban-status-board': 'Kanban Status Board',
      '/photo-documentation-center': 'Photo Documentation Center',
    }
    return pathTitles?.[location?.pathname] || 'Rocket Aftermarket Tracker'
  }

  const getBreadcrumbs = () => {
    const path = location?.pathname
    const breadcrumbMap = {
      '/dashboard': [{ label: 'Dashboard', path: '/dashboard' }],
      '/executive-analytics-dashboard': [{ label: 'Dashboard', path: '/dashboard' }],
      '/sales-tracker': [
        { label: 'Operations', path: '#' },
        { label: 'Sales Tracker', path: '/sales-tracker' },
      ],
      '/vehicle-management-hub': [
        { label: 'Operations', path: '#' },
        { label: 'Vehicle Management', path: '/vehicle-management-hub' },
      ],
      '/vehicle-detail-workstation': [
        { label: 'Operations', path: '#' },
        { label: 'Vehicle Management', path: '/vehicle-management-hub' },
        { label: 'Detail Workstation', path: '/vehicle-detail-workstation' },
      ],
      '/vendor-operations-center': [
        { label: 'Management', path: '#' },
        { label: 'Vendor Operations', path: '/vendor-operations-center' },
      ],
      '/vendor-job-dashboard': [
        { label: 'Management', path: '#' },
        { label: 'Vendor Operations', path: '/vendor-operations-center' },
        { label: 'Job Dashboard', path: '/vendor-job-dashboard' },
      ],
      '/calendar-scheduling-center': [
        { label: 'Operations', path: '#' },
        { label: 'Calendar Scheduling', path: '/calendar-scheduling-center' },
      ],
      '/kanban-status-board': [
        { label: 'Operations', path: '#' },
        { label: 'Kanban Board', path: '/kanban-status-board' },
      ],
      '/sales-transaction-interface': [
        { label: 'Management', path: '#' },
        { label: 'Sales Transactions', path: '/sales-transaction-interface' },
      ],
      '/business-intelligence-reports': [
        { label: 'Reporting', path: '#' },
        { label: 'Business Intelligence', path: '/business-intelligence-reports' },
      ],
      '/photo-documentation-center': [
        { label: 'Reporting', path: '#' },
        { label: 'Photo Documentation', path: '/photo-documentation-center' },
      ],
      '/administrative-configuration-center': [
        { label: 'Management', path: '#' },
        { label: 'Configuration', path: '/administrative-configuration-center' },
      ],
    }
    return breadcrumbMap?.[path] || []
  }

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-card border-b border-border shadow-elevation-1">
      <div className="flex items-center justify-between h-16 px-4 lg:px-6 lg:ml-60">
        {/* Left Section - Menu Toggle & Breadcrumbs */}
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={onMenuToggle}
            className="lg:hidden"
            aria-label="Toggle menu"
          >
            <Icon name={isMenuOpen ? 'X' : 'Menu'} size={20} />
          </Button>

          {/* Mobile Title */}
          <div className="block lg:hidden">
            <h2 className="text-sm font-medium text-foreground">{getPageTitle()}</h2>
          </div>

          {/* Desktop Breadcrumbs */}
          <div className="hidden lg:flex items-center space-x-2">
            <Icon name="Home" size={14} className="text-muted-foreground" />
            {getBreadcrumbs()?.map((crumb, index) => (
              <React.Fragment key={crumb?.path}>
                <Icon name="ChevronRight" size={12} className="text-muted-foreground" />
                <button
                  onClick={() => crumb?.path !== '#' && navigate(crumb?.path)}
                  className={`text-sm ${
                    index === getBreadcrumbs()?.length - 1
                      ? 'text-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  } transition-colors duration-200 ${crumb?.path === '#' ? 'cursor-default' : 'cursor-pointer'}`}
                  disabled={crumb?.path === '#'}
                >
                  {crumb?.label}
                </button>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Right Section - Search & User Actions */}
        <div className="flex items-center space-x-3">
          {/* Enhanced Search */}
          <form onSubmit={handleSearch} className="hidden md:flex">
            <div className="relative">
              <Icon
                name="Search"
                size={16}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground"
              />
              <input
                type="text"
                placeholder="Search VINs, vendors, sales..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e?.target?.value)}
                className="w-72 pl-10 pr-4 py-2 text-sm bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all duration-200 focus:w-80"
              />
              {searchQuery && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 w-6 h-6"
                >
                  <Icon name="X" size={12} />
                </Button>
              )}
            </div>
          </form>

          {/* Quick Actions */}
          <div className="hidden lg:flex items-center space-x-1">
            {/* Supabase status pill */}
            <Button
              variant="ghost"
              size="icon"
              className="relative"
              aria-label="Supabase status"
              title={
                sbStatus === 'ok'
                  ? 'Supabase OK'
                  : sbStatus === 'error'
                    ? 'Supabase Error'
                    : 'Supabase Unknown'
              }
              data-testid="sb-status-pill"
              onClick={async () => {
                try {
                  setSbChecking(true)
                  const ok = await testSupabaseConnection?.(1)
                  setSbStatus(ok ? 'ok' : 'error')
                } catch (_) {
                  setSbStatus('error')
                } finally {
                  setSbChecking(false)
                }
              }}
            >
              <Icon name="Activity" size={18} />
              <span
                className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${
                  sbChecking
                    ? 'bg-yellow-500 animate-pulse'
                    : sbStatus === 'ok'
                      ? 'bg-emerald-500'
                      : sbStatus === 'error'
                        ? 'bg-red-500'
                        : 'bg-gray-400'
                }`}
              ></span>
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate('/sales-tracker')}
              className="relative"
              aria-label="Quick Sales Entry"
            >
              <Icon name="Plus" size={18} />
            </Button>

            <Button variant="ghost" size="icon" className="relative" aria-label="Notifications">
              <Icon name="Bell" size={18} />
              <span className="absolute -top-1 -right-1 w-2 h-2 bg-error rounded-full"></span>
            </Button>
          </div>

          {/* User Menu */}
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="User menu"
            onClick={() => navigate('/administrative-configuration-center')}
          >
            <Icon name="User" size={18} />
          </Button>
        </div>
      </div>
    </header>
  )
}

export default Header
