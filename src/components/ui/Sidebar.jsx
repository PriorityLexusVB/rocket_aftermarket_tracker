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
        fixed lg:static inset-y-0 left-0 z-50 w-80 bg-[#0B0F14] border-r border-white/10
        transform transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="p-8 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <img
                    src="/brand/logos/rocket-mark-white.png"
                    alt="Rocket Aftermarket Tracker"
                    className="w-6 h-6"
                    draggable="false"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Rocket Aftermarket</h2>
                  <p className="text-sm text-gray-400 font-medium mt-1">Aftermarket Management</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="lg:hidden w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="w-5 h-5 text-gray-300" />
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
                          ? 'bg-white/10 text-white border border-white/10'
                          : 'text-gray-300 hover:bg-white/5 hover:text-white'
                      }
                    `}
                  >
                    <div className="flex items-center space-x-4">
                      <div
                        className={`
                        w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-200
                        ${isActive ? 'bg-white/10' : 'bg-white/5 group-hover:bg-white/10'}
                      `}
                      >
                        <item.icon
                          className={`w-5 h-5 ${isActive ? 'text-white' : 'text-gray-400 group-hover:text-gray-200'}`}
                        />
                      </div>
                      <div className="text-left">
                        <div
                          className={`font-semibold ${isActive ? 'text-white' : 'text-gray-200'}`}
                        >
                          {item?.label}
                        </div>
                        <div className={`text-sm ${isActive ? 'text-white/70' : 'text-gray-500'}`}>
                          {item?.description}
                        </div>
                      </div>
                    </div>
                    <ChevronRight
                      className={`
                      w-4 h-4 transition-all duration-200
                      ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}
                    `}
                    />
                  </button>
                )
              })}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-6 border-t border-white/10">
            <div className="rounded-2xl p-4 border border-white/10 bg-white/5">
              <div className="flex items-center space-x-3 mb-2">
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-gray-200" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-gray-200">System Status</div>
                  <div className="text-xs text-gray-500">All systems operational</div>
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
