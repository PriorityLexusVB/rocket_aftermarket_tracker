import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import Menu from 'lucide-react/dist/esm/icons/menu.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import Bell from 'lucide-react/dist/esm/icons/bell.js'
// Wave XXX-AE: Help icon for the new How It Works guide
import HelpCircle from 'lucide-react/dist/esm/icons/circle-help.js'
// Wave XXX-AH: FileText for the New Claims pill icon
import FileTextAlert from 'lucide-react/dist/esm/icons/file-text.js'
import User from 'lucide-react/dist/esm/icons/user.js'
import LogOut from 'lucide-react/dist/esm/icons/log-out.js'
import Settings from 'lucide-react/dist/esm/icons/settings.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import Car from 'lucide-react/dist/esm/icons/car.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import BarChart3 from 'lucide-react/dist/esm/icons/bar-chart-3.js'
import Clock from 'lucide-react/dist/esm/icons/clock.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import MoreHorizontal from 'lucide-react/dist/esm/icons/more-horizontal.js'
import HomeIcon from 'lucide-react/dist/esm/icons/home.js'
import AlertTriangle from 'lucide-react/dist/esm/icons/alert-triangle.js'
import { useAuth } from '../../contexts/AuthContext'
// Wave XXX-AH: real-time New Claims pill
import { useNewClaimsBadge } from '@/hooks/useNewClaimsBadge'
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

  // Wave XXX-AH: real-time count of "submitted" (unworked) claims for the
  // navbar pill. Pulses when a new one has arrived since the user's last
  // visit to the claims page. Per-user last-seen lives in localStorage.
  const claimsBadge = useNewClaimsBadge({
    userId: user?.id,
    enabled: !!user?.id,
  })

  // Auto-mark-as-seen when the user navigates to the claims page.
  // Wave XXX-AH hotfix-1 (Codex REQUIRED H): guard on user?.id so we don't
  // call markAsSeen during the auth-hydration window (which would write to
  // localStorage under an empty key + then never re-run on user resolution).
  useEffect(() => {
    if (
      location?.pathname === '/claims-management-center' &&
      user?.id &&
      claimsBadge?.markAsSeen
    ) {
      claimsBadge.markAsSeen()
    }
  }, [location?.pathname, user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ensure content can scroll past the fixed mobile bottom nav.
  // Close mobile drawer when Escape is pressed — focus is not trapped, so Escape
  // is the only keyboard exit besides the visible close affordances.
  useEffect(() => {
    if (!isMenuOpen) return
    if (typeof document === 'undefined') return
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setIsMenuOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [isMenuOpen])

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

  // Wave XXX-D nav order: the first 5 entries are pinned in the mobile bottom bar
  // (slice(0,5)). Order reflects daily-use priority for the GSM + coordinator:
  // Home, Calendar (today's board), Overdue (urgent), Deals (workflow), Appointments.
  // Claims / Loaners / Analytics / Admin live in the "More" drawer.
  const navigationLinks = [
    { name: 'Home', href: '/', icon: HomeIcon, shortName: 'Home' },
    {
      name: 'Calendar',
      href: getCalendarDestination({ target: 'board', range: 'day' }),
      icon: Calendar,
    },
    { name: 'Overdue', href: '/overdue', icon: AlertTriangle, shortName: 'Overdue' },
    { name: 'Deals', href: '/deals', icon: Package },
    {
      name: 'Appointments',
      href: '/currently-active-appointments',
      icon: Clock,
      shortName: 'Active',
    },
    { name: 'Claims', href: '/claims-management-center', icon: FileText },
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
    // Some nav hrefs include query strings (e.g. Calendar → /calendar?view=board).
    // Compare on pathname only, not the full href, so the active state matches.
    const pathOnly = (path || '').split('?')[0].split('#')[0]
    if (!pathOnly) return false
    return location?.pathname === pathOnly || location?.pathname?.startsWith(pathOnly + '/')
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
      {/* Mobile Bottom Navigation - 5 pinned items + More drawer trigger */}
      {!isTest && (
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border/80 shadow-lg">
          <div className="grid grid-cols-6 h-16">
            {navigationLinks?.slice(0, 5)?.map((link) => {
              const Icon = link?.icon
              const isActive = isActivePath(link?.href)
              const displayName = link?.shortName || link?.name
              return (
                <Link
                  key={link?.name}
                  to={link?.href}
                  title={link?.name}
                  aria-label={link?.name}
                  className={`flex flex-col items-center justify-center space-y-1 px-1 transition-colors duration-200 ${
                    isActive
                      ? 'text-foreground bg-accent/25'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent/35'
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
            {/* More button — opens slide-out drawer (Analytics + Admin reachable there) */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(true)}
              title="More"
              aria-label="Open more navigation"
              className="flex flex-col items-center justify-center space-y-1 px-1 text-muted-foreground hover:text-foreground hover:bg-accent/35 transition-colors duration-200"
            >
              <MoreHorizontal className="w-4 h-4" />
              <span className="text-[10px] font-medium leading-tight text-center">More</span>
            </button>
          </div>
        </nav>
      )}

      {/* Desktop Header Navigation — Wave J Lexus masthead surface */}
      <nav
        className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-lex-brand border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)]"
      >
        <div className="w-full px-4 lg:px-6">
          <div className="flex justify-between items-center h-16">
            {/* Logo — Wave J: two-line identity (Priority Lexus eyebrow + display wordmark) */}
            <div className="flex items-center">
              <Link
                to="/"
                className="flex items-center space-x-3 group"
                aria-label="Priority Lexus Aftermarket Tracker — home"
              >
                <div className="w-9 h-9 rounded-lg flex items-center justify-center ring-1 ring-white/10 bg-white/[0.04]">
                  <img
                    src="/brand/rat-icon-master.svg"
                    alt=""
                    className="h-7 w-7 object-contain"
                    draggable="false"
                  />
                </div>
                <div className="hidden lg:flex flex-col leading-none">
                  <span className="text-[9px] font-semibold tracking-[0.28em] uppercase text-lex-platinum/80">
                    Priority Lexus
                  </span>
                  <span className="mt-0.5 font-display text-[15px] font-semibold tracking-tight text-lex-ink-inv whitespace-nowrap">
                    Aftermarket Tracker
                  </span>
                </div>
              </Link>
            </div>

            {/* Desktop Navigation - Labels visible at md+ (768px+) */}
            <div className="flex items-center space-x-0.5">
              {navigationLinks?.map((link) => {
                const Icon = link?.icon
                const isActive = isActivePath(link?.href)
                return (
                  <Link
                    key={link?.name}
                    to={link?.href}
                    title={link?.name}
                    aria-label={link?.name}
                    className={`flex items-center space-x-1.5 px-3 py-2 rounded-md text-[13px] font-medium transition-all duration-150 ${
                      isActive
                        ? 'bg-white/[0.08] text-lex-ink-inv ring-1 ring-white/15'
                        : 'text-lex-ink-inv-muted hover:text-lex-ink-inv hover:bg-white/[0.04]'
                    }`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span className="hidden md:inline whitespace-nowrap">{link?.name}</span>
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

              {/* Enhanced Notifications with Real Data — Wave J: dark-surface */}
              <div className="relative">
                {/* Wave XXX-AH: New Claims pill — real-time count of unworked
                    customer-submitted claims. Pulses when a new one arrives
                    since the user's last claims-page visit. */}
                {claimsBadge?.count > 0 && (
                  <Link
                    to="/claims-management-center?status=submitted"
                    onClick={() => claimsBadge?.markAsSeen?.()}
                    className={`relative inline-flex items-center gap-1.5 mr-1 px-2.5 py-1.5 rounded-full text-xs font-semibold ring-1 transition-all
                      ${
                        claimsBadge?.shouldPulse
                          ? 'bg-red-500/15 text-red-100 ring-red-400/60 animate-pulse-slow'
                          : 'bg-white/[0.08] text-lex-ink-inv ring-white/15 hover:bg-white/[0.12]'
                      }`}
                    aria-label={`${claimsBadge.count} new claim${claimsBadge.count === 1 ? '' : 's'} waiting`}
                    title="New claim submissions"
                  >
                    {claimsBadge?.shouldPulse && (
                      <span
                        aria-hidden="true"
                        className="absolute inset-0 rounded-full ring-2 ring-red-400/70 animate-ping-slow pointer-events-none"
                      />
                    )}
                    <FileTextAlert className="w-3.5 h-3.5" />
                    <span className="whitespace-nowrap">
                      {claimsBadge.count} new claim{claimsBadge.count === 1 ? '' : 's'}
                    </span>
                  </Link>
                )}

                {/* Wave XXX-AE: Help button — opens the How It Works guide */}
                <Link
                  to="/how-it-works"
                  className="p-2 text-lex-ink-inv-muted hover:text-lex-ink-inv transition-colors duration-150 rounded-md hover:bg-white/[0.06] mr-1"
                  aria-label="How Rocket works — guide for coordinators"
                  title="How it works"
                >
                  <HelpCircle className="w-5 h-5" />
                </Link>

                <button
                  type="button"
                  onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                  className="relative p-2 text-lex-ink-inv-muted hover:text-lex-ink-inv transition-colors duration-150 rounded-md hover:bg-white/[0.06]"
                  aria-label="Notifications"
                  aria-haspopup="menu"
                  aria-expanded={isNotificationOpen}
                >
                  <Bell className="w-5 h-5" />
                  {notificationCount > 0 && (
                    <div className="absolute -top-1 -right-1 min-w-[18px] h-[18px] bg-lex-urgent rounded-full text-[10px] text-white flex items-center justify-center font-bold px-1 ring-2 ring-lex-brand">
                      {notificationCount > 99 ? '99+' : notificationCount}
                    </div>
                  )}
                </button>

                {/* Notification Dropdown */}
                {isNotificationOpen && (
                  <div className="absolute right-0 mt-2 w-80 bg-card rounded-lg shadow-lg border border-border py-2 z-50 max-h-96 overflow-y-auto text-foreground">
                    <div className="px-4 py-3 border-b border-border">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-medium text-foreground">Notifications</h3>
                        {notificationLoading && (
                          <div className="text-xs text-muted-foreground">Loading...</div>
                        )}
                      </div>
                    </div>

                    <div className="py-1">
                      {notifications?.length > 0 ? (
                        notifications?.map((notification) => (
                          <div
                            key={notification?.id}
                            className="px-4 py-3 hover:bg-accent/35 border-b border-border last:border-b-0"
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
                                <p className="text-sm text-foreground truncate">
                                  {notification?.subject || 'Communication'}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                  {notification?.message ||
                                    `${notification?.communication_type} to ${notification?.recipient}`}
                                </p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {formatNotificationTime(notification?.sent_at)}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="px-4 py-6 text-center">
                          <Bell className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                          <p className="text-sm text-muted-foreground">No recent notifications</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Communications will appear here
                          </p>
                        </div>
                      )}

                      {notifications?.length > 0 && (
                        <div className="px-4 py-3 border-t border-border">
                          <Link
                            to="/communications"
                            onClick={() => setIsNotificationOpen(false)}
                            className="text-sm text-foreground hover:text-foreground font-medium"
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
                  className="flex items-center space-x-3 p-2 text-muted-foreground hover:text-foreground rounded-lg hover:bg-accent/35 transition-colors duration-200"
                  aria-label="Profile menu"
                  aria-haspopup="menu"
                  aria-expanded={isProfileOpen}
                >
                  <div className="w-8 h-8 bg-accent/25 rounded-lg flex items-center justify-center">
                    <User className="w-4 h-4 text-foreground" />
                  </div>
                  <div className="hidden xl:block text-left">
                    <p className="text-sm font-medium">
                      {userProfile?.full_name || user?.email?.split('@')?.[0] || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {userProfile?.role || 'Staff'}
                    </p>
                  </div>
                </button>

                {/* Dropdown Menu */}
                {isProfileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-card rounded-lg shadow-lg border border-border py-1 z-50 text-foreground">
                    <div className="px-4 py-3 border-b border-border">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-accent/25 rounded-lg flex items-center justify-center">
                          <User className="w-5 h-5 text-foreground" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {userProfile?.full_name || 'User'}
                          </p>
                          <p className="text-xs text-muted-foreground">{user?.email}</p>
                          {userProfile?.role && (
                            <p className="text-xs text-muted-foreground capitalize font-medium">
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
                        className="flex items-center w-full px-4 py-2 text-sm text-foreground hover:bg-accent/35 hover:text-foreground transition-colors duration-200"
                      >
                        <User className="w-4 h-4 mr-3" />
                        Profile Settings
                      </button>

                      <button
                        onClick={handleSignOut}
                        className="flex items-center w-full px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors duration-200"
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

      {/* Mobile Top Header — Wave J Lexus masthead */}
      <nav className="md:hidden bg-lex-brand border-b border-white/[0.06] shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_8px_24px_-12px_rgba(0,0,0,0.6)] sticky top-0 z-[70]">
        <div className="flex items-center justify-between h-16 px-4">
          {/* Logo — Wave J: Priority Lexus identity stack */}
          <Link to="/" className="flex items-center space-x-3" aria-label="Priority Lexus Aftermarket Tracker — home">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center ring-1 ring-white/10 bg-white/[0.04]">
              <img
                src="/brand/rat-icon-master.svg"
                alt=""
                className="h-7 w-7 object-contain"
                draggable="false"
              />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[8.5px] font-semibold tracking-[0.26em] uppercase text-lex-platinum/80">
                Priority Lexus
              </span>
              <span className="mt-0.5 font-display text-[13.5px] font-semibold tracking-tight text-lex-ink-inv">
                Aftermarket Tracker
              </span>
            </div>
          </Link>

          {/* Mobile Actions — Wave J: dark-surface treatment */}
          <div className="flex items-center space-x-2">
            {/* Wave XXX-AH: New Claims pill on mobile — same real-time signal
                coordinators get on desktop, compact for narrow screens. */}
            {claimsBadge?.count > 0 && (
              <Link
                to="/claims-management-center?status=submitted"
                onClick={() => claimsBadge?.markAsSeen?.()}
                className={`relative inline-flex items-center gap-1 px-2 py-1.5 rounded-full text-[11px] font-semibold ring-1 transition-all
                  ${
                    claimsBadge?.shouldPulse
                      ? 'bg-red-500/15 text-red-100 ring-red-400/60 animate-pulse-slow'
                      : 'bg-white/[0.08] text-lex-ink-inv ring-white/15'
                  }`}
                aria-label={`${claimsBadge.count} new claim${claimsBadge.count === 1 ? '' : 's'} waiting`}
                title="New claims"
              >
                {claimsBadge?.shouldPulse && (
                  <span
                    aria-hidden="true"
                    className="absolute inset-0 rounded-full ring-2 ring-red-400/70 animate-ping-slow pointer-events-none"
                  />
                )}
                <FileTextAlert className="w-3 h-3" />
                <span>{claimsBadge.count}</span>
              </Link>
            )}

            {/* Wave XXX-AE: Help button on mobile — coordinator guide MUST be
                reachable from phones (where new reps often look first). */}
            <Link
              to="/how-it-works"
              className="p-2 text-lex-ink-inv-muted hover:text-lex-ink-inv rounded-md hover:bg-white/[0.06] transition-colors"
              aria-label="How Rocket works — guide for coordinators"
              title="How it works"
            >
              <HelpCircle className="w-5 h-5" />
            </Link>
            {/* Mobile Notifications */}
            <button
              type="button"
              onClick={() => setIsNotificationOpen(!isNotificationOpen)}
              className="relative p-2 text-lex-ink-inv-muted hover:text-lex-ink-inv rounded-md hover:bg-white/[0.06] transition-colors"
              aria-label="Notifications"
              aria-haspopup="menu"
              aria-expanded={isNotificationOpen}
            >
              <Bell className="w-5 h-5" />
              {notificationCount > 0 && (
                <div className="absolute -top-1 -right-1 min-w-[16px] h-[16px] bg-lex-urgent rounded-full text-[10px] text-white flex items-center justify-center font-bold px-1 ring-2 ring-lex-brand">
                  {notificationCount > 99 ? '99+' : notificationCount}
                </div>
              )}
            </button>

            {/* Menu Button */}
            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className="p-2 text-lex-ink-inv-muted hover:text-lex-ink-inv rounded-md hover:bg-white/[0.06] transition-colors"
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
          <div className="border-t border-border bg-card max-h-60 overflow-y-auto">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-foreground">Notifications</h3>
            </div>
            {notifications?.length > 0 ? (
              notifications?.slice(0, 3)?.map((notification) => (
                <div
                  key={notification?.id}
                  className="px-4 py-3 border-b border-border last:border-b-0"
                >
                  <div className="flex items-start space-x-3">
                    <div
                      className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                        notification?.is_successful ? 'bg-green-500' : 'bg-red-500'
                      }`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">
                        {notification?.subject || 'Communication'}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatNotificationTime(notification?.sent_at)}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-4 py-6 text-center">
                <p className="text-sm text-muted-foreground">No recent notifications</p>
              </div>
            )}
          </div>
        )}

        {/* Mobile Slide-out Menu — portaled to document.body to escape backdrop-filter containing block */}
        {isMenuOpen && createPortal(
          <>
            <div
              className="fixed inset-0 bg-black/50 z-[75]"
              onClick={() => setIsMenuOpen(false)}
            />
            <div className="fixed top-16 right-0 bottom-0 w-[min(18rem,100vw)] bg-card shadow-xl z-[80] overflow-y-auto border-l border-border">
              <div className="p-6">
                {/* User Profile Section */}
                <div className="flex items-center space-x-4 p-4 bg-card rounded-xl mb-6">
                  <div className="w-12 h-12 bg-accent/25 rounded-xl flex items-center justify-center shrink-0">
                    <User className="w-6 h-6 text-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {userProfile?.full_name || user?.email?.split('@')?.[0] || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate" title={user?.email}>{user?.email}</p>
                    {userProfile?.role && (
                      <p className="text-xs text-muted-foreground capitalize font-medium truncate">
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
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
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
                            ? 'bg-accent/25 text-foreground border border-border'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent/35'
                        }`}
                      >
                        <Icon className="w-5 h-5" />
                        <span>{link?.name}</span>
                      </Link>
                    )
                  })}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 pt-6 border-t border-border">
                  <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
                    Account
                  </h3>

                  <button
                    onClick={() => {
                      setIsMenuOpen(false)
                      navigate('/profile')
                    }}
                    className="flex items-center w-full space-x-3 px-3 py-3 text-sm text-muted-foreground hover:text-foreground hover:bg-accent/35 rounded-lg transition-colors duration-200"
                  >
                    <User className="w-5 h-5" />
                    <span>Profile Settings</span>
                  </button>

                  <button
                    onClick={handleSignOut}
                    className="flex items-center w-full space-x-3 px-3 py-3 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition-colors duration-200"
                  >
                    <LogOut className="w-5 h-5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            </div>
          </>,
          document.body
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

      {!import.meta.env.PROD && (
        <>
          <EnvChip className="fixed bottom-24 right-2 z-[60] md:bottom-8" />

          {buildLabel ? (
            <div
              className="pointer-events-none fixed bottom-20 right-2 z-[60] select-none text-[10px] text-muted-foreground md:bottom-2"
              aria-label="Build info"
              title={`Build ${buildLabel}${buildTimeIso ? ` @ ${buildTimeIso}` : ''}`}
            >
              build {buildLabel}
            </div>
          ) : null}
        </>
      )}
    </>
  )
}

export default Navbar
