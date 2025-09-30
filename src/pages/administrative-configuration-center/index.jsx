import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useLogger } from '../../hooks/useLogger';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import VendorManagement from './components/VendorManagement';
import ProductCatalog from './components/ProductCatalog';
import ServiceCategories from './components/ServiceCategories';
import UserManagement from './components/UserManagement';

const TABS = [
  { id: 'vendors', label: 'Vendor Management', icon: '👥' },
  { id: 'products', label: 'Product Catalog', icon: '📦' },
  { id: 'services', label: 'Service Categories', icon: '🔧' },
  { id: 'users', label: 'User Management', icon: '👤' }
];

const AdministrativeConfigurationCenter = () => {
  const { userProfile, isManager } = useAuth();
  const { logInfo, logError, logWarning } = useLogger();
  const [activeTab, setActiveTab] = useState('vendors');
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const initializeConfigCenter = async () => {
      try {
        await logInfo(
          'page_accessed',
          'SYSTEM',
          'admin-config',
          `Administrative Configuration Center accessed by ${userProfile?.email}`,
          {
            userId: userProfile?.id,
            userRole: userProfile?.role,
            accessTime: new Date()?.toISOString()
          }
        );

        // Check permissions
        if (!isManager) {
          await logWarning(
            'access_denied',
            'SYSTEM',
            'admin-config',
            `Unauthorized access attempt by ${userProfile?.email}`,
            {
              userId: userProfile?.id,
              userRole: userProfile?.role,
              requiredRole: 'manager'
            }
          );
        }

        setLoading(false);
      } catch (error) {
        console.error('Error initializing config center:', error);
        await logError(error, {
          context: 'admin-config-initialization',
          userId: userProfile?.id
        });
        setLoading(false);
      }
    };

    initializeConfigCenter();
  }, [userProfile, isManager, logInfo, logWarning, logError]);

  const handleTabChange = async (tabId) => {
    try {
      await logInfo(
        'tab_changed',
        'USER',
        userProfile?.id,
        `Tab changed to ${tabId}`,
        {
          fromTab: activeTab,
          toTab: tabId,
          timestamp: new Date()?.toISOString()
        }
      );

      setActiveTab(tabId);
    } catch (error) {
      console.error('Error changing tab:', error);
      await logError(error, {
        context: 'tab-change',
        userId: userProfile?.id
      });
    }
  };

  const handleMenuToggle = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleSidebarClose = () => {
    setSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading Administrative Configuration Center...</p>
        </div>
      </div>
    );
  }

  if (!isManager) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You need manager or administrator privileges to access this page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onMenuToggle={handleMenuToggle} />
      <div className="flex">
        <Sidebar onClose={handleSidebarClose} />
        
        <main className="flex-1 ml-64 p-6">
          {/* Header Section */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-800 mb-2">
                  Administrative Configuration Center
                </h1>
                <p className="text-gray-600">
                  Comprehensive system management for aftermarket department administrators
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <p className="text-sm text-gray-500">Welcome back</p>
                  <p className="font-medium text-gray-800">{userProfile?.full_name}</p>
                  <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    {userProfile?.role}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div className="mb-6">
            <div className="border-b border-gray-200">
              <nav className="-mb-px flex space-x-8" aria-label="Tabs">
                {TABS?.map((tab) => (
                  <button
                    key={tab?.id}
                    onClick={() => handleTabChange(tab?.id)}
                    className={`
                      group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm
                      ${activeTab === tab?.id
                        ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                      }
                    `}
                  >
                    <span className="mr-2 text-lg">{tab?.icon}</span>
                    {tab?.label}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Tab Content */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 min-h-96">
            {activeTab === 'vendors' && <VendorManagement />}
            {activeTab === 'products' && <ProductCatalog />}
            {activeTab === 'services' && <ServiceCategories />}
            {activeTab === 'users' && <UserManagement />}
          </div>
        </main>
      </div>
    </div>
  );
};

export default AdministrativeConfigurationCenter;