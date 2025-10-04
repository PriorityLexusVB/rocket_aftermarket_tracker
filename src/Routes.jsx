import React from 'react';
import { BrowserRouter, Routes as RouterRoutes, Route, Navigate } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';

// Import only the 4 consolidated pages
import NotFound from './pages/NotFound';
import AuthenticationPortal from './pages/authentication-portal';

// 4 Main Pages - Deals-First Design (Changed from Calendar-First)
import CalendarPage from './pages/calendar';
import DealsPage from './pages/deals';
import VehiclesPage from './pages/vehicles'; 
import AdminPage from './pages/admin';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <RouterRoutes>
          {/* Authentication */}
          <Route path="/auth" element={<AuthenticationPortal />} />

          {/* 4 MAIN PAGES - Deals Dashboard as Main Page */}
          <Route path="/" element={<DealsPage />} />
          <Route path="/deals" element={<DealsPage />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/vehicles" element={<VehiclesPage />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* Legacy Route Redirects - All redirect to deals now */}
          <Route path="/dashboard" element={<Navigate to="/deals" replace />} />
          <Route path="/executive-analytics-dashboard" element={<Navigate to="/deals" replace />} />
          <Route path="/calendar-scheduling-center" element={<Navigate to="/calendar" replace />} />
          <Route path="/kanban-status-board" element={<Navigate to="/deals" replace />} />
          <Route path="/sales-tracker" element={<Navigate to="/deals" replace />} />
          <Route path="/sales-transaction-interface" element={<Navigate to="/deals" replace />} />
          <Route path="/vehicle-management-hub" element={<Navigate to="/vehicles" replace />} />
          <Route path="/vehicle-detail-workstation" element={<Navigate to="/vehicles" replace />} />
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