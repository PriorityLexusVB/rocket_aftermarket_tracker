import React, { useState, useEffect, useMemo } from 'react'
import Header from '../../components/ui/Header'
import Sidebar from '../../components/ui/Sidebar'
import VendorListTable from './components/VendorListTable'
import VendorDetailSidebar from './components/VendorDetailSidebar'
import PerformanceDashboard from './components/PerformanceDashboard'
import Icon from '../../components/AppIcon'
import Button from '../../components/ui/Button'
import { useAuth } from '../../contexts/AuthContext'
import vendorService, { getVendorVehicles, getVendorJobs, getVendors } from '../../services/vendorService'

const VendorOperationsCenter = () => {
  const { userProfile, isManager, isVendor, vendorId } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedVendor, setSelectedVendor] = useState(null)
  const [activeView, setActiveView] = useState('vendors') // 'vendors' or 'dashboard'
  const userRole = isManager ? 'manager' : isVendor ? 'vendor' : 'staff'
  const [, setLoading] = useState(false)
  const [, setError] = useState('')

  const [vendors, setVendors] = useState([])
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [createForm, setCreateForm] = useState({ name: '', phone: '', email: '', specialty: '' })
  const [createError, setCreateError] = useState('')
  const [createLoading, setCreateLoading] = useState(false)

  const mapVendorRowToUi = (v) => {
    const specialty = v?.specialty ? String(v.specialty) : ''
    return {
      id: v?.id,
      name: v?.name,
      contact: {
        phone: v?.phone || '',
        email: v?.email || '',
        address: v?.address || '',
      },
      specialties: specialty ? [specialty] : [],
      status: v?.is_active === false ? 'unavailable' : 'available',
      activeJobs: 0,
      overdueJobs: 0,
      totalJobs: 0,
      completionRate: 0,
      avgTurnaroundTime: 0,
      lastActive: '—',
      recentJobs: [],
      smsHistory: [],
    }
  }

  const performanceData = useMemo(() => {
    const totalVendors = vendors?.length || 0
    const activeJobs = (vendors || []).reduce((sum, v) => sum + (Number(v?.activeJobs) || 0), 0)
    const overdueJobs = (vendors || []).reduce((sum, v) => sum + (Number(v?.overdueJobs) || 0), 0)
    const avgCompletionRate =
      totalVendors > 0
        ? (vendors || []).reduce((sum, v) => sum + (Number(v?.completionRate) || 0), 0) /
          totalVendors
        : 0

    return {
      totalVendors,
      activeJobs,
      overdueJobs,
      avgCompletionRate,
      avgTurnaround: 0,
      topPerformers: [],
      recentActivity: [],
    }
  }, [vendors])

  useEffect(() => {
    document.title = 'Vendor Operations Center - Rocket Aftermarket Tracker'
  }, [])

  const handleVendorSelect = (vendor) => {
    setSelectedVendor(vendor)
  }

  const handleVendorUpdate = (updatedVendor) => {
    // In a real app, this would update the vendor in the database
  }

  const handleBulkAction = (action, vendorIds) => {
    switch (action) {
      case 'sms':
        console.warn('Send SMS is not implemented yet:', vendorIds)
        break
      case 'reassign':
        console.warn('Reassign jobs is not implemented yet:', vendorIds)
        break
      case 'export': {
        const selected = vendors.filter((v) => (vendorIds || []).includes(v.id))
        if (!selected.length) break
        const headers = ['Name', 'Phone', 'Email', 'Status', 'Specialties', 'Active Jobs', 'Overdue Jobs']
        const rows = selected.map((v) => [
          v.name || '',
          v.contact?.phone || '',
          v.contact?.email || '',
          v.status || '',
          (v.specialties || []).join('; '),
          v.activeJobs || 0,
          v.overdueJobs || 0,
        ])
        const csv = [headers, ...rows]
          .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
          .join('\n')
        const blob = new Blob([csv], { type: 'text/csv' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `vendors-export-${new Date().toISOString().slice(0, 10)}.csv`
        a.click()
        URL.revokeObjectURL(url)
        break
      }
      case 'create':
        setCreateForm({ name: '', phone: '', email: '', specialty: '' })
        setCreateError('')
        setShowCreateModal(true)
        break
      default:
        console.warn('Unknown action:', action)
    }
  }

  const handleSendSMS = (vendorId, message) => {
    console.warn('Send SMS is not implemented yet:', vendorId, message)
  }

  const handleAssignJob = (vendorId, jobData) => {
    console.warn('Assign job is not implemented yet:', vendorId, jobData)
  }

  const handleDrillDown = (type, id) => {
    switch (type) {
      case 'completion-rate':
        console.warn('Drill-down is not implemented yet', type)
        break
      case 'turnaround-time':
        console.warn('Drill-down is not implemented yet', type)
        break
      case 'specialty-distribution':
        console.warn('Drill-down is not implemented yet', type)
        break
      case 'top-performers':
        console.warn('Drill-down is not implemented yet', type)
        break
      case 'activity':
        console.warn('Drill-down is not implemented yet', type, id)
        break
      default:
        console.warn('Drill-down is not implemented yet', type)
    }
  }

  useEffect(() => {
    const initializeVendorOperations = async () => {
      try {
        setLoading(true)

        // For vendor users, load only their assigned data
        if (isVendor && vendorId) {
          const [vendorVehicles, vendorJobs] = await Promise.all([
            getVendorVehicles(vendorId),
            getVendorJobs(vendorId),
          ])

          const uiVendor = {
            id: vendorId,
            name: userProfile?.vendor?.name || '—',
            contact: {
              phone: userProfile?.vendor?.phone || '',
              email: userProfile?.vendor?.email || '',
              address: userProfile?.vendor?.address || '',
            },
            specialties: userProfile?.vendor?.specialty
              ? [String(userProfile.vendor.specialty)]
              : [],
            status: 'available',
            activeJobs: 0,
            overdueJobs: 0,
            totalJobs: 0,
            completionRate: 0,
            avgTurnaroundTime: 0,
            lastActive: '—',
            recentJobs: [],
            smsHistory: [],
            vehicles: vendorVehicles || [],
            jobs: vendorJobs || [],
          }

          setVendors([uiVendor])
          setSelectedVendor(uiVendor)
        } else if (isManager) {
          // For managers, load all vendor data as before
          const vendorsData = await getVendors()
          setVendors((vendorsData || []).map(mapVendorRowToUi))
        }

        setLoading(false)
      } catch (error) {
        console.error('Error initializing vendor operations:', error)
        setError('Failed to load vendor operations data')
        setLoading(false)
      }
    }

    initializeVendorOperations()
  }, [userProfile, isManager, isVendor, vendorId])

  const handleCreateSubmit = async (e) => {
    e.preventDefault()
    if (!createForm.name.trim()) {
      setCreateError('Vendor name is required.')
      return
    }
    setCreateLoading(true)
    setCreateError('')
    try {
      await vendorService.createVendor({
        name: createForm.name.trim(),
        phone: createForm.phone.trim() || undefined,
        email: createForm.email.trim() || undefined,
        specialty: createForm.specialty.trim() || undefined,
      })
      const refreshed = await getVendors()
      setVendors((refreshed || []).map(mapVendorRowToUi))
      setShowCreateModal(false)
    } catch (err) {
      setCreateError(err?.message || 'Failed to create vendor.')
    } finally {
      setCreateLoading(false)
    }
  }

  // Add access control check
  if (!isManager && !isVendor) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-6xl mb-4">🔒</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600">
            You need manager privileges or vendor access to view this page.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="lg:ml-60 pt-16">
        <div className="p-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">Vendor Operations Center</h1>
                <p className="text-muted-foreground">
                  Manage vendor relationships, track performance, and assign jobs
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="flex bg-muted rounded-lg p-1">
                  <Button
                    variant={activeView === 'vendors' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveView('vendors')}
                    className="px-4"
                  >
                    <Icon name="Users" size={16} className="mr-2" />
                    Vendors
                  </Button>
                  <Button
                    variant={activeView === 'dashboard' ? 'default' : 'ghost'}
                    size="sm"
                    onClick={() => setActiveView('dashboard')}
                    className="px-4"
                  >
                    <Icon name="BarChart3" size={16} className="mr-2" />
                    Dashboard
                  </Button>
                </div>

                <Button
                  variant="outline"
                  iconName="Download"
                  iconPosition="left"
                  onClick={() => handleBulkAction('export', [])}
                >
                  Export Report
                </Button>

                <Button
                  variant="outline"
                  iconName="RefreshCw"
                  onClick={() => window.location?.reload()}
                >
                  Refresh
                </Button>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Icon name="Users" size={20} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Total Vendors</p>
                    <p className="text-xl font-semibold text-foreground">{vendors?.length}</p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-warning/10 rounded-lg">
                    <Icon name="Clock" size={20} className="text-warning" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Active Jobs</p>
                    <p className="text-xl font-semibold text-foreground">
                      {(vendors || []).reduce((sum, v) => sum + (Number(v?.activeJobs) || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-error/10 rounded-lg">
                    <Icon name="AlertTriangle" size={20} className="text-error" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Overdue Jobs</p>
                    <p className="text-xl font-semibold text-foreground">
                      {(vendors || []).reduce((sum, v) => sum + (Number(v?.overdueJobs) || 0), 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-card p-4 rounded-lg border border-border">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-success/10 rounded-lg">
                    <Icon name="TrendingUp" size={20} className="text-success" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Avg Performance</p>
                    <p className="text-xl font-semibold text-foreground">
                      {Math.round(performanceData?.avgCompletionRate || 0)}%
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          {activeView === 'vendors' ? (
            <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
              {/* Vendor List - 60% width */}
              <div className="xl:col-span-3">
                <VendorListTable
                  vendors={vendors}
                  selectedVendor={selectedVendor}
                  onVendorSelect={handleVendorSelect}
                  onVendorUpdate={handleVendorUpdate}
                  onBulkAction={handleBulkAction}
                  userRole={userRole}
                />
              </div>

              {/* Vendor Detail Sidebar - 40% width */}
              <div className="xl:col-span-2">
                <VendorDetailSidebar
                  vendor={selectedVendor}
                  onClose={() => setSelectedVendor(null)}
                  onSendSMS={handleSendSMS}
                  onAssignJob={handleAssignJob}
                  userRole={userRole}
                />
              </div>
            </div>
          ) : (
            <PerformanceDashboard performanceData={performanceData} onDrillDown={handleDrillDown} />
          )}
        </div>
      </main>

      {/* Create Vendor Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Vendor</h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <Icon name="X" size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Vendor Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={createForm.name}
                  onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Vendor company name"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="(555) 000-0000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={createForm.email}
                  onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="vendor@example.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Specialty</label>
                <input
                  type="text"
                  value={createForm.specialty}
                  onChange={(e) => setCreateForm((f) => ({ ...f, specialty: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="e.g. Tint, ToughGuard, Wheels"
                />
              </div>
              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-sm rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {createLoading ? 'Creating…' : 'Create Vendor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default VendorOperationsCenter
