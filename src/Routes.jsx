import React from 'react';
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';

// Import only the 4 consolidated pages
import NotFound from './pages/NotFound';
import AuthenticationPortal from './pages/authentication-portal';

// 4 Main Pages - Updated with Currently Active Appointments
import CalendarPage from './pages/calendar';
import DealsPage from './pages/deals';
import CurrentlyActiveAppointments from './pages/currently-active-appointments'
; // NEW: Replaces vehicles
import AdminPage from './pages/admin';

// NEW: Calendar Flow Management Center
import CalendarFlowManagementCenter from './pages/calendar-flow-management-center';

// NEW: Advanced Business Intelligence Analytics
import AdvancedBusinessIntelligenceAnalytics from './pages/advanced-business-intelligence-analytics';

// NEW: Claims Management Pages
import CustomerClaimsPortal from './pages/customer-claims-portal';
import ClaimsManagementCenter from './pages/claims-management-center';

// NEW: Claims Analytics Dashboard
import ClaimsAnalyticsDashboard from './pages/claims-analytics-dashboard';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <RouterRoutes>
          {/* Authentication */}
          <Route path="/auth" element={<AuthenticationPortal />} />

          {/* NEW: Claims Analytics Dashboard */}
          <Route path="/claims-analytics-dashboard" element={<ClaimsAnalyticsDashboard />} />

          {/* NEW: Calendar Flow Management Center */}
          <Route path="/calendar-flow-management-center" element={<CalendarFlowManagementCenter />} />

          {/* NEW: Currently Active Appointments (replaces vehicles) */}
          <Route path="/currently-active-appointments" element={<CurrentlyActiveAppointments />} />

          {/* NEW: Advanced Business Intelligence Analytics */}
          <Route path="/advanced-business-intelligence-analytics" element={<AdvancedBusinessIntelligenceAnalytics />} />

          {/* NEW: Claims Management Pages */}
          <Route path="/customer-claims-portal" element={<CustomerClaimsPortal />} />
          <Route path="/claims-management-center" element={<ClaimsManagementCenter />} />

          {/* 4 MAIN PAGES - Updated routing */}
          <Route path="/" element={<DealsPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/appointments" element={<CurrentlyActiveAppointments />} /> {/* Alternative route */}
          <Route path="/admin" element={<AdminPage />} />

          {/* Legacy Route Redirects - Updated */}
          <Route path="/dashboard" element={<Navigate to="/deals" replace />} />
          <Route path="/executive-analytics-dashboard" element={<Navigate to="/advanced-business-intelligence-analytics" replace />} />
          <Route path="/calendar-scheduling-center" element={<Navigate to="/calendar" replace />} />
          <Route path="/kanban-status-board" element={<Navigate to="/deals" replace />} />
          <Route path="/sales-tracker" element={<Navigate to="/deals" replace />} />
          <Route path="/sales-transaction-interface" element={<Navigate to="/deals" replace />} />
          
          {/* REMOVED: Vehicles page redirects to appointments */}
          <Route path="/vehicles" element={<Navigate to="/currently-active-appointments" replace />} />
          <Route path="/vehicle-management-hub" element={<Navigate to="/currently-active-appointments" replace />} />
          <Route path="/vehicle-detail-workstation" element={<Navigate to="/currently-active-appointments" replace />} />
          
          <Route path="/vendor-operations-center" element={<Navigate to="/admin" replace />} />
          <Route path="/vendor-job-dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="/administrative-configuration-center" element={<Navigate to="/admin" replace />} />
          
          {/* Catch all route */}
          <Route path="*" element={<NotFound />} />
        </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;