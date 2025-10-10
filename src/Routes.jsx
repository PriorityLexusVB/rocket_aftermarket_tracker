import React from 'react';
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';
import ProtectedRoute from './components/ProtectedRoute';

// Import only the 4 consolidated pages
import NotFound from './pages/NotFound';
import AuthenticationPortal from './pages/authentication-portal';

// 4 Main Pages - Updated with Currently Active Appointments
import CalendarPage from './pages/calendar';
import DealsPage from './pages/deals';
import CurrentlyActiveAppointments from './pages/currently-active-appointments';
import AdminPage from './pages/admin';

// NEW: Calendar Flow Management Center
import CalendarFlowManagementCenter from './pages/calendar-flow-management-center';

// NEW: Advanced Business Intelligence Analytics
import AdvancedBusinessIntelligenceAnalytics from './pages/advanced-business-intelligence-analytics';

// Claims System - Consolidated to 2 essential pages
import ClaimsManagementCenter from './pages/claims-management-center';
import GuestClaimsSubmissionForm from './pages/guest-claims-submission-form';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <RouterRoutes>
          {/* 🔓 PUBLIC ROUTES - No authentication required */}
          
          {/* Guest Claims Form - ONLY public route for external customers */}
          <Route path="/guest-claims-submission-form" element={<GuestClaimsSubmissionForm />} />
          
          {/* Authentication Portal */}
          <Route path="/auth" element={<AuthenticationPortal />} />

          {/* 🔒 PROTECTED ROUTES - Authentication required */}
          
          {/* Main Application Pages */}
          <Route path="/" element={<ProtectedRoute><DealsPage /></ProtectedRoute>} />
          <Route path="/deals" element={<ProtectedRoute><DealsPage /></ProtectedRoute>} />
          <Route path="/calendar" element={<ProtectedRoute><CalendarPage /></ProtectedRoute>} />
          <Route path="/appointments" element={<ProtectedRoute><CurrentlyActiveAppointments /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminPage /></ProtectedRoute>} />

          {/* Advanced Management Centers */}
          <Route path="/calendar-flow-management-center" element={<ProtectedRoute><CalendarFlowManagementCenter /></ProtectedRoute>} />
          <Route path="/currently-active-appointments" element={<ProtectedRoute><CurrentlyActiveAppointments /></ProtectedRoute>} />
          <Route path="/advanced-business-intelligence-analytics" element={<ProtectedRoute><AdvancedBusinessIntelligenceAnalytics /></ProtectedRoute>} />

          {/* Claims Management - Internal only */}
          <Route path="/claims-management-center" element={<ProtectedRoute><ClaimsManagementCenter /></ProtectedRoute>} />

          {/* Protected Legacy Route Redirects */}
          <Route path="/dashboard" element={<ProtectedRoute><Navigate to="/deals" replace /></ProtectedRoute>} />
          <Route path="/executive-analytics-dashboard" element={<ProtectedRoute><Navigate to="/advanced-business-intelligence-analytics" replace /></ProtectedRoute>} />
          <Route path="/calendar-scheduling-center" element={<ProtectedRoute><Navigate to="/calendar" replace /></ProtectedRoute>} />
          <Route path="/kanban-status-board" element={<ProtectedRoute><Navigate to="/deals" replace /></ProtectedRoute>} />
          <Route path="/sales-tracker" element={<ProtectedRoute><Navigate to="/deals" replace /></ProtectedRoute>} />
          <Route path="/sales-transaction-interface" element={<ProtectedRoute><Navigate to="/deals" replace /></ProtectedRoute>} />
          
          {/* Vehicle Management Redirects */}
          <Route path="/vehicles" element={<ProtectedRoute><Navigate to="/currently-active-appointments" replace /></ProtectedRoute>} />
          <Route path="/vehicle-management-hub" element={<ProtectedRoute><Navigate to="/currently-active-appointments" replace /></ProtectedRoute>} />
          <Route path="/vehicle-detail-workstation" element={<ProtectedRoute><Navigate to="/currently-active-appointments" replace /></ProtectedRoute>} />
          
          {/* Admin Area Redirects */}
          <Route path="/vendor-operations-center" element={<ProtectedRoute><Navigate to="/admin" replace /></ProtectedRoute>} />
          <Route path="/vendor-job-dashboard" element={<ProtectedRoute><Navigate to="/admin" replace /></ProtectedRoute>} />
          <Route path="/administrative-configuration-center" element={<ProtectedRoute><Navigate to="/admin" replace /></ProtectedRoute>} />
          
          {/* Claims System - Redirect duplicate/unnecessary pages */}
          <Route path="/customer-claims-portal" element={<Navigate to="/guest-claims-submission-form" replace />} />
          <Route path="/customer-claims-submission-portal" element={<Navigate to="/guest-claims-submission-form" replace />} />
          <Route path="/claims-analytics-dashboard" element={<ProtectedRoute><Navigate to="/claims-management-center" replace /></ProtectedRoute>} />
          
          {/* 404 Not Found */}
          <Route path="*" element={<NotFound />} />
        </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;