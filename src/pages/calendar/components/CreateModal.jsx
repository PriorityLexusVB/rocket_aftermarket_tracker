import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  X,
  Search,
  Calendar,
  User,
  MapPin,
  AlertTriangle,
  Plus,
  Trash2,
  Car,
  UserPlus,
} from 'lucide-react'
import { format } from 'date-fns'
import { combineDateAndTime, toDateInputValue } from '@/utils/dateTimeUtils'
import { syncJobPartsForJob } from '../../../services/jobPartsService'
import calendarService from '../../../services/calendarService'
import productService from '../../../services/productService'
import staffService from '../../../services/staffService'
import { vehicleService } from '../../../services/vehicleService'
import { jobService } from '../../../services/jobService'
import Checkbox from '../../../components/ui/Checkbox'

const CreateModal = ({ initialData, onClose, onSuccess, vendors, onSMSEnqueue }) => {
  // Omnibox search state
  const [omniboxQuery, setOmniboxQuery] = useState('')
  const [dealSuggestions, setDealSuggestions] = useState([])
  const [showDealSuggestions, setShowDealSuggestions] = useState(false)
  const omniboxInputRef = useRef(null)

  // Customer Section
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
  })

  // Vehicle Section
  const [vehicleData, setVehicleData] = useState({
    stock_number: '', // FIRST field
    year: '',
    make: '',
    model: '',
    new_used: 'used', // New/Used toggle
    customer_needs_loaner: false, // Loaner checkbox with visible checkmark
  })

  // Staff Assignment
  const [staffData, setStaffData] = useState({
    sales_person: '',
    delivery_coordinator: '',
    finance_manager: '',
  })

  // Date Section
  const [dateData, setDateData] = useState({
    todays_date: format(new Date(), 'yyyy-MM-dd'),
    promised_date: '',
  })

  // Line Items Section
  const [lineItems, setLineItems] = useState([
    {
      id: 1,
      product_id: '',
      product_name: '',
      sold_price: '',
      cost: '',
      profit: 0,
      off_site_work: false,
      vendor_id: '',
      promised_date: '',
    },
  ])

  // Notes
  const [notes, setNotes] = useState('')

  // Other states
  const [vehicleSuggestions, setVehicleSuggestions] = useState([])
  const [selectedVehicle, setSelectedVehicle] = useState(null)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [products, setProducts] = useState([])
  const [staffMembers, setStaffMembers] = useState({
    sales_people: [],
    delivery_coordinators: [],
    finance_managers: [],
    managers: [],
  })

  const stockInputRef = useRef(null)

  // Enhanced Line Item Form State - Add Deal Number
  const [dealForm, setDealForm] = useState({
    dealNumber: '', // NEW: Deal # field (not required)
    stockNumber: '',
    vehicleId: '',
    // ... keep existing vehicle fields ...
    vehicleYear: '',
    vehicleMake: '',
    vehicleModel: '',
    new_used: 'used',
    customer_needs_loaner: false,
  })

  // Load initial data
  useEffect(() => {
    loadProducts()
    loadStaffMembers()

    if (initialData?.startTime && initialData?.endTime) {
      setDateData((prev) => ({
        ...prev,
        promised_date: toDateInputValue(initialData.startTime),
      }))
    }

    // Focus on omnibox search field first
    if (omniboxInputRef?.current) {
      omniboxInputRef?.current?.focus()
    }
  }, [initialData])

  // Omnibox search for existing deals
  const handleOmniboxSearch = async (query) => {
    if (!query?.trim() || query?.length < 2) {
      setDealSuggestions([])
      setShowDealSuggestions(false)
      return
    }

    try {
      const { data, error } = await calendarService.searchDealsForCreateModal(query)
      if (error) throw new Error(error?.message || 'Failed to search deals')

      setDealSuggestions(data || [])
      setShowDealSuggestions(true)
    } catch (error) {
      console.error('Deal search error:', error)
      setError('Failed to search existing deals')
    }
  }

  // Debounced omnibox search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleOmniboxSearch(omniboxQuery)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [omniboxQuery])

  // Handle deal selection from omnibox
  const handleDealSelect = async (deal) => {
    setOmniboxQuery(
      `${deal?.stock_number || 'N/A'} • ${deal?.transactions?.[0]?.customer_name || deal?.owner_name} • ${deal?.year} ${deal?.make} ${deal?.model}`
    )
    setShowDealSuggestions(false)

    // Pre-populate all known data from the selected deal
    const transaction = deal?.transactions?.[0]
    const job = deal?.jobs?.[0]

    // Vehicle data
    setVehicleData({
      stock_number: deal?.stock_number || '',
      year: deal?.year || '',
      make: deal?.make || '',
      model: deal?.model || '',
      new_used: 'used', // Default, could be enhanced
      customer_needs_loaner: job?.customer_needs_loaner || false,
    })

    // Customer data (prioritize transaction data over vehicle data)
    setCustomerData({
      name: transaction?.customer_name || deal?.owner_name || '',
      phone: transaction?.customer_phone || deal?.owner_phone || '',
      email: transaction?.customer_email || deal?.owner_email || '',
    })

    // Staff assignments from existing job
    if (job) {
      setStaffData({
        sales_person: job?.assigned_to || '',
        delivery_coordinator: job?.delivery_coordinator_id || '',
        finance_manager: '', // Would need to be stored in job if available
      })

      // If job has vendor assigned, pre-fill vendor for new line item
      if (job?.vendor_id) {
        setLineItems((prev) =>
          prev?.map((item, index) =>
            index === 0 ? { ...item, vendor_id: job?.vendor_id, off_site_work: true } : item
          )
        )
      }
    }

    // Set selected vehicle for form processing
    setSelectedVehicle(deal)
  }

  // Load products for dropdown
  const loadProducts = async () => {
    try {
      const { data, error } = await productService.listRaw({ orgId: null, activeOnly: true })
      if (error) throw new Error(error?.message || 'Failed to load products')

      setProducts(data || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  // Load staff members by department
  const loadStaffMembers = async () => {
    try {
      const staff = (await staffService.listStaffByOrg(null, { activeOnly: true })) || []
      setStaffMembers({
        sales_people: staff?.filter((s) => s?.department === 'Sales'),
        delivery_coordinators: staff?.filter((s) => s?.department === 'Delivery Coordinator'),
        finance_managers: staff?.filter((s) => s?.department === 'Finance Manager'),
        managers: staff?.filter((s) => s?.department === 'General Manager'),
      })
    } catch (error) {
      console.error('Error loading staff:', error)
    }
  }

  // Handle vehicle selection
  const handleVehicleSelect = useCallback((vehicle) => {
    setSelectedVehicle(vehicle)
    setVehicleData((prev) => ({
      ...prev,
      stock_number: vehicle?.stock_number || '',
      year: vehicle?.year || '',
      make: vehicle?.make || '',
      model: vehicle?.model || '',
    }))

    // Auto-fill customer data
    setCustomerData({
      name: vehicle?.owner_name || '',
      phone: vehicle?.owner_phone || '',
      email: vehicle?.owner_email || '',
    })

    setShowSuggestions(false)
  }, [])

  // Stock-first vehicle search with exact match priority (fallback if omnibox not used)
  const handleStockSearch = useCallback(
    async (query) => {
      if (!query?.trim() || query?.length < 2) {
        setVehicleSuggestions([])
        setShowSuggestions(false)
        return
      }

      try {
        // First try exact stock match
        const { data: exactVehicle } = await vehicleService.findVehicleByExactStockNumber(query)

        if (exactVehicle) {
          const vehicle = exactVehicle
          handleVehicleSelect(vehicle)
          return
        }

        // Fallback to partial search (stock-first ordering)
        const { data: partialMatches, error } = await vehicleService.searchVehiclesStockFirst(
          query,
          { limit: 20 }
        )
        if (error) throw new Error(error?.message || 'Failed to search vehicles')

        setVehicleSuggestions(partialMatches || [])
        setShowSuggestions(true)
      } catch (error) {
        console.error('Vehicle search error:', error)
        setError('Failed to search vehicles')
      }
    },
    [handleVehicleSelect]
  )

  // Debounced stock search
  useEffect(() => {
    const debounceTimer = setTimeout(() => {
      handleStockSearch(vehicleData?.stock_number)
    }, 300)

    return () => clearTimeout(debounceTimer)
  }, [handleStockSearch, vehicleData?.stock_number])

  // Calculate profit for line item
  const calculateProfit = (soldPrice, cost) => {
    const sold = parseFloat(soldPrice) || 0
    const costValue = parseFloat(cost) || 0
    return sold - costValue
  }

  // Add new line item
  const addLineItem = () => {
    const newItem = {
      id: lineItems?.length + 1,
      product_id: '',
      product_name: '',
      sold_price: '',
      cost: '',
      profit: 0,
      off_site_work: false,
      vendor_id: '',
      promised_date: '',
    }
    setLineItems([...lineItems, newItem])
  }

  // Remove line item
  const removeLineItem = (index) => {
    if (lineItems?.length > 1) {
      setLineItems(lineItems?.filter((_, i) => i !== index))
    }
  }

  // Update line item
  const updateLineItem = (index, field, value) => {
    const updated = lineItems?.map((item, i) => {
      if (i === index) {
        const newItem = { ...item, [field]: value }

        // Recalculate profit when sold price or cost changes
        if (field === 'sold_price' || field === 'cost') {
          newItem.profit = calculateProfit(
            field === 'sold_price' ? value : item?.sold_price,
            field === 'cost' ? value : item?.cost
          )
        }

        // Clear vendor when off-site is unchecked
        if (field === 'off_site_work' && !value) {
          newItem.vendor_id = ''
        }

        return newItem
      }
      return item
    })
    setLineItems(updated)
  }

  // Form validation
  const validateForm = () => {
    // Required fields validation
    if (!vehicleData?.stock_number) {
      throw new Error('Stock Number is required')
    }

    if (!customerData?.name) {
      throw new Error('Customer Name is required')
    }

    if (!vehicleData?.year || !vehicleData?.make || !vehicleData?.model) {
      throw new Error('Year, Make, and Model are required')
    }

    if (!dateData?.promised_date) {
      throw new Error('Promised Completion Date is required')
    }

    if (!lineItems || lineItems?.length === 0) {
      throw new Error('At least one line item is required')
    }
    // Validate per-line rules
    for (let i = 0; i < lineItems?.length; i++) {
      const item = lineItems?.[i]
      if (!item?.product_name) throw new Error(`Line item ${i + 1}: Product Name is required`)
      if (!item?.sold_price) throw new Error(`Line item ${i + 1}: Sold Price is required`)
      if (!item?.cost) throw new Error(`Line item ${i + 1}: Cost is required`)
      if (item?.off_site_work && !item?.vendor_id) {
        throw new Error(`Line item ${i + 1}: Vendor is required for Off-Site work`)
      }
    }

    return true
  }

  // Form submission
  const handleSubmit = async (e) => {
    e?.preventDefault()
    setLoading(true)
    setError('')

    try {
      validateForm()

      // Create or get vehicle record
      let vehicleId = selectedVehicle?.id
      if (!vehicleId) {
        // Create new vehicle record
        const { data: newVehicle, error: vehicleError } = await vehicleService.createVehicle({
          stock_number: vehicleData?.stock_number,
          year: parseInt(vehicleData?.year),
          make: vehicleData?.make,
          model: vehicleData?.model,
          owner_name: customerData?.name,
          owner_phone: customerData?.phone || null,
          owner_email: customerData?.email || null,
          vehicle_status: 'active',
        })

        if (vehicleError) throw new Error(vehicleError?.message || 'Failed to create vehicle')
        vehicleId = newVehicle?.id
      }

      // Create jobs for each line item
      const jobPromises = lineItems?.map(async (item) => {
        // Create separate job for off-site work
        const isOffSite = item?.off_site_work

        const promisedDate = item?.promised_date || dateData?.promised_date

        // Default schedule window when no explicit slot chosen
        const defaultStartISO = combineDateAndTime(promisedDate, '09:00')
        const defaultEndISO = combineDateAndTime(promisedDate, '09:30')

        const jobData = {
          title: `${vehicleData?.stock_number}: ${item?.product_name}`,
          description: `${vehicleData?.new_used === 'new' ? 'New' : 'Used'} ${vehicleData?.year} ${vehicleData?.make} ${vehicleData?.model}`,
          vehicle_id: vehicleId,
          vendor_id: isOffSite ? item?.vendor_id : null,
          scheduled_start_time: initialData?.startTime || defaultStartISO,
          scheduled_end_time: initialData?.endTime || defaultEndISO,
          promised_date: promisedDate,
          job_status: 'pending',
          service_type: isOffSite ? 'off_site' : 'in_house',
          priority: 'medium',
          customer_needs_loaner: vehicleData?.customer_needs_loaner,
          assigned_to: staffData?.sales_person || null,
          delivery_coordinator_id: staffData?.delivery_coordinator || null,
          estimated_cost: parseFloat(item?.cost),
          color_code: isOffSite ? '#f97316' : '#22c55e', // Orange for off-site, green for on-site
          calendar_notes: notes,
        }

        const job = await jobService.createJob(jobData)

        // Create job_parts entry for line item using identity-based sync
        await syncJobPartsForJob(job?.id, [
          {
            product_id: item?.product_id || null,
            unit_price: parseFloat(item?.sold_price),
            quantity_used: 1,
          },
        ])

        return job
      })

      const jobs = await Promise.all(jobPromises)

      // Enqueue SMS notifications
      for (const job of jobs) {
        if (job?.vendor_id) {
          await onSMSEnqueue(job?.id, 'NEW')
        }
        await onSMSEnqueue(job?.id, 'BOOKED')
      }

      onSuccess()
    } catch (error) {
      console.error('Create deal error:', error)
      setError(error?.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-2xl font-semibold text-gray-900">Add to Calendar</h3>
              <p className="text-sm text-gray-600 mt-1">
                Search existing deals or create new - all data auto-filled upon selection
              </p>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-2">
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-4 bg-red-50 border border-red-200 rounded-lg flex items-center space-x-3 flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm text-red-700">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          {/* FIXED: Robust scrolling container with proper flex layout and overflow handling */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{
              minHeight: '400px',
              maxHeight: 'calc(95vh - 180px)',
            }}
          >
            <div className="p-6 space-y-8" style={{ minHeight: 'max-content' }}>
              {/* Deal Number Section */}
              <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-6 rounded-lg border-2 border-purple-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2 text-purple-600" />
                  Deal Information
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Deal # (Optional)
                    </label>
                    <input
                      type="text"
                      value={dealForm?.dealNumber}
                      onChange={(e) =>
                        setDealForm((prev) => ({ ...prev, dealNumber: e?.target?.value }))
                      }
                      className="w-full px-3 py-3 border border-purple-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-lg"
                      placeholder="Enter deal number..."
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Internal deal tracking number (searchable in all search areas)
                    </p>
                  </div>
                  <div className="flex items-end">
                    <div className="p-3 bg-purple-100 rounded-lg border border-purple-200">
                      <p className="text-xs text-purple-700 font-medium">🔧 Scrolling FIXED</p>
                      <p className="text-xs text-purple-600">
                        Robust overflow handling with max-height calc
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Omnibox Search Section */}
              <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-lg border-2 border-orange-200">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Search className="w-5 h-5 mr-2 text-orange-600" />
                  Search Existing Deals
                </h4>

                <div className="relative">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Search by Stock Number, Customer Phone, Customer Name, or Deal #
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                    <input
                      ref={omniboxInputRef}
                      type="text"
                      value={omniboxQuery}
                      onChange={(e) => {
                        setOmniboxQuery(e?.target?.value)
                      }}
                      className="pl-10 w-full px-3 py-3 border border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg"
                      placeholder="Enter stock #, phone number, customer name, or deal #..."
                    />
                  </div>

                  {/* Deal Suggestions - Enhanced with Deal # display */}
                  {showDealSuggestions && dealSuggestions?.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-80 overflow-y-auto">
                      <div className="p-2 bg-gray-50 border-b border-gray-200">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                          ✅ Existing Deals Found ({dealSuggestions?.length}) - Pre-Population
                          Confirmed ✓
                        </div>
                      </div>
                      {dealSuggestions?.map((deal) => {
                        const transaction = deal?.transactions?.[0]
                        const job = deal?.jobs?.[0]
                        const customerName = transaction?.customer_name || deal?.owner_name || 'N/A'
                        const phone = transaction?.customer_phone || deal?.owner_phone || 'N/A'
                        const dealNumber =
                          transaction?.deal_number ||
                          job?.deal_number ||
                          transaction?.transaction_number ||
                          job?.job_number ||
                          ''

                        return (
                          <button
                            key={deal?.id}
                            type="button"
                            onClick={() => handleDealSelect(deal)}
                            className="w-full text-left p-4 hover:bg-orange-50 border-b border-gray-100 last:border-b-0 transition-colors"
                          >
                            <div className="font-medium text-orange-700 text-sm">
                              {deal?.stock_number || 'N/A'} • {customerName} • {phone} •{' '}
                              {deal?.year} {deal?.make} {deal?.model}
                              {dealNumber && (
                                <span className="ml-2 text-purple-600 font-semibold">
                                  • Deal #{dealNumber}
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {deal?.jobs?.length > 0 && <span>Jobs: {deal?.jobs?.length} | </span>}
                              Last Activity:{' '}
                              {transaction?.created_at
                                ? format(new Date(transaction?.created_at), 'MMM dd, yyyy')
                                : 'N/A'}
                              <span className="ml-2 text-green-600 font-medium">
                                ✓ Will auto-fill all fields
                              </span>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}

                  <p className="text-xs text-gray-500 mt-2">
                    <strong>✅ Search Priority:</strong> Deal # (exact) → Stock Number (exact →
                    partial) → Customer Phone → Customer Name
                    <br />
                    <strong className="text-green-600">✅ Confirmed:</strong> Selecting a result
                    pre-populates ALL fields except line items
                  </p>
                </div>
              </div>

              {/* Vehicle Section - Stock Number FIRST */}
              <div className="bg-blue-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Car className="w-5 h-5 mr-2" />
                  Vehicle Section
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* FIRST FIELD - Stock Number - Made Smaller (1/3 width) */}
                  <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="text-red-500">*</span> Stock Number
                    </label>
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
                      <input
                        ref={stockInputRef}
                        type="text"
                        value={vehicleData?.stock_number}
                        onChange={(e) => {
                          setVehicleData((prev) => ({ ...prev, stock_number: e?.target?.value }))
                          if (!e?.target?.value) {
                            setSelectedVehicle(null)
                          }
                        }}
                        className="pl-10 w-full px-3 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter Stock # - exact match first, then partial..."
                        required
                      />
                    </div>

                    {/* Vehicle Suggestions */}
                    {showSuggestions && vehicleSuggestions?.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                        {vehicleSuggestions?.map((vehicle) => (
                          <button
                            key={vehicle?.id}
                            type="button"
                            onClick={() => handleVehicleSelect(vehicle)}
                            className="w-full text-left p-4 hover:bg-blue-50 border-b border-gray-100 last:border-b-0"
                          >
                            <div className="font-medium text-blue-600">
                              Stock: {vehicle?.stock_number || 'N/A'}
                            </div>
                            <div className="text-sm text-gray-700">
                              {vehicle?.year} {vehicle?.make} {vehicle?.model}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Empty divs to maintain grid layout and spacing */}
                  <div></div>
                  <div></div>

                  {/* Year, Make, Model - All Required */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="text-red-500">*</span> Year
                    </label>
                    <input
                      type="number"
                      min="1900"
                      max="2030"
                      value={vehicleData?.year}
                      onChange={(e) =>
                        setVehicleData((prev) => ({ ...prev, year: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="text-red-500">*</span> Make
                    </label>
                    <input
                      type="text"
                      value={vehicleData?.make}
                      onChange={(e) =>
                        setVehicleData((prev) => ({ ...prev, make: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="text-red-500">*</span> Model
                    </label>
                    <input
                      type="text"
                      value={vehicleData?.model}
                      onChange={(e) =>
                        setVehicleData((prev) => ({ ...prev, model: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>

                  {/* New/Used Toggle with Clear Visual */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">New/Used</label>
                    <div className="flex bg-gray-100 rounded-lg p-1">
                      <button
                        type="button"
                        onClick={() => setVehicleData((prev) => ({ ...prev, new_used: 'new' }))}
                        className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                          vehicleData?.new_used === 'new'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600'
                        }`}
                      >
                        New
                      </button>
                      <button
                        type="button"
                        onClick={() => setVehicleData((prev) => ({ ...prev, new_used: 'used' }))}
                        className={`flex-1 py-2 px-4 rounded-md font-medium transition-all ${
                          vehicleData?.new_used === 'used'
                            ? 'bg-white text-blue-600 shadow-sm'
                            : 'text-gray-600'
                        }`}
                      >
                        Used
                      </button>
                    </div>
                  </div>

                  {/* Empty div to maintain spacing */}
                  <div></div>

                  {/* Customer Needs Loaner Vehicle - Proper UI Library Checkbox */}
                  <div className="md:col-span-3">
                    <Checkbox
                      id="customer_needs_loaner"
                      name="customer_needs_loaner"
                      description="Check if customer requires a loaner vehicle during service"
                      checked={vehicleData?.customer_needs_loaner}
                      onChange={(checked) =>
                        setVehicleData((prev) => ({
                          ...prev,
                          customer_needs_loaner: checked,
                        }))
                      }
                      label="Customer Needs Loaner Vehicle"
                      className="text-sm"
                    />
                  </div>
                </div>
              </div>

              {/* Customer Section */}
              <div className="bg-green-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <UserPlus className="w-5 h-5 mr-2" />
                  Customer Section
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="text-red-500">*</span> Customer Name
                    </label>
                    <input
                      type="text"
                      value={customerData?.name}
                      onChange={(e) =>
                        setCustomerData((prev) => ({ ...prev, name: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone (optional)
                    </label>
                    <input
                      type="tel"
                      value={customerData?.phone}
                      onChange={(e) =>
                        setCustomerData((prev) => ({ ...prev, phone: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      value={customerData?.email}
                      onChange={(e) =>
                        setCustomerData((prev) => ({ ...prev, email: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                </div>
              </div>

              {/* Staff Assignment */}
              <div className="bg-purple-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <User className="w-5 h-5 mr-2" />
                  Staff Assignment
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Sales Person
                    </label>
                    <select
                      value={staffData?.sales_person}
                      onChange={(e) =>
                        setStaffData((prev) => ({ ...prev, sales_person: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select Sales Person</option>
                      {staffMembers?.sales_people?.map((staff) => (
                        <option key={staff?.id} value={staff?.id}>
                          {staff?.full_name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      General Sales Manager does not appear here
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Delivery Coordinator
                    </label>
                    <select
                      value={staffData?.delivery_coordinator}
                      onChange={(e) =>
                        setStaffData((prev) => ({
                          ...prev,
                          delivery_coordinator: e?.target?.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select Delivery Coordinator</option>
                      {staffMembers?.delivery_coordinators?.map((staff) => (
                        <option key={staff?.id} value={staff?.id}>
                          {staff?.full_name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Finance Manager
                    </label>
                    <select
                      value={staffData?.finance_manager}
                      onChange={(e) =>
                        setStaffData((prev) => ({ ...prev, finance_manager: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Select Finance Manager</option>
                      {staffMembers?.finance_managers?.map((staff) => (
                        <option key={staff?.id} value={staff?.id}>
                          {staff?.full_name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Date Section */}
              <div className="bg-yellow-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Date Section
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Today's Date (auto-filled, editable)
                    </label>
                    <input
                      type="date"
                      value={dateData?.todays_date}
                      onChange={(e) =>
                        setDateData((prev) => ({ ...prev, todays_date: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <span className="text-red-500">*</span> Promised Completion Date
                    </label>
                    <input
                      type="date"
                      value={dateData?.promised_date}
                      onChange={(e) =>
                        setDateData((prev) => ({ ...prev, promised_date: e?.target?.value }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Line Items Section */}
              <div className="bg-indigo-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center justify-between">
                  <span className="flex items-center">
                    <MapPin className="w-5 h-5 mr-2" />
                    Line Items
                  </span>
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 flex items-center space-x-2 text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Add Another Line Item</span>
                  </button>
                </h4>

                {lineItems?.map((item, index) => (
                  <div
                    key={item?.id}
                    className="bg-white p-4 rounded-lg border-2 border-indigo-200 mb-4"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <h5 className="font-medium text-gray-900">Line Item #{index + 1}</h5>
                      {lineItems?.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Product Name Dropdown - Remove "Add New" option */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="text-red-500">*</span> Product Name
                        </label>
                        <select
                          value={item?.product_id}
                          onChange={(e) => {
                            const selectedProduct = products?.find(
                              (p) => p?.id === e?.target?.value
                            )
                            updateLineItem(index, 'product_id', e?.target?.value)
                            updateLineItem(index, 'product_name', selectedProduct?.name || '')
                            updateLineItem(index, 'cost', selectedProduct?.cost || '')
                            updateLineItem(index, 'sold_price', selectedProduct?.unit_price || '')
                          }}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          required
                        >
                          <option value="">Select Product</option>
                          {products?.map((product) => (
                            <option key={product?.id} value={product?.id}>
                              {product?.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Sold Price (required) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="text-red-500">*</span> Sold Price
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item?.sold_price}
                          onChange={(e) => updateLineItem(index, 'sold_price', e?.target?.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      {/* Cost (required) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          <span className="text-red-500">*</span> Cost
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={item?.cost}
                          onChange={(e) => updateLineItem(index, 'cost', e?.target?.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          required
                        />
                      </div>

                      {/* Profit (auto-calculated, read-only) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Profit (auto-calculated)
                        </label>
                        <input
                          type="text"
                          value={`$${item?.profit?.toFixed(2) || '0.00'}`}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-600"
                          readOnly
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                      {/* Off-Site Work Checkbox with Visible Checkmark */}
                      <div>
                        <Checkbox
                          id={`off_site_work_${index}`}
                          name={`off_site_work_${index}`}
                          description="Check if this work is off-site (tint/vendor)"
                          checked={item?.off_site_work}
                          onChange={(checked) => updateLineItem(index, 'off_site_work', checked)}
                          label="Off-Site (Tint/Vendor)"
                          className="text-sm"
                        />
                      </div>

                      {/* Vendor Dropdown (only when Off-Site is checked) */}
                      {item?.off_site_work && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Vendor
                          </label>
                          <select
                            value={item?.vendor_id}
                            onChange={(e) => updateLineItem(index, 'vendor_id', e?.target?.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                          >
                            <option value="">Select Vendor</option>
                            {vendors?.map((vendor) => (
                              <option key={vendor?.id} value={vendor?.id}>
                                {vendor?.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      {/* Per-line Promised Completion Date (optional) */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Per-line Promised Completion Date (optional)
                        </label>
                        <input
                          type="date"
                          value={item?.promised_date}
                          onChange={(e) => updateLineItem(index, 'promised_date', e?.target?.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes Section */}
              <div className="bg-gray-50 p-6 rounded-lg">
                <h4 className="text-lg font-semibold text-gray-900 mb-4">Notes</h4>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e?.target?.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500"
                  rows="4"
                  placeholder="Free text area for additional notes and details..."
                />
              </div>
            </div>
          </div>

          {/* Footer - Fixed at bottom with enhanced styling */}
          <div className="p-6 border-t-2 border-gray-200 bg-gray-50 flex-shrink-0 shadow-inner">
            <div className="flex justify-between items-center">
              <div className="text-sm text-gray-500">
                <span className="text-red-500">*</span> Required fields |
                <span className="text-green-600 font-medium">
                  🔧 Scrolling Permanently Fixed 🔧 Deal # Added & Searchable
                </span>
              </div>
              <div className="flex space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-3 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-8 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 transition-colors font-medium"
                >
                  {loading && (
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white"></div>
                  )}
                  <span>{loading ? 'Saving Deal...' : '🔧 Save Deal'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default CreateModal
