import React, { useState, useEffect, useCallback } from 'react'
import Car from 'lucide-react/dist/esm/icons/car.js'
import Search from 'lucide-react/dist/esm/icons/search.js'
import Calendar from 'lucide-react/dist/esm/icons/calendar.js'
import History from 'lucide-react/dist/esm/icons/history.js'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import Phone from 'lucide-react/dist/esm/icons/phone.js'
import Mail from 'lucide-react/dist/esm/icons/mail.js'
import Filter from 'lucide-react/dist/esm/icons/filter.js'
import Grid3X3 from 'lucide-react/dist/esm/icons/grid-3x3.js'
import LayoutList from 'lucide-react/dist/esm/icons/layout-list.js'
import Zap from 'lucide-react/dist/esm/icons/zap.js'
import Award from 'lucide-react/dist/esm/icons/award.js'
import TrendingUp from 'lucide-react/dist/esm/icons/trending-up.js'
import AppLayout from '../../components/layouts/AppLayout'
import { vehicleService } from '../../services/vehicleService'
import { useNavigate } from 'react-router-dom'

const VehiclesPage = () => {
  const [vehicles, setVehicles] = useState([])
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false)
  const [vehicleHistory, setVehicleHistory] = useState([])
  const [statusFilter, setStatusFilter] = useState('all')
  const [viewMode, setViewMode] = useState('cards') // 'cards' or 'table'
  const navigate = useNavigate()

  const loadVehicles = useCallback(async () => {
    try {
      setLoading(true)

      const { data, error } = await vehicleService.listVehiclesForVehiclesPage({ statusFilter })
      if (error) throw new Error(error?.message || 'Failed to load vehicles')

      let filteredData = data || []

      if (searchQuery?.trim()) {
        const searchTerm = searchQuery?.toLowerCase()?.trim()

        const exactStockMatch = filteredData?.filter(
          (vehicle) => vehicle?.stock_number?.toLowerCase() === searchTerm
        )

        if (exactStockMatch?.length > 0) {
          filteredData = exactStockMatch
        } else {
          filteredData = filteredData?.filter(
            (vehicle) =>
              vehicle?.stock_number?.toLowerCase()?.includes(searchTerm) ||
              vehicle?.vin?.toLowerCase()?.includes(searchTerm) ||
              vehicle?.owner_name?.toLowerCase()?.includes(searchTerm) ||
              `${vehicle?.year} ${vehicle?.make} ${vehicle?.model}`
                ?.toLowerCase()
                ?.includes(searchTerm)
          )
        }
      }

      setVehicles(filteredData)
    } catch (error) {
      console.error('Error loading vehicles:', error)
    } finally {
      setLoading(false)
    }
  }, [searchQuery, statusFilter])

  useEffect(() => {
    loadVehicles()
  }, [loadVehicles])

  useEffect(() => {
    const searchInput = document.getElementById('vehicle-search')
    if (searchInput) {
      searchInput?.focus()
    }
  }, [])

  const loadVehicleHistory = async (vehicleId) => {
    try {
      const { data, error } = await vehicleService.getVehicleHistoryForVehiclesPage(vehicleId)
      if (error) throw new Error(error?.message || 'Failed to load vehicle history')

      setVehicleHistory(data || [])
    } catch (error) {
      console.error('Error loading vehicle history:', error)
    }
  }

  const handleViewHistory = (vehicle) => {
    setSelectedVehicle(vehicle)
    loadVehicleHistory(vehicle?.id)
    setShowHistoryDrawer(true)
  }

  const handleScheduleService = (vehicle) => {
    // Navigate to calendar with vehicle context
    navigate('/calendar', {
      state: {
        selectedVehicle: vehicle,
        action: 'schedule',
        prefilledData: {
          vehicleId: vehicle?.id,
          stockNumber: vehicle?.stock_number,
          vehicleInfo: `${vehicle?.year} ${vehicle?.make} ${vehicle?.model}`,
          ownerName: vehicle?.owner_name,
          ownerPhone: vehicle?.owner_phone,
        },
      },
    })
  }

  // Adjusted getStatusConfig to return object with config
  const getStatusConfig = (status) => {
    const configs = {
      active: {
        color: 'from-emerald-500 to-emerald-600',
        bg: 'bg-emerald-50',
        text: 'text-emerald-700',
        border: 'border-emerald-200',
        icon: Zap,
        label: 'Active',
      },
      maintenance: {
        color: 'from-amber-500 to-orange-500',
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        icon: Award,
        label: 'In Service',
      },
      retired: {
        color: 'from-slate-500 to-slate-600',
        bg: 'bg-slate-50',
        text: 'text-slate-700',
        border: 'border-slate-200',
        icon: Calendar,
        label: 'Retired',
      },
      sold: {
        color: 'from-blue-500 to-indigo-600',
        bg: 'bg-blue-50',
        text: 'text-blue-700',
        border: 'border-blue-200',
        icon: TrendingUp,
        label: 'Sold',
      },
    }
    return configs?.[status] || configs?.active
  }

  const VehicleCard = ({ vehicle }) => {
    const statusConfig = getStatusConfig(vehicle?.vehicle_status)
    const StatusIcon = statusConfig?.icon

    return (
      <div className="group relative bg-card rounded-lg shadow-sm border border-border hover:shadow-md hover:border-slate-300 transition-all duration-300 overflow-hidden">
        {/* Brand accent bar */}
        <div className="absolute top-0 left-0 w-full h-1 bg-blue-600"></div>
        <div className="p-6">
          {/* Header with Stock Number */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
                <Car className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold text-foreground">
                  #{vehicle?.stock_number || 'N/A'}
                </div>
                <div className="text-sm text-muted-foreground font-medium">{vehicle?.license_plate}</div>
              </div>
            </div>

            {/* Status Badge */}
            <div
              className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold ${statusConfig?.bg} ${statusConfig?.text} ${statusConfig?.border} border`}
            >
              <StatusIcon className="w-3 h-3 mr-1.5" />
              {statusConfig?.label}
            </div>
          </div>

          {/* Vehicle Details */}
          <div className="space-y-3 mb-6">
            <div>
              <h3 className="text-lg font-semibold text-foreground leading-tight">
                {vehicle?.year} {vehicle?.make} {vehicle?.model}
              </h3>
              <div className="flex items-center space-x-4 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center">
                  <div
                    className={`w-3 h-3 rounded-full mr-2 shadow-sm`}
                    style={{ backgroundColor: vehicle?.color?.toLowerCase() || '#gray' }}
                  ></div>
                  {vehicle?.color}
                </span>
                <span>{vehicle?.mileage?.toLocaleString()} mi</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground font-mono bg-muted px-3 py-2 rounded-lg">
              VIN: {vehicle?.vin}
            </div>
          </div>

          {/* Owner Information */}
          <div className="border-t border-border pt-4 mb-6">
            <div className="text-sm font-semibold text-foreground mb-2">{vehicle?.owner_name}</div>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              {vehicle?.owner_phone && (
                <div className="flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  {vehicle?.owner_phone}
                </div>
              )}
              {vehicle?.owner_email && (
                <div className="flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                  {vehicle?.owner_email}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => handleViewHistory(vehicle)}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors flex items-center justify-center"
            >
              <History className="w-4 h-4 mr-2" />
              History
            </button>
            <button
              onClick={() => handleScheduleService(vehicle)}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-md text-sm font-semibold transition-colors flex items-center justify-center"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </button>
            <button className="px-4 py-2 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-muted flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-blue-600 flex items-center justify-center shadow-md">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
            </div>
            <p className="text-muted-foreground font-medium">Loading fleet...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-muted">
        {/* Page Header */}
        <div className="bg-card border-b border-border sticky top-0 z-40">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow-md">
                    <Car className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                      Vehicle Tracker
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                      Sales Data &amp; Product Tracking
                    </p>
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <input
                    id="vehicle-search"
                    type="text"
                    placeholder="Search vehicles by stock, VIN, or customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e?.target?.value)}
                    className="pl-10 pr-4 py-2.5 border border-border rounded-lg w-full sm:w-96 focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-card shadow-sm transition-colors text-foreground placeholder:text-muted-foreground"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* View Toggle */}
                <div className="flex items-center bg-muted rounded-lg p-1 border border-border">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'cards'
                        ? 'bg-card shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      viewMode === 'table'
                        ? 'bg-card shadow-sm text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e?.target?.value)}
                    className="pl-10 pr-8 py-2.5 border border-border rounded-lg bg-card focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors text-foreground appearance-none cursor-pointer"
                  >
                    <option value="all">All Vehicles</option>
                    <option value="active">Active Fleet</option>
                    <option value="maintenance">In Service</option>
                    <option value="retired">Retired</option>
                    <option value="sold">Sold</option>
                  </select>
                </div>

                <button
                  onClick={() => navigate('/deals')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-md flex items-center space-x-2 transition-colors font-semibold text-sm"
                >
                  <TrendingUp className="w-4 h-4" />
                  <span>New Deal</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-6 py-6">
          {viewMode === 'cards' ? (
            // Card View
            vehicles?.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {vehicles?.map((vehicle) => (
                  <VehicleCard key={vehicle?.id} vehicle={vehicle} />
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-blue-50 flex items-center justify-center">
                  <Car className="w-12 h-12 text-blue-600" />
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">
                  No vehicles in tracking system
                </h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                  {searchQuery
                    ? 'No vehicles match your search criteria. Try adjusting your filters.'
                    : 'Start by creating deals with vehicles to see them appear in this tracking system.'}
                </p>
                <button
                  onClick={() => navigate('/deals')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-md flex items-center space-x-2 transition-colors font-semibold text-sm mx-auto"
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>Create Your First Deal</span>
                </button>
              </div>
            )
          ) : (
            // Table View
            <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-muted border-b border-border">
                      <th className="px-6 py-4 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                        Stock #
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                        Vehicle Details
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                        Owner Information
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-4 text-left text-sm font-bold text-foreground uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {vehicles?.map((vehicle) => {
                      const statusConfig = getStatusConfig(vehicle?.vehicle_status)
                      const StatusIcon = statusConfig?.icon

                      return (
                        <tr
                          key={vehicle?.id}
                          className="hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-9 h-9 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                                <Car className="w-4 h-4 text-white" />
                              </div>
                              <div>
                                <div className="text-base font-bold text-foreground">
                                  #{vehicle?.stock_number || 'N/A'}
                                </div>
                                <div className="text-sm text-muted-foreground font-medium">
                                  {vehicle?.license_plate}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-base font-semibold text-foreground">
                              {vehicle?.year} {vehicle?.make} {vehicle?.model}
                            </div>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                              <span className="flex items-center">
                                <div
                                  className={`w-3 h-3 rounded-full mr-2 shadow-sm`}
                                  style={{
                                    backgroundColor: vehicle?.color?.toLowerCase() || '#gray',
                                  }}
                                ></div>
                                {vehicle?.color}
                              </span>
                              <span>{vehicle?.mileage?.toLocaleString()} miles</span>
                            </div>
                            <div className="text-xs text-muted-foreground font-mono bg-muted px-2 py-1 rounded mt-2 inline-block">
                              VIN: {vehicle?.vin}
                            </div>
                          </td>
                          <td className="px-6 py-5">
                            <div className="text-base font-semibold text-foreground">
                              {vehicle?.owner_name}
                            </div>
                            <div className="space-y-1 mt-2 text-sm text-muted-foreground">
                              {vehicle?.owner_phone && (
                                <div className="flex items-center">
                                  <Phone className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                  {vehicle?.owner_phone}
                                </div>
                              )}
                              {vehicle?.owner_email && (
                                <div className="flex items-center">
                                  <Mail className="w-3.5 h-3.5 mr-2 text-muted-foreground" />
                                  {vehicle?.owner_email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div
                              className={`inline-flex items-center px-3 py-1.5 rounded-full text-sm font-semibold ${statusConfig?.bg} ${statusConfig?.text} ${statusConfig?.border} border`}
                            >
                              <StatusIcon className="w-4 h-4 mr-2" />
                              {statusConfig?.label}
                            </div>
                          </td>
                          <td className="px-6 py-5 whitespace-nowrap">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleViewHistory(vehicle)}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center"
                              >
                                <History className="w-4 h-4 mr-1.5" />
                                History
                              </button>
                              <button
                                onClick={() => handleScheduleService(vehicle)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-md text-sm font-semibold transition-colors flex items-center"
                              >
                                <Calendar className="w-4 h-4 mr-1.5" />
                                Schedule
                              </button>
                              <button className="px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:bg-muted transition-colors flex items-center">
                                <FileText className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {vehicles?.length === 0 && (
                <div className="text-center py-20">
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-blue-50 flex items-center justify-center">
                    <Car className="w-12 h-12 text-blue-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-2">No vehicles found</h3>
                  <p className="text-muted-foreground mb-8 max-w-md mx-auto">
                    {searchQuery
                      ? 'No vehicles match your search criteria. Try adjusting your filters.'
                      : 'Start by creating deals with vehicles to see them appear in this tracking system.'}
                  </p>
                  <button
                    onClick={() => navigate('/deals')}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-md flex items-center space-x-2 transition-colors font-semibold text-sm mx-auto"
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span>Create Your First Deal</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* History Drawer */}
        {showHistoryDrawer && selectedVehicle && (
          <div className="fixed inset-y-0 right-0 w-[480px] bg-card shadow-2xl border-l border-border z-50">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-6 border-b border-border">
                <div className="flex items-center justify-between mb-5">
                  <h3 className="text-xl font-bold text-foreground">
                    Vehicle History
                  </h3>
                  <button
                    onClick={() => setShowHistoryDrawer(false)}
                    className="w-9 h-9 rounded-lg bg-muted hover:bg-muted/80 flex items-center justify-center transition-colors"
                  >
                    <span className="text-xl font-light">×</span>
                  </button>
                </div>
                <div className="bg-blue-50 rounded-xl p-5 border border-blue-100">
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shadow-sm">
                      <Car className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <div className="text-base font-bold text-foreground">
                        #{selectedVehicle?.stock_number} • {selectedVehicle?.year}{' '}
                        {selectedVehicle?.make} {selectedVehicle?.model}
                      </div>
                      <div className="text-sm text-muted-foreground font-medium">
                        {selectedVehicle?.owner_name}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* History Content */}
              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-4">
                  {vehicleHistory?.length > 0 ? (
                    vehicleHistory?.map((item, index) => (
                      <div key={index} className="relative">
                        <div className="bg-card rounded-lg p-5 shadow-sm border border-border hover:shadow-md transition-shadow">
                          <div className="flex items-start space-x-4">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shadow-sm ${
                                item?.type === 'job'
                                  ? 'bg-blue-600'
                                  : 'bg-emerald-600'
                              }`}
                            >
                              {item?.type === 'job' ? (
                                <Award className="w-5 h-5 text-white" />
                              ) : (
                                <Mail className="w-5 h-5 text-white" />
                              )}
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center space-x-3 mb-2">
                                <span
                                  className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${
                                    item?.type === 'job'
                                      ? 'bg-blue-100 text-blue-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                  }`}
                                >
                                  {item?.type}
                                </span>
                                {item?.status && (
                                  <span
                                    className={`inline-flex px-3 py-1 text-xs rounded-full ${getStatusConfig(item?.status)?.bg} ${getStatusConfig(item?.status)?.text}`}
                                  >
                                    {item?.status?.replace('_', ' ')}
                                  </span>
                                )}
                              </div>

                              <h4 className="font-semibold text-gray-900 mb-2">{item?.title}</h4>
                              {item?.description && (
                                <p className="text-sm text-gray-600 mb-3">{item?.description}</p>
                              )}

                              <div className="text-xs text-gray-500 space-y-1">
                                <div className="font-medium">
                                  {new Date(item.date)?.toLocaleDateString()}
                                </div>
                                {item?.vendor && <div>Vendor: {item?.vendor}</div>}
                                {item?.assignee && <div>Assigned to: {item?.assignee}</div>}
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Timeline connector */}
                        {index < vehicleHistory?.length - 1 && (
                          <div className="absolute left-[25px] top-[90px] w-0.5 h-6 bg-gray-200"></div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                        <History className="w-10 h-10 text-muted-foreground" />
                      </div>
                      <h4 className="text-lg font-semibold text-foreground mb-2">
                        No History Available
                      </h4>
                      <p className="text-muted-foreground">This vehicle has no recorded history yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  )
}

export default VehiclesPage
