import React, { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import {
  Menu,
  X,
  Bell,
  User,
  LogOut,
  Settings,
  Calendar,
  Car,
  Package,
  BarChart3,
  Clock,
  FileText,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { notificationService } from '../../services/notificationService'
import QuickNavigation from '../common/QuickNavigation'
import ThemeSelector from '../common/ThemeSelector'
import EnvChip from '../common/EnvChip'
import { isTest } from '../../lib/env'
import { getCalendarDestination } from '../../lib/navigation/calendarNavigation'

const Navbar = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isNotificationOpen, setIsNotificationOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [notificationLoading, setNotificationLoading] = useState(false)

  const buildSha = typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : ''
  const buildTimeIso = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''
  const buildLabel = buildSha ? buildSha.slice(0, 7) : ''

  const { user, userProfile, signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Ensure content can scroll past the fixed mobile bottom nav.
  useEffect(() => {
    if (isTest) return
    if (typeof window === 'undefined' || typeof document === 'undefined') return

    const body = document.body
    if (!body) return

    const mql = window.matchMedia('(max-width: 767px)')
    const apply = () => {
      if (mql.matches) body.classList.add('has-mobile-bottom-nav')
      else body.classList.remove('has-mobile-bottom-nav')
    }

    apply()

    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', apply)
      return () => {
        mql.removeEventListener('change', apply)
        body.classList.remove('has-mobile-bottom-nav')
      }
    }

    // Safari < 14
    mql.addListener(apply)
    return () => {
      mql.removeListener(apply)
      body.classList.remove('has-mobile-bottom-nav')
    }
  }, [])

  const navigationLinks = [
    {
      name: 'Calendar',
      href: getCalendarDestination({ target: 'calendar', range: 'month' }),
      icon: Calendar,
    },
    {
      name: 'Appointments',
      href: '/currently-active-appointments',
      icon: Clock,
      shortName: 'Active',
    },
    { name: 'Claims', href: '/claims-management-center', icon: FileText },
    { name: 'Deals', href: '/deals', icon: Package },
    { name: 'Loaners', href: '/loaner-management-drawer', icon: Car, shortName: 'Loaners' },
    { name: 'Analytics', href: '/advanced-business-intelligence-analytics', icon: BarChart3 },
    { name: 'Admin', href: '/admin', icon: Settings },
  ]

  // Load notifications on component mount and when user changes
  useEffect(() => {
    // In tests, skip Supabase wiring to avoid open handles and network calls
    if (isTest) {
      setNotificationCount(0)
      setNotifications([])
      return () => {}
    }

    let subscription = null

    const loadNotifications = async () => {
      if (!user?.id) {
        setNotificationCount(0)
        setNotifications([])
        return
      }

      setNotificationLoading(true)

      try {
        // Load initial notifications
        const [countResult, notificationsResult] = await Promise.all([
          notificationService?.getNotificationCount(user?.id),
          notificationService?.getNotifications(user?.id),
        ])

        if (countResult?.error) {
          console.warn('Notification count error:', countResult?.error)
          setNotificationCount(0)
        } else {
          setNotificationCount(countResult?.count || 0)
        }

        if (notificationsResult?.error) {
          console.warn('Notifications load error:', notificationsResult?.error)
          setNotifications([])
        } else {
          setNotifications(notificationsResult?.data || [])
        }

        // Set up real-time subscription
        subscription = notificationService?.subscribeToNotifications(user?.id, (result) => {
          if (result?.error) {
            console.warn('Real-time notification error:', result?.error)
          } else {
            setNotificationCount(result?.count || 0)
          }
        })
      } catch (error) {
        console.warn('Failed to load notifications:', error)
        setNotificationCount(0)
        setNotifications([])
      } finally {
        setNotificationLoading(false)
      }
    }

    loadNotifications()

    // Cleanup subscription on unmount or user change
    return () => {
      if (subscription) {
        notificationService?.unsubscribeFromNotifications(subscription)
      }
    }
  }, [user?.id])

  const handleSignOut = async () => {
    try {
      await signOut()
      navigate('/auth')
    } catch (error) {
      console.error('Error signing out:', error)
    }
  }

  const isActivePath = (path) => {
    return location?.pathname === path || location?.pathname?.startsWith(path + '/')
  }

  const formatNotificationTime = (timestamp) => {
    if (!timestamp) return ''

    try {
      const date = new Date(timestamp)
      const now = new Date()
      const diffInHours = (now - date) / (1000 * 60 * 60)

      if (diffInHours < 1) {
        const diffInMinutes = Math.floor((now - date) / (1000 * 60))
        return diffInMinutes <= 0 ? 'Just now' : `${diffInMinutes}m ago`
      } else if (diffInHours < 24) {
        return `${Math.floor(diffInHours)}h ago`
      } else {
        const diffInDays = Math.floor(diffInHours / 24)
        return `${diffInDays}d ago`
      }
    } catch {
      return ''
    }
  }

  return (
    <>
      {/* Mobile Bottom Navigation - Updated for 6 items with better spacing */}
      {!isTest && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[rgb(var(--card)/0.92)] backdrop-blur-xl border-t border-[rgb(var(--border)/0.8)] shadow-lg">
          <div className="grid grid-cols-6 h-16">
            {navigationLinks?.slice(0, 6)?.map((link) => {
              const Icon = link?.icon
              const isActive = isActivePath(link?.href)
              const displayName = link?.shortName || link?.name
              return (
                <Link
                  key={link?.name}
                  to={link?.href}
                  className={`flex flex-col items-center justify-center space-y-1 px-1 transition-colors duration-200 ${
                    isActive
                      ? 'text-[rgb(var(--foreground))] bg-[rgb(var(--accent)/0.45)]'
                      : 'text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent)/0.35)]'
                  }`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-[10px] font-medium leading-tight text-center">
                    {displayName}
                  </span>
                </Link>
              )
            })}
          </div>
        </nav>
      )}

      {/* Desktop Header Navigation - Streamlined for space */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-[rgb(var(--card)/0.92)] backdrop-blur-xl border-b border-[rgb(var(--border)/0.8)] shadow-sm">
        <div className="w-full px-4 lg:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo - Compact for space */}
            <div className="flex items-center">
              <Link to="/" className="flex items-center space-x-2 group">
                <div className="w-9 h-9 rounded-lg bg-[rgb(var(--accent)/0.25)] border border-[rgb(var(--border))] flex items-center justify-center">
                  <img
                    src="/brand/logos/rocket-mark-white.png"
                    alt="Rocket Aftermarket Tracker"
                    className="w-6 h-6"
                    draggable="false"
                  />
                </div>
                {/* Reserved space for future logo - no text for now */}
                <div className="w-2"></div>
              </Link>
            </div>

            {/* Desktop Navigation - Tighter spacing for all 6 items */}
            <div className="flex items-center space-x-1">
              {navigationLinks?.map((link) => {
                const Icon = link?.icon
                const isActive = isActivePath(link?.href)
                return (
                  <Link
                    key={link?.name}
                    to={link?.href}
                    className={`flex items-center space-x-1.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? 'bg-[rgb(var(--accent)/0.45)] text-[rgb(var(--foreground))] border border-[rgb(var(--border))]'
                        : 'text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent)/0.35)]'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="hidden lg:inline">{link?.name}</span>
                  </Link>
                )
              })}
            </div>

            {/* Right Section */}
            <div className="flex items-center space-x-4">
              {/* Quick Navigation */}
              <div className="hidden lg:block">
                <QuickNavigation />
              </div>

              {/* Theme Selector */}
              <div className="hidden lg:block">
                <ThemeSelector />
              </div>

              {/* Enhanced Notifications with Real Data */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative p-2 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] transition-colors duration-200 rounded-lg hover:bg-[rgb(var(--accent)/0.35)]"
                  aria-label="Notifications"
                  aria-haspopup="menu"
                  aria-expanded={isNotificationOpen}
                >
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold px-1">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </div>
                  )}
                </button>

                {/* Notification Dropdown */}
                {isNotificationOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-[rgb(var(--card))] rounded-lg shadow-lg border border-[rgb(var(--border))] py-2 z-50 max-h-96 overflow-y-auto text-[rgb(var(--foreground))]">
                    <div className="px-4 py-3 border-b border-[rgb(var(--border))]">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-[rgb(var(--foreground))]">Recent Activity</h3>
                        {notificationLoading && (
                          <div className="text-xs text-[rgb(var(--muted-foreground))]">Loading...</div>
                        )}
                      </div>
                    </div>

                    <div className="py-1">
                      {notifications?.length > 0 ? (
                        notifications?.map((notification) => (
                          <div
                            key={notification?.id}
                            className="px-4 py-3 hover:bg-[rgb(var(--accent)/0.35)] border-b border-[rgb(var(--border))] last:border-b-0"
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0 mt-1">
                                <div
                                  className={`w-2 h-2 rounded-full ${
                                    notification?.is_successful ? 'bg-green-500' : 'bg-red-500'
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-[rgb(var(--foreground))] truncate">
                                  {notification?.subject || 'Communication'}
                                </p>
                                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1 line-clamp-2">
                                  {notification?.message ||
                                    `${notification?.communication_type} to ${notification?.recipient}`}
                                </p>
                                <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                                  {formatNotificationTime(notification?.sent_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <Bell className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                          <p className="text-sm text-[rgb(var(--muted-foreground))]">No recent notifications</p>
                          <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                            Communications will appear here
                          </p>
                        </div>
                      )}

                      {notifications?.length > 0 && (
                        <div className="px-4 py-3 border-t border-[rgb(var(--border))]">
                          <Link
                            to="/communications"
                            onClick={() => setIsNotificationOpen(false)}
                            className="text-sm text-[rgb(var(--foreground))] hover:text-[rgb(var(--foreground))] font-medium"
                          >
                            View all communications →
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* User Profile Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="flex items-center space-x-3 p-2 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] rounded-lg hover:bg-[rgb(var(--accent)/0.35)] transition-colors duration-200"
                  aria-label="Profile menu"
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                >
                  <div className="w-8 h-8 bg-[rgb(var(--accent)/0.45)] rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-[rgb(var(--foreground))]" />
                  </div>
                  <div className="hidden xl:block text-left">
                    <p className="text-sm font-medium">
                      {userProfile?.full_name || user?.email?.split('@')?.[0] || 'User'}
                    </p>
                    <p className="text-xs text-[rgb(var(--muted-foreground))] capitalize">
                      {userProfile?.role || 'Staff'}
                    </p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-[rgb(var(--card))] rounded-lg shadow-lg border border-[rgb(var(--border))] py-1 z-50 text-[rgb(var(--foreground))]">
                    <div className="px-4 py-3 border-b border-[rgb(var(--border))]">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-[rgb(var(--accent)/0.45)] rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-[rgb(var(--foreground))]" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[rgb(var(--foreground))]">
                            {userProfile?.full_name || 'User'}
                          </p>
                          <p className="text-xs text-[rgb(var(--muted-foreground))]">{user?.email}</p>
                          {userProfile?.role && (
                            <p className="text-xs text-[rgb(var(--muted-foreground))] capitalize font-medium">
                              {userProfile?.role}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="py-1">
                      <button
                        onClick={() => {
                          setIsProfileOpen(false)
                          navigate('/profile')
                        }}
                        className="flex items-center w-full px-4 py-2 text-sm text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent)/0.35)] hover:text-[rgb(var(--foreground))] transition-colors duration-200"
                      >
                        <User className="w-4 h-4 mr-3" />
                        Profile Settings
                      </button>

                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-[rgb(var(--accent)/0.35)] transition-colors duration-200"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile Top Header - Simplified */}
      <nav className="md:hidden bg-[rgb(var(--card)/0.92)] backdrop-blur-xl border-b border-[rgb(var(--border)/0.8)] shadow-sm sticky top-0 z-[70]">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo - Compact */}
          <Link to="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-[rgb(var(--accent)/0.25)] border border-[rgb(var(--border))] flex items-center justify-center">
              <img
                src="/brand/logos/rocket-mark-white.png"
                alt="Rocket Aftermarket Tracker"
                className="w-5 h-5"
                draggable="false"
              />
            </div>
            {/* Reserved minimal space for future logo */}
            <div className="w-1"></div>
          </Link>

          {/* Mobile Actions */}
          <div className="flex items-center space-x-3">
            {/* Mobile Notifications */}
            <button
              type="button"
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative p-2 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))]"
              aria-label="Notifications"
              aria-haspopup="menu"
              aria-expanded={isNotificationOpen}
            >
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-red-500 rounded-full text-xs text-white flex items-center justify-center font-bold px-1">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </div>
              )}
            </button>

            {/* Menu Button */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] rounded-lg hover:bg-[rgb(var(--accent)/0.35)]"
              aria-label={isMenuOpen ? 'Close menu' : 'Open menu'}
              aria-haspopup="menu"
              aria-expanded={isMenuOpen}
            >
              {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Notification Dropdown */}
        {isNotificationOpen && (
          <div className="border-t border-[rgb(var(--border))] bg-[rgb(var(--card))] max-h-60 overflow-y-auto">
            <div className="px-4 py-3 border-b border-[rgb(var(--border))]">
              <h3 className="text-sm font-medium text-[rgb(var(--foreground))]">Recent Activity</h3>
            </div>
            {notifications?.length > 0 ? (
              notifications?.slice(0, 3)?.map((notification) => (
                <div
                  key={notification?.id}
                  className="px-4 py-3 border-b border-[rgb(var(--border))] last:border-b-0"
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        notification?.is_successful ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-[rgb(var(--foreground))] truncate">
                        {notification?.subject || 'Communication'}
                      </p>
                      <p className="text-xs text-[rgb(var(--muted-foreground))] mt-1">
                        {formatNotificationTime(notification?.sent_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-[rgb(var(--muted-foreground))]">No recent notifications</p>
              </div>
            )}
          </div>
        )}

        {/* Mobile Slide-out Menu */}
        {isMenuOpen && (
          <>
            <div className="fixed inset-0 bg-black/50 z-[75]" onClick={() => setIsMenuOpen(false)} />
            <div className="fixed top-16 right-0 bottom-0 w-[min(18rem,100vw)] bg-[rgb(var(--card))] shadow-xl z-[80] overflow-y-auto border-l border-[rgb(var(--border))]">
              <div className="p-6">
                {/* User Profile Section */}
                <div className="flex items-center space-x-4 p-4 bg-[rgb(var(--accent)/0.25)] rounded-xl mb-6">
                  <div className="w-12 h-12 bg-[rgb(var(--accent)/0.45)] rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-[rgb(var(--foreground))]" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[rgb(var(--foreground))]">
                      {userProfile?.full_name || user?.email?.split('@')?.[0] || 'User'}
                    </p>
                    <p className="text-xs text-[rgb(var(--muted-foreground))]">{user?.email}</p>
                    {userProfile?.role && (
                      <p className="text-xs text-[rgb(var(--muted-foreground))] capitalize font-medium">
                        {userProfile?.role}
                      </p>
                    )}
                  </div>
                </div>

                {/* Theme Selector Mobile */}
                <div className="mb-6">
                  <ThemeSelector className="w-full" />
                </div>

                {/* Navigation Links */}
                <div className="space-y-1 mb-6">
                  <h3 className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wider mb-3">
                    Navigation
                  </h3>
                  {navigationLinks?.map((link) => {
                    const Icon = link?.icon
                    const isActive = isActivePath(link?.href)
                    return (
                      <Link
                        key={link?.name}
                        to={link?.href}
                        onClick={() => setIsMenuOpen(false)}
                        className={`flex items-center space-x-3 px-3 py-3 rounded-lg text-sm font-medium transition-colors duration-200 ${
                          isActive
                            ? 'bg-[rgb(var(--accent)/0.45)] text-[rgb(var(--foreground))] border border-[rgb(var(--border))]'
                            : 'text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent)/0.35)]'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{link?.name}</span>
                      </Link>
                    )
                  })}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-6 border-t border-[rgb(var(--border))]">
                  <h3 className="text-xs font-medium text-[rgb(var(--muted-foreground))] uppercase tracking-wider mb-3">
                    Account
                  </h3>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      navigate('/profile')
                    }}
                    className="flex items-center w-full space-x-3 px-3 py-3 text-sm text-[rgb(var(--muted-foreground))] hover:text-[rgb(var(--foreground))] hover:bg-[rgb(var(--accent)/0.35)] rounded-lg transition-colors duration-200"
                  >
                    <User className="w-5 h-5" />
                    <span>Profile Settings</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full space-x-3 px-3 py-3 text-sm text-red-400 hover:bg-[rgb(var(--accent)/0.35)] rounded-lg transition-colors duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </nav>

      {/* Click outside to close dropdowns */}
      {(isProfileOpen || isNotificationOpen) && (
        <div
          className="fixed inset-0 z-30"
          onClick={() => {
            setIsProfileOpen(false)
            setIsNotificationOpen(false)
          }}
        />
      )}

      <EnvChip className="fixed bottom-24 right-2 z-[60] md:bottom-8" />

      {buildLabel ? (
        <div
          className="pointer-events-none fixed bottom-20 right-2 z-[60] select-none text-[10px] text-[rgb(var(--muted-foreground))] md:bottom-2"
          aria-label="Build info"
          title={`Build ${buildLabel}${buildTimeIso ? ` @ ${buildTimeIso}` : ''}`}
        >
          build {buildLabel}
        </div>
      ) : null}
    </>
  )
}

export default Navbar
