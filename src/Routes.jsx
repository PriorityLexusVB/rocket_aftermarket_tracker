import React, { Suspense, lazy } from 'react'
import {
  BrowserRouter,
  Routes as RouterRoutes,
  Route,
  Navigate,
  useLocation,
} from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import ScrollToTop from './components/ScrollToTop'
import ProtectedRoute from './components/ProtectedRoute'
import { ThemeProvider } from './contexts/ThemeContext'

// Import only the 4 consolidated pages
import NotFound from './pages/NotFound'
import AuthenticationPortal from './pages/authentication-portal'

// 4 Main Pages - Updated with Currently Active Appointments
const DealsPage = lazy(() => import('./pages/deals'))
const NewDeal = lazy(() => import('./pages/deals/NewDeal'))
const EditDeal = lazy(() => import('./pages/deals/EditDeal'))
const CurrentlyActiveAppointments = lazy(() => import('./pages/currently-active-appointments'))

// NEW: Calendar Flow Management Center
const CalendarFlowManagementCenter = lazy(() => import('./pages/calendar-flow-management-center'))
// Real Calendar (grid)
const CalendarSchedulingCenter = lazy(() => import('./pages/calendar'))
// Simple Agenda (feature-flagged)
const SimpleAgendaEnabled =
  String(import.meta.env.VITE_SIMPLE_CALENDAR || '').toLowerCase() === 'true'
const CalendarAgenda = SimpleAgendaEnabled ? lazy(() => import('./pages/calendar-agenda')) : null

// NEW: Advanced Business Intelligence Analytics
const AdvancedBusinessIntelligenceAnalytics = lazy(
  () => import('./pages/advanced-business-intelligence-analytics')
)

// Claims System - Consolidated to 2 essential pages
const ClaimsManagementCenter = lazy(() => import('./pages/claims-management-center'))
const GuestClaimsSubmissionForm = lazy(() => import('./pages/guest-claims-submission-form'))
const LoanerManagementDrawer = lazy(() => import('./pages/loaner-management-drawer'))

// Admin and utilities
const AdminPage = lazy(() => import('./pages/admin'))
const AdminCapabilities = lazy(() => import('./pages/AdminCapabilities'))
const DebugAuthPage = lazy(() => import('./pages/debug-auth'))
const CommunicationsCenter = lazy(() => import('./pages/communications'))
const ProfileSettings = lazy(() => import('./pages/profile'))

const Routes = () => {
  const CalendarAgendaRedirect = () => {
    const location = useLocation()
    const search = location?.search || ''
    return <Navigate to={`/calendar-flow-management-center${search}`} replace />
  }

  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ErrorBoundary>
        <ThemeProvider>
          <ScrollToTop />
          <Suspense fallback={<div className="p-6 text-gray-600">Loading…</div>}>
            <RouterRoutes>
              {/* 🔓 PUBLIC ROUTES - No authentication required */}

              {/* Guest Claims Form - ONLY public route for external customers */}
              <Route path="/guest-claims-submission-form" element={<GuestClaimsSubmissionForm />} />

              {/* Authentication Portal */}
              <Route path="/auth" element={<AuthenticationPortal />} />

              {/* 🔒 PROTECTED ROUTES - Authentication required */}

              {/* Main Application Pages */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DealsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deals"
                element={
                  <ProtectedRoute>
                    <DealsPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deals/:id/edit"
                element={
                  <ProtectedRoute>
                    <EditDeal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/deals/new"
                element={
                  <ProtectedRoute>
                    <NewDeal />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/debug-auth"
                element={
                  <ProtectedRoute>
                    <DebugAuthPage />
                  </ProtectedRoute>
                }
              />

              {/* Advanced Management Centers */}
              <Route
                path="/calendar/grid"
                element={
                  <ProtectedRoute>
                    <CalendarSchedulingCenter />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar-flow-management-center"
                element={
                  <ProtectedRoute>
                    <CalendarFlowManagementCenter />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar/agenda"
                element={
                  <ProtectedRoute>
                    {SimpleAgendaEnabled ? <CalendarAgenda /> : <CalendarAgendaRedirect />}
                  </ProtectedRoute>
                }
              />
              <Route
                path="/currently-active-appointments"
                element={
                  <ProtectedRoute>
                    <CurrentlyActiveAppointments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/advanced-business-intelligence-analytics"
                element={
                  <ProtectedRoute>
                    <AdvancedBusinessIntelligenceAnalytics />
                  </ProtectedRoute>
                }
              />

              {/* Admin route with proper component loading */}
              <Route
                path="/admin"
                element={
                  <ProtectedRoute>
                    <AdminPage />
                  </ProtectedRoute>
                }
              />

              {/* Admin Capabilities Diagnostics */}
              <Route
                path="/admin/capabilities"
                element={
                  <ProtectedRoute>
                    <AdminCapabilities />
                  </ProtectedRoute>
                }
              />

              {/* Communications Center */}
              <Route
                path="/communications"
                element={
                  <ProtectedRoute>
                    <CommunicationsCenter />
                  </ProtectedRoute>
                }
              />

              {/* Profile Settings */}
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <ProfileSettings />
                  </ProtectedRoute>
                }
              />

              {/* Calendar route - redirect to new calendar flow center */}
              <Route
                path="/calendar"
                element={
                  <Navigate
                    to={SimpleAgendaEnabled ? '/calendar/agenda' : '/calendar/grid'}
                    replace
                  />
                }
              />

              {/* Loaner Management */}
              <Route
                path="/loaner-management-drawer"
                element={
                  <ProtectedRoute>
                    <LoanerManagementDrawer />
                  </ProtectedRoute>
                }
              />

              {/* Claims Management - Internal only */}
              <Route
                path="/claims-management-center"
                element={
                  <ProtectedRoute>
                    <ClaimsManagementCenter />
                  </ProtectedRoute>
                }
              />

              {/* Protected Legacy Route Redirects */}
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Navigate to="/deals" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/executive-analytics-dashboard"
                element={
                  <ProtectedRoute>
                    <Navigate to="/advanced-business-intelligence-analytics" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/business-intelligence-reports"
                element={
                  <ProtectedRoute>
                    <Navigate to="/advanced-business-intelligence-analytics" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/calendar-scheduling-center"
                element={
                  <ProtectedRoute>
                    <Navigate to="/calendar/grid" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/kanban-status-board"
                element={
                  <ProtectedRoute>
                    <Navigate to="/deals" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales-tracker"
                element={
                  <ProtectedRoute>
                    <Navigate to="/deals" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/sales-transaction-interface"
                element={
                  <ProtectedRoute>
                    <Navigate to="/deals" replace />
                  </ProtectedRoute>
                }
              />

              {/* Vehicle Management Redirects */}
              <Route
                path="/vehicles"
                element={
                  <ProtectedRoute>
                    <Navigate to="/currently-active-appointments" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vehicle-management-hub"
                element={
                  <ProtectedRoute>
                    <Navigate to="/currently-active-appointments" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vehicle-detail-workstation"
                element={
                  <ProtectedRoute>
                    <Navigate to="/currently-active-appointments" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/photo-documentation-center"
                element={
                  <ProtectedRoute>
                    <Navigate to="/deals" replace />
                  </ProtectedRoute>
                }
              />

              {/* Admin Area Redirects */}
              <Route
                path="/vendor-operations-center"
                element={
                  <ProtectedRoute>
                    <Navigate to="/admin" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/vendor-job-dashboard"
                element={
                  <ProtectedRoute>
                    <Navigate to="/admin" replace />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/administrative-configuration-center"
                element={
                  <ProtectedRoute>
                    <Navigate to="/admin" replace />
                  </ProtectedRoute>
                }
              />

              {/* Claims System - Redirect duplicate/unnecessary pages */}
              <Route
                path="/customer-claims-portal"
                element={<Navigate to="/guest-claims-submission-form" replace />}
              />
              <Route
                path="/customer-claims-submission-portal"
                element={<Navigate to="/guest-claims-submission-form" replace />}
              />
              <Route
                path="/claims-analytics-dashboard"
                element={
                  <ProtectedRoute>
                    <Navigate to="/claims-management-center" replace />
                  </ProtectedRoute>
                }
              />

              {/* 404 Not Found */}
              <Route path="*" element={<NotFound />} />
            </RouterRoutes>
          </Suspense>
        </ThemeProvider>
      </ErrorBoundary>
    </BrowserRouter>
  )
}

export default Routes
