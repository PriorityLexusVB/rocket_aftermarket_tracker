import React, { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useLogger } from '../../hooks/useLogger'
import Header from '../../components/ui/Header'
import Sidebar from '../../components/ui/Sidebar'
import VendorManagement from './components/VendorManagement'
import ProductCatalog from './components/ProductCatalog'
import ServiceCategories from './components/ServiceCategories'
import UserManagement from './components/UserManagement'
import SmsTemplateManager from './components/SmsTemplateManager'

const AdministrativeConfigurationCenter = () => {
  const { userProfile, isManager } = useAuth()
  const { logInfo, logError, logWarning } = useLogger()
  const [loading, setLoading] = useState(true)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [totalUsers] = useState(0)
  const [totalProducts] = useState(0)
  const [totalVendors] = useState(0)

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
            accessTime: new Date()?.toISOString(),
          }
        )

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
              requiredRole: 'manager',
            }
          )
        }

        setLoading(false)
      } catch (error) {
        console.error('Error initializing config center:', error)
        await logError(error, {
          context: 'admin-config-initialization',
          userId: userProfile?.id,
        })
        setLoading(false)
      }
    }

    initializeConfigCenter()
  }, [userProfile, isManager, logInfo, logWarning, logError])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-white mx-auto"></div>
          <p className="mt-4 text-gray-300">Loading Administrative Configuration Center...</p>
        </div>
      </div>
    )
  }

  if (!isManager) {
    return (
      <div className="min-h-screen bg-[#0B0F14] flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-100 mb-2">Access Denied</h2>
          <p className="text-gray-300">
            You need manager or administrator privileges to access this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} isMenuOpen={sidebarOpen} />
      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        setIsOpen={setSidebarOpen}
      />

      <main className="lg:ml-60 pt-16">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Page Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Administrative Configuration Center
            </h1>
            <p className="text-muted-foreground">
              Manage system settings, templates, users, and organizational data
            </p>
          </div>

          {/* Configuration Sections */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <UserManagement className="xl:col-span-1" />
            <ProductCatalog className="xl:col-span-1" />
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <VendorManagement className="xl:col-span-1" />
            <ServiceCategories className="xl:col-span-1" />
          </div>

          {/* SMS Template Management - Full width */}
          <SmsTemplateManager className="mb-8" />

          {/* System Information */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-gray-100 mb-4">System Information</h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-2xl font-bold text-gray-100 mb-1">{totalUsers}</div>
                <div className="text-sm text-gray-400">Total Users</div>
              </div>

              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-2xl font-bold text-gray-100 mb-1">{totalProducts}</div>
                <div className="text-sm text-gray-400">Active Products</div>
              </div>

              <div className="bg-white/5 p-4 rounded-lg border border-white/10">
                <div className="text-2xl font-bold text-gray-100 mb-1">{totalVendors}</div>
                <div className="text-sm text-gray-400">Active Vendors</div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdministrativeConfigurationCenter
