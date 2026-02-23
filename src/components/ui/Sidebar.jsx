import React from 'react'
import { Calendar, BarChart3, Clock, Settings, X, ChevronRight, Package } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getCalendarDestination } from '@/lib/navigation/calendarNavigation'

const Sidebar = ({ isOpen, setIsOpen }) => {
  const navigate = useNavigate()
  const location = useLocation()

  const navigationItems = [
    {
      icon: Package,
      label: 'Deals Dashboard',
      path: '/deals',
      description: 'Sales & Transaction Management',
    },
    {
      icon: Calendar,
      label: 'Calendar',
      path: getCalendarDestination({ target: 'calendar', range: 'month' }),
      description: 'Appointment Scheduling',
    },
    {
      icon: Clock,
      label: 'Active Appointments',
      path: '/currently-active-appointments',
      description: 'Real-time Workflow Management',
    },
    {
      icon: BarChart3,
      label: 'Analytics Dashboard',
      path: '/advanced-business-intelligence-analytics',
      description: 'Performance & Business Intelligence',
    },
    {
      icon: Settings,
      label: 'Admin Center',
      path: '/admin',
      description: 'System Configuration',
    },
  ]

  const isActivePath = (path) => {
    if (path === '/deals') {
      return location?.pathname === '/' || location?.pathname === '/deals'
    }
    return location?.pathname === path
  }

  const handleNavigation = (path) => {
    navigate(path)
    setIsOpen(false)
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
      {/* Sidebar */}
      <div
        className={`
        fixed lg:static inset-y-0 left-0 z-50 w-80 bg-card border-r border-border
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-8 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg flex items-center justify-center">
                  <img
                    src="/brand/rat-icon-master.svg"
                    alt="Rocket Aftermarket Tracker"
                    className="h-8 w-8"
                    draggable="false"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-foreground">Rocket Aftermarket</h2>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Aftermarket Management</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="lg:hidden w-8 h-8 rounded-lg bg-accent/25 hover:bg-accent/45 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-6">
            <div className="space-y-2">
              {navigationItems?.map((item) => {
                const isActive = isActivePath(item?.path)
                return (
                  <button
                    key={item?.path}
                    onClick={() => handleNavigation(item?.path)}
                    className={`
                      w-full flex items-center justify-between p-4 rounded-2xl transition-all duration-200 group
                      ${
                        isActive
                          ? 'bg-accent/45 text-foreground border border-border'
                          : 'text-muted-foreground hover:bg-accent/35 hover:text-foreground'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`
                        w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                        ${isActive ? 'bg-accent/45' : 'bg-accent/25 group-hover:bg-accent/45'}
                      `}
                      >
                        <item.icon
                          className={`w-5 h-5 ${isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}
                        />
                      </div>
                      <div className="text-left">
                        <div
                          className={`font-semibold ${isActive ? 'text-foreground' : 'text-foreground'}`}
                        >
                          {item?.label}
                        </div>
                        <div className={`text-sm ${isActive ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                          {item?.description}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`
                      w-4 h-4 transition-all duration-200
                      ${isActive ? 'text-foreground' : 'text-muted-foreground group-hover:text-muted-foreground'}
                    `}
                    />
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-border">
            <div className="rounded-2xl p-4 border border-border bg-accent/25">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-accent/45 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-foreground" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">System Status</div>
                  <div className="text-xs text-muted-foreground">All systems operational</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default Sidebar
