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
    <div className="min-h-screen bg-gray-50">
      {/* Conditionally render Navbar - exclude for guest claims form */}
      {shouldShowNavbar && <Navbar />}

      {/* Diagnostics Banner - shows capability status */}
      {shouldShowNavbar && import.meta.env.DEV && <DiagnosticsBanner />}

      {/* Main content area with proper spacing for top navbar */}
      <main className={`${shouldShowNavbar ? 'pt-16 md:pt-16' : ''}`}>
        {children}
      </main>
    </div>
  )
}

export default AppLayout
