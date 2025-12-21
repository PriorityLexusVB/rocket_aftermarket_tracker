import React, { useState, useEffect, useCallback } from 'react'
import {
  Car,
  Search,
  Calendar,
  History,
  FileText,
  Phone,
  Mail,
  Filter,
  Grid3X3,
  LayoutList,
  Zap,
  Award,
  TrendingUp,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import AppLayout from '../../components/layouts/AppLayout'
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

      let query = supabase
        ?.from('vehicles')
        ?.select('*')
        ?.order('stock_number', { ascending: true })

      if (statusFilter !== 'all') {
        query = query?.eq('vehicle_status', statusFilter)
      }

      const { data, error } = await query

      if (error) throw error

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
      const [jobsResponse, communicationsResponse] = await Promise.all([
        supabase
          ?.from('jobs')
          ?.select(
            `
            *,
            vendors (name),
            user_profiles (full_name)
          `
          )
          ?.eq('vehicle_id', vehicleId)
          ?.order('created_at', { ascending: false }),

        supabase
          ?.from('communications')
          ?.select('*')
          ?.eq('vehicle_id', vehicleId)
          ?.order('sent_at', { ascending: false }),
      ])

      const jobs = jobsResponse?.data || []
      const communications = communicationsResponse?.data || []

      const history = [
        ...jobs?.map((job) => ({
          type: 'job',
          date: job?.created_at,
          title: job?.job_number || job?.transactions?.[0]?.customer_name || '—',
          description: job?.description,
          status: job?.job_status,
          vendor: job?.vendors?.name,
          assignee: job?.user_profiles?.full_name,
        })),
        ...communications?.map((comm) => ({
          type: 'communication',
          date: comm?.sent_at,
          title: `${comm?.communication_type?.toUpperCase()} Message`,
          description: comm?.message,
          status: comm?.is_successful ? 'delivered' : 'failed',
        })),
      ]?.sort((a, b) => new Date(b.date) - new Date(a.date))

      setVehicleHistory(history)
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
    // Navigate directly to calendar without add vehicle functionality
    console.log('Scheduling service for vehicle:', vehicle?.stock_number)

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
      <div className="group relative bg-white rounded-2xl shadow-sm border border-gray-100 hover:shadow-xl hover:border-gray-200 transition-all duration-300 overflow-hidden">
        {/* Premium gradient overlay */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600"></div>
        <div className="p-6">
          {/* Header with Stock Number */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg">
                <Car className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                  #{vehicle?.stock_number || 'N/A'}
                </div>
                <div className="text-sm text-gray-500 font-medium">{vehicle?.license_plate}</div>
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
              <h3 className="text-lg font-semibold text-gray-900 leading-tight">
                {vehicle?.year} {vehicle?.make} {vehicle?.model}
              </h3>
              <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600">
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

            <div className="text-xs text-gray-500 font-mono bg-gray-50 px-3 py-2 rounded-lg">
              VIN: {vehicle?.vin}
            </div>
          </div>

          {/* Owner Information */}
          <div className="border-t border-gray-100 pt-4 mb-6">
            <div className="text-sm font-semibold text-gray-900 mb-2">{vehicle?.owner_name}</div>
            <div className="space-y-1.5 text-sm text-gray-600">
              {vehicle?.owner_phone && (
                <div className="flex items-center">
                  <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                  {vehicle?.owner_phone}
                </div>
              )}
              {vehicle?.owner_email && (
                <div className="flex items-center">
                  <Mail className="w-3.5 h-3.5 mr-2 text-gray-400" />
                  {vehicle?.owner_email}
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2">
            <button
              onClick={() => handleViewHistory(vehicle)}
              className="flex-1 bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center"
            >
              <History className="w-4 h-4 mr-2" />
              History
            </button>
            <button
              onClick={() => handleScheduleService(vehicle)}
              className="flex-1 bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center justify-center"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Schedule
            </button>
            <button className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center justify-center">
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
        <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-indigo-50 flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shadow-xl">
              <div className="animate-spin rounded-full h-8 w-8 border-2 border-white border-t-transparent"></div>
            </div>
            <p className="text-gray-600 font-medium">Loading luxury fleet...</p>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-indigo-50">
        {/* Premium Header */}
        <div className="bg-white/80 backdrop-blur-xl border-b border-gray-200/50 sticky top-0 z-40">
          <div className="px-8 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 flex items-center justify-center shadow-xl">
                    <Car className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                      Vehicle Tracker
                    </h1>
                    <p className="text-sm text-gray-600 font-medium">
                      Sales Data & Product Tracking
                    </p>
                  </div>
                </div>

                {/* Enhanced Search */}
                <div className="relative">
                  <Search className="absolute left-4 top-4 h-5 w-5 text-gray-400" />
                  <input
                    id="vehicle-search"
                    type="text"
                    placeholder="Search vehicles by stock, VIN, or customer..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e?.target?.value)}
                    className="pl-12 pr-6 py-3.5 border border-gray-200 rounded-2xl w-96 focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white/80 backdrop-blur-sm shadow-sm hover:shadow-md transition-all duration-200 text-gray-900 placeholder-gray-500"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* View Toggle */}
                <div className="flex items-center bg-gray-100 rounded-xl p-1">
                  <button
                    onClick={() => setViewMode('cards')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      viewMode === 'cards'
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('table')}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
                      viewMode === 'table'
                        ? 'bg-white shadow-sm text-gray-900'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LayoutList className="w-4 h-4" />
                  </button>
                </div>

                {/* Status Filter */}
                <div className="relative">
                  <Filter className="absolute left-3 top-3.5 h-4 w-4 text-gray-400" />
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e?.target?.value)}
                    className="pl-10 pr-8 py-3 border border-gray-200 rounded-xl bg-white/80 backdrop-blur-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all duration-200 text-gray-900 appearance-none cursor-pointer"
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
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-6 py-3 rounded-xl hover:from-emerald-700 hover:to-teal-700 flex items-center space-x-3 shadow-lg hover:shadow-xl transition-all duration-200 font-medium"
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>New Deal</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="px-8 py-8">
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
                <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                  <Car className="w-12 h-12 text-indigo-600" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  No vehicles in tracking system
                </h3>
                <p className="text-gray-600 mb-8 max-w-md mx-auto">
                  {searchQuery
                    ? 'No vehicles match your search criteria. Try adjusting your filters.'
                    : 'Start by creating deals with vehicles to see them appear in this tracking system.'}
                </p>
                <button
                  onClick={() => navigate('/deals')}
                  className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 flex items-center space-x-3 shadow-lg hover:shadow-xl transition-all duration-200 font-medium mx-auto"
                >
                  <TrendingUp className="w-5 h-5" />
                  <span>Create Your First Deal</span>
                </button>
              </div>
            )
          ) : (
            // Table View - Premium styling
            <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200/50 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200">
                      <th className="px-8 py-6 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Stock #
                      </th>
                      <th className="px-8 py-6 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Vehicle Details
                      </th>
                      <th className="px-8 py-6 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Owner Information
                      </th>
                      <th className="px-8 py-6 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-8 py-6 text-left text-sm font-bold text-gray-900 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {vehicles?.map((vehicle) => {
                      const statusConfig = getStatusConfig(vehicle?.vehicle_status)
                      const StatusIcon = statusConfig?.icon

                      return (
                        <tr
                          key={vehicle?.id}
                          className="hover:bg-gray-50/50 transition-all duration-200"
                        >
                          <td className="px-8 py-6 whitespace-nowrap">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg">
                                <Car className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="text-lg font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                                  #{vehicle?.stock_number || 'N/A'}
                                </div>
                                <div className="text-sm text-gray-500 font-medium">
                                  {vehicle?.license_plate}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-base font-semibold text-gray-900">
                              {vehicle?.year} {vehicle?.make} {vehicle?.model}
                            </div>
                            <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
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
                            <div className="text-xs text-gray-500 font-mono bg-gray-50 px-2 py-1 rounded mt-2 inline-block">
                              VIN: {vehicle?.vin}
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="text-base font-semibold text-gray-900">
                              {vehicle?.owner_name}
                            </div>
                            <div className="space-y-1 mt-2 text-sm text-gray-600">
                              {vehicle?.owner_phone && (
                                <div className="flex items-center">
                                  <Phone className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                  {vehicle?.owner_phone}
                                </div>
                              )}
                              {vehicle?.owner_email && (
                                <div className="flex items-center">
                                  <Mail className="w-3.5 h-3.5 mr-2 text-gray-400" />
                                  {vehicle?.owner_email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-6 whitespace-nowrap">
                            <div
                              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-semibold ${statusConfig?.bg} ${statusConfig?.text} ${statusConfig?.border} border`}
                            >
                              <StatusIcon className="w-4 h-4 mr-2" />
                              {statusConfig?.label}
                            </div>
                          </td>
                          <td className="px-8 py-6 whitespace-nowrap">
                            <div className="flex space-x-3">
                              <button
                                onClick={() => handleViewHistory(vehicle)}
                                className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center"
                              >
                                <History className="w-4 h-4 mr-2" />
                                History
                              </button>
                              <button
                                onClick={() => handleScheduleService(vehicle)}
                                className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:from-emerald-700 hover:to-teal-700 transition-all duration-200 shadow-md hover:shadow-lg flex items-center"
                              >
                                <Calendar className="w-4 h-4 mr-2" />
                                Schedule
                              </button>
                              <button className="px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 flex items-center">
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
                  <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 flex items-center justify-center">
                    <Car className="w-12 h-12 text-indigo-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">No vehicles found</h3>
                  <p className="text-gray-600 mb-8 max-w-md mx-auto">
                    {searchQuery
                      ? 'No vehicles match your search criteria. Try adjusting your filters.'
                      : 'Start by creating deals with vehicles to see them appear in this tracking system.'}
                  </p>
                  <button
                    onClick={() => navigate('/deals')}
                    className="bg-gradient-to-r from-emerald-600 to-teal-600 text-white px-8 py-4 rounded-xl hover:from-emerald-700 hover:to-teal-700 flex items-center space-x-3 shadow-lg hover:shadow-xl transition-all duration-200 font-medium mx-auto"
                  >
                    <TrendingUp className="w-5 h-5" />
                    <span>Create Your First Deal</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Premium History Drawer */}
        {showHistoryDrawer && selectedVehicle && (
          <div className="fixed inset-y-0 right-0 w-[480px] bg-white/95 backdrop-blur-xl shadow-2xl border-l border-gray-200/50 z-50">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-8 border-b border-gray-200/50">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">
                    Vehicle History
                  </h3>
                  <button
                    onClick={() => setShowHistoryDrawer(false)}
                    className="w-10 h-10 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-all duration-200"
                  >
                    <span className="text-xl font-light">×</span>
                  </button>
                </div>
                <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
                  <div className="flex items-center space-x-4 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-lg">
                      <Car className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <div className="text-lg font-bold text-gray-900">
                        #{selectedVehicle?.stock_number} • {selectedVehicle?.year}{' '}
                        {selectedVehicle?.make} {selectedVehicle?.model}
                      </div>
                      <div className="text-sm text-gray-600 font-medium">
                        {selectedVehicle?.owner_name}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* History Content */}
              <div className="flex-1 overflow-y-auto p-8">
                <div className="space-y-6">
                  {vehicleHistory?.length > 0 ? (
                    vehicleHistory?.map((item, index) => (
                      <div key={index} className="relative">
                        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition-all duration-200">
                          <div className="flex items-start space-x-4">
                            <div
                              className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                                item?.type === 'job'
                                  ? 'bg-gradient-to-br from-blue-600 to-indigo-600'
                                  : 'bg-gradient-to-br from-emerald-600 to-teal-600'
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
                      <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
                        <History className="w-10 h-10 text-gray-400" />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-2">
                        No History Available
                      </h4>
                      <p className="text-gray-600">This vehicle has no recorded history yet.</p>
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
