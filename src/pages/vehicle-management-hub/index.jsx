import React, { useState, useEffect } from 'react'
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
} from '../../services/vehicleService'

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
  const [vehicles, setVehicles] = useState([])

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

        setVehicles(vehicleData || [])
      } catch (error) {
        console.error('Error loading vehicles:', error)
      }
    }

    initializeVehicleManagement()
  }, [filters, userProfile, isManager, isVendor, vendorId])

  const handleVehicleUpdate = (vehicleId, updates) => {
    console.log('Update vehicle:', vehicleId, updates)
    // In real app, this would update the vehicle in the database
  }

  const handleBulkStatusUpdate = async (status) => {
    console.log('Bulk status update:', selectedVehicles, status)
    // In real app, this would update multiple vehicles
    setSelectedVehicles([])
  }

  const handleBulkExport = async () => {
    console.log('Bulk export:', selectedVehicles)
    // In real app, this would export selected vehicles
    setSelectedVehicles([])
  }

  const handleBulkDelete = async () => {
    console.log('Bulk delete:', selectedVehicles)
    // In real app, this would delete selected vehicles
    setSelectedVehicles([])
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
    console.log('Refreshing vehicle data...')
  }

  const handleAddVehicle = async (vehicleData) => {
    try {
      console.log('Adding new vehicle with aftermarket products:', vehicleData)

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
            <h1 className="text-3xl font-bold text-gray-100 mb-2">Vehicle Management Hub</h1>
            <p className="text-gray-400">
              Centralized vehicle inventory with integrated aftermarket work tracking
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
