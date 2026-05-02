import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import Sidebar from '../../components/ui/Sidebar'
import VehicleTable from './components/VehicleTable'
import FilterPanel from './components/FilterPanel'
import BulkActionsBar from './components/BulkActionsBar'
import StatsOverview from './components/StatsOverview'
import QuickActions from './components/QuickActions'
import AddVehicleModal from './components/AddVehicleModal'
import { useAuth } from '../../contexts/AuthContext'
import {
  getVehicles,
  getVendorAccessibleVehicles,
  createVehicleWithProducts,
  updateVehicle,
  deleteVehicle,
} from '../../services/vehicleService'
import jobService from '../../services/jobService'

const VehicleManagementHub = () => {
  const { userProfile, isManager, isVendor, vendorId } = useAuth()
  const navigate = useNavigate()

  // Add this block - Define userRole based on auth context
  const userRole = isManager ? 'manager' : isVendor ? 'vendor' : 'staff'

  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [selectedVehicles, setSelectedVehicles] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddVehicleModal, setShowAddVehicleModal] = useState(false)
  const [filters, setFilters] = useState({
    make: '',
    status: '',
    year: '',
    dateFrom: '',
    dateTo: '',
    minProfit: '',
    hasAftermarket: '',
    model: '',
    sortBy: '',
  })
  const [savedPresets, setSavedPresets] = useState([
    { id: 1, name: 'High Value Vehicles', filters: { minProfit: '1000', status: 'available' } },
    { id: 2, name: 'Recent Additions', filters: { dateFrom: '2025-01-01' } },
    { id: 3, name: 'In Work Items', filters: { status: 'in-work', hasAftermarket: 'yes' } },
  ])
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [refreshKey, setRefreshKey] = useState(0)
  const [vehicles, setVehicles] = useState([])
  const [isBulkLoading, setIsBulkLoading] = useState(false)
  const fetchGenRef = useRef(0)

  // Stats derived from loaded vehicles
  const stats = {
    total: vehicles?.length || 0,
    active: vehicles?.filter((v) => v?.vehicle_status === 'active')?.length || 0,
    maintenance: vehicles?.filter((v) => v?.vehicle_status === 'maintenance')?.length || 0,
    pending_jobs:
      vehicles?.filter((v) =>
        v?.jobs?.some((job) => ['pending', 'in_progress']?.includes(job?.job_status))
      )?.length || 0,
  }

  // Filter vehicles based on search and filters
  const filteredVehicles = React.useMemo(() => {
    return vehicles?.filter((vehicle) => {
      // Search filter - NOW INCLUDES PHONE NUMBERS
      if (searchQuery) {
        const query = searchQuery?.toLowerCase()
        if (
          !vehicle?.vin?.toLowerCase()?.includes(query) &&
          !vehicle?.stockNumber?.toLowerCase()?.includes(query) &&
          !vehicle?.make?.toLowerCase()?.includes(query) &&
          !vehicle?.model?.toLowerCase()?.includes(query) &&
          !vehicle?.owner_phone?.toLowerCase()?.includes(query) &&
          !vehicle?.owner_name?.toLowerCase()?.includes(query) &&
          !vehicle?.owner_email?.toLowerCase()?.includes(query)
        ) {
          return false
        }
      }

      // Other filters
      if (filters?.make && vehicle?.make?.toLowerCase() !== filters?.make?.toLowerCase())
        return false
      if (filters?.status && vehicle?.status !== filters?.status) return false
      if (filters?.year && vehicle?.year?.toString() !== filters?.year) return false
      if (filters?.model && !vehicle?.model?.toLowerCase()?.includes(filters?.model?.toLowerCase()))
        return false
      if (filters?.hasAftermarket === 'yes' && vehicle?.aftermarketCount === 0) return false
      if (filters?.hasAftermarket === 'no' && vehicle?.aftermarketCount > 0) return false
      if (filters?.minProfit && vehicle?.totalProfit < parseFloat(filters?.minProfit)) return false

      return true
    })
  }, [vehicles, searchQuery, filters])

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e?.ctrlKey || e?.metaKey) {
        switch (e?.key) {
          case 'n':
            e?.preventDefault()
            setShowAddVehicleModal(true)
            break
          case 'f':
            e?.preventDefault()
            document.querySelector('input[type="search"]')?.focus()
            break
          case 'r':
            e?.preventDefault()
            handleRefresh()
            break
          default:
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [navigate])

  useEffect(() => {
    const initializeVehicleManagement = async () => {
      fetchGenRef.current += 1
      const myGen = fetchGenRef.current
      try {
        // Load vehicles based on user role
        let vehicleData
        if (isVendor && vendorId) {
          // Vendors can only see vehicles they have jobs for
          vehicleData = await getVendorAccessibleVehicles(vendorId)
        } else if (isManager) {
          // Managers can see all vehicles
          vehicleData = await getVehicles(filters)
        } else {
          // Staff can see all vehicles
          vehicleData = await getVehicles(filters)
        }

        if (fetchGenRef.current === myGen) {
          setVehicles(vehicleData || [])
        }
      } catch (error) {
        console.error('Error loading vehicles:', error)
      }
    }

    initializeVehicleManagement()
  }, [filters, userProfile, isManager, isVendor, vendorId, refreshKey])

  const handleVehicleUpdate = async (vehicleId, updates) => {
    try {
      await updateVehicle(vehicleId, updates)
      const refreshedData = isVendor && vendorId
        ? await getVendorAccessibleVehicles(vendorId)
        : await getVehicles(filters)
      setVehicles(refreshedData || [])
    } catch (error) {
      console.error('[VehicleManagementHub] handleVehicleUpdate failed:', error)
    }
  }

  const handleBulkStatusUpdate = async (status) => {
    setIsBulkLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedVehicles.map((vehicleId) => updateVehicle(vehicleId, { vehicle_status: status }))
      )
      const failed = results.filter((r) => r.status === 'rejected' || r.value?.error)
      if (failed.length > 0) {
        console.error(`[VehicleManagementHub] ${failed.length} status update(s) failed:`, failed)
      }
    } catch (error) {
      console.error('Error bulk-updating status:', error)
    } finally {
      try {
        const refreshedData = isVendor && vendorId
          ? await getVendorAccessibleVehicles(vendorId)
          : await getVehicles(filters)
        setVehicles(refreshedData || [])
      } catch (refreshErr) {
        console.error('[VehicleManagementHub] Failed to refresh after status update:', refreshErr)
      }
      setIsBulkLoading(false)
      setSelectedVehicles([])
    }
  }

  const handleBulkExport = () => {
    const selected = vehicles.filter((v) => selectedVehicles.includes(v.id))
    if (!selected.length) return
    const headers = ['Stock #', 'VIN', 'Year', 'Make', 'Model', 'Status', 'Owner', 'Profit']
    const rows = selected.map((v) => [
      v.stockNumber || '',
      v.vin || '',
      v.year || '',
      v.make || '',
      v.model || '',
      v.vehicle_status || v.status || '',
      v.owner_name || '',
      v.totalProfit != null ? v.totalProfit.toFixed(2) : '',
    ])
    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `vehicles-export-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    setSelectedVehicles([])
  }

  const handleBulkDelete = async () => {
    if (!selectedVehicles.length) return
    const confirmed = window.confirm(
      `Delete ${selectedVehicles.length} vehicle(s)? This cannot be undone.`
    )
    if (!confirmed) return
    setIsBulkLoading(true)
    try {
      const results = await Promise.allSettled(
        selectedVehicles.map((vehicleId) => deleteVehicle(vehicleId))
      )
      const failed = results.filter(
        (r) => r.status === 'rejected' || r.value?.error
      )
      if (failed.length > 0) {
        console.error(`[VehicleManagementHub] ${failed.length} delete(s) failed:`, failed)
      }
    } catch (error) {
      console.error('Error bulk-deleting vehicles:', error)
    } finally {
      try {
        const refreshedData = isVendor && vendorId
          ? await getVendorAccessibleVehicles(vendorId)
          : await getVehicles(filters)
        setVehicles(refreshedData || [])
      } catch (refreshErr) {
        console.error('[VehicleManagementHub] Failed to refresh after delete:', refreshErr)
      }
      setIsBulkLoading(false)
      setSelectedVehicles([])
    }
  }

  const handleBulkAssignVendor = async (newVendorId) => {
    setIsBulkLoading(true)
    const activeStatuses = ['pending', 'scheduled', 'in_progress', 'quality_check']
    try {
      const assignments = selectedVehicles
        .map((vehicleId) => {
          const vehicle = vehicles.find((v) => v.id === vehicleId)
          const activeJob = vehicle?.jobs?.find((job) => activeStatuses.includes(job.job_status))
          return activeJob ? jobService.assignVendor(activeJob.id, newVendorId) : null
        })
        .filter(Boolean)
      const results = await Promise.allSettled(assignments)
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        console.error(`[VehicleManagementHub] ${failed.length} vendor assignment(s) failed:`, failed)
      }
    } catch (error) {
      console.error('Error bulk-assigning vendor:', error)
    } finally {
      try {
        const refreshedData = isVendor && vendorId
          ? await getVendorAccessibleVehicles(vendorId)
          : await getVehicles(filters)
        setVehicles(refreshedData || [])
      } catch (refreshErr) {
        console.error('[VehicleManagementHub] Failed to refresh after vendor assignment:', refreshErr)
      }
      setIsBulkLoading(false)
      setSelectedVehicles([])
    }
  }

  const handleBulkMarkPriority = async () => {
    setIsBulkLoading(true)
    const allPriority = selectedVehicles.every(
      (vehicleId) => vehicles.find((v) => v.id === vehicleId)?.is_priority === true
    )
    const newPriority = !allPriority
    try {
      const results = await Promise.allSettled(
        selectedVehicles.map((vehicleId) => updateVehicle(vehicleId, { is_priority: newPriority }))
      )
      const failed = results.filter((r) => r.status === 'rejected' || r.value?.error)
      if (failed.length > 0) {
        console.error(`[VehicleManagementHub] ${failed.length} priority update(s) failed:`, failed)
      }
    } catch (error) {
      console.error('Error bulk-marking priority:', error)
    } finally {
      // Always refresh so UI reflects actual DB state, even on partial failure
      try {
        const refreshedData = isVendor && vendorId
          ? await getVendorAccessibleVehicles(vendorId)
          : await getVehicles(filters)
        setVehicles(refreshedData || [])
      } catch (refreshErr) {
        console.error('[VehicleManagementHub] Failed to refresh after priority update:', refreshErr)
      }
      setIsBulkLoading(false)
      setSelectedVehicles([])
    }
  }

  const handleClearFilters = () => {
    setFilters({
      make: '',
      status: '',
      year: '',
      dateFrom: '',
      dateTo: '',
      minProfit: '',
      hasAftermarket: '',
      model: '',
      sortBy: '',
    })
    setSearchQuery('')
  }

  const handleSavePreset = (name, filterData) => {
    const newPreset = {
      id: Date.now(),
      name,
      filters: { ...filterData },
    }
    setSavedPresets([...savedPresets, newPreset])
  }

  const handleLoadPreset = (preset) => {
    setFilters(preset?.filters)
  }

  const handleRefresh = () => {
    setLastUpdated(new Date())
    setRefreshKey((k) => k + 1)
  }

  const handleAddVehicle = async (vehicleData) => {
    try {
      // Use the new service method that handles products
      await createVehicleWithProducts(vehicleData)

      // Show enhanced success message
      const productsCount = vehicleData?.initial_products?.length || 0
      const totalValue = vehicleData?.total_initial_product_value || 0
      const loanerText = vehicleData?.needs_loaner ? ' (Loaner required)' : ''
      const vendorText = vehicleData?.primary_vendor_id ? ' with vendor assignment' : ''

      alert(
        `Vehicle added successfully!${loanerText}${vendorText}\n` +
          `Products: ${productsCount} items ($${totalValue?.toFixed(2)} value)\n` +
          `This vehicle is now set up for complete aftermarket tracking.`
      )

      // Refresh the page data
      handleRefresh()
    } catch (error) {
      console.error('Failed to add vehicle:', error)
      throw error // Re-throw so modal can handle it
    }
  }

  return (
    <div className="min-h-screen bg-[#0B0F14] text-gray-100">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        setIsOpen={setIsSidebarOpen}
      />
      <main
        className={`pt-16 transition-all duration-300 ${isSidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}
      >
        <div className="p-6 max-w-full">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Vehicles</h1>
            <p className="text-gray-400">
              Vehicles in your inventory with active aftermarket work
            </p>
          </div>

          {/* Stats Overview */}
          <StatsOverview stats={stats} userRole={userRole} />

          {/* Quick Actions */}
          <QuickActions
            onRefresh={handleRefresh}
            lastUpdated={lastUpdated}
            onAddVehicle={() => setShowAddVehicleModal(true)}
          />

          {/* Filter Panel */}
          <FilterPanel
            filters={filters}
            onFilterChange={setFilters}
            onClearFilters={handleClearFilters}
            savedPresets={savedPresets}
            onSavePreset={handleSavePreset}
            onLoadPreset={handleLoadPreset}
          />

          {/* Vehicle Table */}
          <VehicleTable
            vehicles={filteredVehicles}
            selectedVehicles={selectedVehicles}
            onSelectionChange={setSelectedVehicles}
            onVehicleUpdate={handleVehicleUpdate}
            userRole={userRole}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            filters={filters}
            onFilterChange={setFilters}
          />

          {/* Bulk Actions Bar */}
          <BulkActionsBar
            selectedCount={selectedVehicles?.length}
            onBulkStatusUpdate={handleBulkStatusUpdate}
            onBulkExport={handleBulkExport}
            onBulkDelete={handleBulkDelete}
            onClearSelection={() => setSelectedVehicles([])}
            onBulkAssignVendor={handleBulkAssignVendor}
            onBulkMarkPriority={handleBulkMarkPriority}
            disabled={isBulkLoading}
          />
        </div>
      </main>

      {/* Add Vehicle Modal */}
      <AddVehicleModal
        isOpen={showAddVehicleModal}
        onClose={() => setShowAddVehicleModal(false)}
        onSubmit={handleAddVehicle}
      />
    </div>
  )
}

export default VehicleManagementHub
