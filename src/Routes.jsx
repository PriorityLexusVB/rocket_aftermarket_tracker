import React from 'react';
import { BrowserRouter, Routes as RouterRoutes, Route } from 'react-router-dom';
import ErrorBoundary from './components/ErrorBoundary';
import ScrollToTop from './components/ScrollToTop';

// Import existing pages
import NotFound from './pages/NotFound';
import AuthenticationPortal from './pages/authentication-portal';
import ExecutiveAnalyticsDashboard from './pages/executive-analytics-dashboard';
import SalesTracker from './pages/sales-tracker';
import VehicleManagementHub from './pages/vehicle-management-hub';
import VehicleDetailWorkstation from './pages/vehicle-detail-workstation';
import VendorOperationsCenter from './pages/vendor-operations-center';
import VendorJobDashboard from './pages/vendor-job-dashboard';
import SalesTransactionInterface from './pages/sales-transaction-interface';
import AdministrativeConfigurationCenter from './pages/administrative-configuration-center';
import BusinessIntelligenceReports from './pages/business-intelligence-reports';
import CalendarSchedulingCenter from './pages/calendar-scheduling-center';
import KanbanStatusBoard from './pages/kanban-status-board';
import PhotoDocumentationCenter from './pages/photo-documentation-center';

const Routes = () => {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <ScrollToTop />
        <RouterRoutes>
          {/* Authentication */}
          <Route path="/" element={<AuthenticationPortal />} />

          {/* Primary Dashboard Landing - Executive Analytics */}
          <Route path="/dashboard" element={<ExecutiveAnalyticsDashboard />} />
          <Route path="/executive-analytics-dashboard" element={<ExecutiveAnalyticsDashboard />} />

          {/* Operations - Daily Tasks */}
          <Route path="/sales-tracker" element={<SalesTracker />} />
          <Route path="/vehicle-management-hub" element={<VehicleManagementHub />} />
          <Route path="/vehicle-detail-workstation" element={<VehicleDetailWorkstation />} />
          <Route path="/calendar-scheduling-center" element={<CalendarSchedulingCenter />} />
          <Route path="/kanban-status-board" element={<KanbanStatusBoard />} />

          {/* Management - Admin Tasks */}
          <Route path="/vendor-operations-center" element={<VendorOperationsCenter />} />
          <Route path="/vendor-job-dashboard" element={<VendorJobDashboard />} />
          <Route path="/sales-transaction-interface" element={<SalesTransactionInterface />} />
          <Route path="/administrative-configuration-center" element={<AdministrativeConfigurationCenter />} />

          {/* Reporting - Analysis */}
          <Route path="/business-intelligence-reports" element={<BusinessIntelligenceReports />} />
          <Route path="/photo-documentation-center" element={<PhotoDocumentationCenter />} />

          {/* Catch all route */}
          <Route path="*" element={<NotFound />} />
        </RouterRoutes>
      </ErrorBoundary>
    </BrowserRouter>
  );
};

export default Routes;