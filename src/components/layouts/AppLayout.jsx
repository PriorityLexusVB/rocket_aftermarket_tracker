import React from 'react'
import { useLocation } from 'react-router-dom'
import Navbar from '../ui/Navbar'
import { DiagnosticsBanner } from '../DiagnosticsBanner'

const AppLayout = ({ children }) => {
  const location = useLocation()

  // Pages that should NOT have the navbar
  const excludeNavbarPaths = ['/guest-claims-submission-form']

  const shouldShowNavbar = !excludeNavbarPaths?.includes(location?.pathname)

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))] transition-colors duration-300">
      {/* Conditionally render Navbar - exclude for guest claims form */}
      {shouldShowNavbar && <Navbar />}

      {/* Diagnostics Banner - shows capability status */}
      {shouldShowNavbar && import.meta.env.DEV && <DiagnosticsBanner />}

      {/* Main content area with proper spacing for top navbar */}
      <main className={`${shouldShowNavbar ? 'pt-16 md:pt-16' : ''}`}>{children}</main>

      {/* Build SHA badge: show here only on routes where Navbar is excluded */}
      {!shouldShowNavbar && <NavbarBuildBadge />}
    </div>
  )
}

const NavbarBuildBadge = () => {
  const buildSha = typeof __BUILD_SHA__ === 'string' ? __BUILD_SHA__ : ''
  const buildTimeIso = typeof __BUILD_TIME__ === 'string' ? __BUILD_TIME__ : ''
  const buildLabel = buildSha ? buildSha.slice(0, 7) : ''

  return buildLabel ? (
    <div
      className="pointer-events-none fixed bottom-20 right-2 select-none text-[10px] text-gray-400 md:bottom-2"
      aria-label="Build info"
      title={`Build ${buildLabel}${buildTimeIso ? ` @ ${buildTimeIso}` : ''}`}
    >
      build {buildLabel}
    </div>
  ) : null
}

export default AppLayout
