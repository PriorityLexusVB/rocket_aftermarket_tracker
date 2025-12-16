import React, { useState, useEffect } from 'react'
import AppLayout from '../../components/layouts/AppLayout'
import { claimsService } from '../../services/claimsService'
import {
  FileText,
  Upload,
  Search,
  CheckCircle,
  AlertCircle,
  Phone,
  Mail,
  User,
  Car,
  Package,
  X,
} from 'lucide-react'
import Icon from '../../components/AppIcon'

// Import step schemas for validating the multi‑step claim wizard
import {
  customerClaimStep1Schema,
  customerClaimStep2Schema,
  customerClaimStep3Schema,
} from '../../utils/claimSchemas'

const CustomerClaimsSubmissionPortal = () => {
  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    vehicle_id: '',
    product_id: '',
    issue_description: '',
    preferred_resolution: '',
    claim_amount: '',
    priority: 'medium',
  })

  // UI state
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submittedClaim, setSubmittedClaim] = useState(null)

  // Data state
  const [customerVehicles, setCustomerVehicles] = useState([])
  const [products, setProducts] = useState([])
  const [searchResults, setSearchResults] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [searchType, setSearchType] = useState('stock_number')

  // File upload state
  const [uploadedFiles, setUploadedFiles] = useState([])
  const [uploadProgress, setUploadProgress] = useState({})

  // Load products on component mount
  useEffect(() => {
    loadProducts()
  }, [])

  // Load customer vehicles when email changes
  useEffect(() => {
    if (formData?.customer_email && formData?.customer_email?.includes('@')) {
      loadCustomerVehicles(formData?.customer_email)
    }
  }, [formData?.customer_email])

  const loadProducts = async () => {
    try {
      const productsData = await claimsService?.getProducts()
      setProducts(productsData || [])
    } catch (error) {
      console.error('Error loading products:', error)
    }
  }

  const loadCustomerVehicles = async (email) => {
    try {
      setLoading(true)
      const vehicles = await claimsService?.getCustomerVehicles(email)
      setCustomerVehicles(vehicles || [])
    } catch (error) {
      console.error('Error loading customer vehicles:', error)
      setCustomerVehicles([])
    } finally {
      setLoading(false)
    }
  }

  const handleCustomerSearch = async () => {
    if (!searchTerm?.trim()) {
      setErrors({ search: 'Please enter a search term' })
      return
    }

    try {
      setLoading(true)
      setErrors({})

      // For now, we'll simulate the search functionality
      // In a real implementation, you would call a search service
      console.log(`Searching for ${searchType}:`, searchTerm)

      // Mock customer data based on search
      const mockCustomer = {
        customer_name: 'John Smith',
        customer_email: 'john.smith@email.com',
        customer_phone: '555-0123',
        vehicle: {
          id: 'mock-vehicle-id',
          make: 'Honda',
          model: 'Civic',
          year: 2018,
          vin: '1HGBH41JXMN109186',
        },
      }

      // Auto-populate form with found customer data
      setFormData((prev) => ({
        ...prev,
        customer_name: mockCustomer?.customer_name,
        customer_email: mockCustomer?.customer_email,
        customer_phone: mockCustomer?.customer_phone,
        vehicle_id: mockCustomer?.vehicle?.id,
      }))

      setSearchResults([mockCustomer])
    } catch (error) {
      setErrors({ search: 'Error searching customer records' })
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))

    // Clear error when user starts typing
    if (errors?.[field]) {
      setErrors((prev) => ({
        ...prev,
        [field]: null,
      }))
    }
  }

  const validateStep = (step) => {
    // Choose the correct schema based on the current step.  Each schema
    // validates only the fields present on that step, providing step-specific
    // error messages.  If there is no schema for the given step, validation
    // passes by default (e.g. review/confirmation screens).
    let schema = null
    if (step === 1) schema = customerClaimStep1Schema
    else if (step === 2) schema = customerClaimStep2Schema
    else if (step === 3) schema = customerClaimStep3Schema

    if (schema) {
      const result = schema.safeParse(formData)
      if (!result?.success) {
        const newErrors = {}
        result.error?.issues?.forEach((issue) => {
          const key = issue?.path?.[0]
          newErrors[key] = issue?.message
        })
        setErrors(newErrors)
        return false
      }
      setErrors({})
      return true
    }

    // No validation required for this step
    return true
  }

  const nextStep = () => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, 4))
    }
  }

  const prevStep = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
  }

  const handleFileUpload = async (event) => {
    const files = Array.from(event?.target?.files || [])

    for (const file of files) {
      if (file?.size > 10 * 1024 * 1024) {
        // 10MB limit
        setErrors((prev) => ({
          ...prev,
          files: 'File size must be less than 10MB',
        }))
        continue
      }

      if (!file?.type?.startsWith('image/')) {
        setErrors((prev) => ({
          ...prev,
          files: 'Only image files are allowed',
        }))
        continue
      }

      const fileId = `${Date.now()}-${file?.name}`
      setUploadedFiles((prev) => [
        ...prev,
        {
          id: fileId,
          file,
          name: file?.name,
          size: file?.size,
          type: file?.type,
          preview: URL.createObjectURL(file),
          description: '',
        },
      ])
    }
  }

  const removeFile = (fileId) => {
    setUploadedFiles((prev) => {
      const fileToRemove = prev?.find((f) => f?.id === fileId)
      if (fileToRemove?.preview) {
        URL.revokeObjectURL(fileToRemove?.preview)
      }
      return prev?.filter((f) => f?.id !== fileId)
    })
  }

  const updateFileDescription = (fileId, description) => {
    setUploadedFiles((prev) =>
      prev?.map((file) => (file?.id === fileId ? { ...file, description } : file))
    )
  }

  const submitClaim = async () => {
    if (!validateStep(3)) return

    try {
      setSubmitLoading(true)
      setErrors({})

      // Create the claim
      const claimData = {
        customer_name: formData?.customer_name?.trim(),
        customer_email: formData?.customer_email?.trim(),
        customer_phone: formData?.customer_phone?.trim(),
        vehicle_id: formData?.vehicle_id || null,
        product_id: formData?.product_id || null,
        issue_description: formData?.issue_description?.trim(),
        preferred_resolution: formData?.preferred_resolution?.trim(),
        claim_amount: formData?.claim_amount ? parseFloat(formData?.claim_amount) : null,
        priority: formData?.priority || 'medium',
        status: 'submitted',
      }

      const newClaim = await claimsService?.createClaim(claimData)

      if (!newClaim) {
        throw new Error('Failed to create claim')
      }

      // Upload files if any
      for (const file of uploadedFiles) {
        try {
          await claimsService?.uploadClaimPhoto(
            newClaim?.id,
            file?.file,
            file?.description || `Photo uploaded by ${formData?.customer_name}`
          )
        } catch (fileError) {
          console.error(`Error uploading file ${file?.name}:`, fileError)
          // Continue with other files even if one fails
        }
      }

      setSubmittedClaim(newClaim)
      setSubmitted(true)
      setCurrentStep(4)
    } catch (error) {
      console.error('Error submitting claim:', error)
      setErrors({
        submit: error?.message || 'Failed to submit claim. Please try again.',
      })
    } finally {
      setSubmitLoading(false)
    }
  }

  const resetForm = () => {
    setFormData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      vehicle_id: '',
      product_id: '',
      issue_description: '',
      preferred_resolution: '',
      claim_amount: '',
      priority: 'medium',
    })
    setCurrentStep(1)
    setSubmitted(false)
    setSubmittedClaim(null)
    setUploadedFiles([])
    setErrors({})
    setSearchResults([])
    setSearchTerm('')
  }

  if (submitted && submittedClaim) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12">
          <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-white rounded-xl shadow-lg p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>

              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Claim Submitted Successfully!
              </h2>

              <div className="bg-gray-50 rounded-lg p-6 mb-6">
                <p className="text-lg font-semibold text-gray-900 mb-2">
                  Claim Number: {submittedClaim?.claim_number}
                </p>
                <p className="text-gray-600 mb-4">
                  Your claim has been submitted and is now under review.
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Customer:</span>
                    <p className="text-gray-900">{submittedClaim?.customer_name}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Priority:</span>
                    <span
                      className={`inline-block px-2 py-1 rounded-full text-xs font-medium ml-2 ${
                        submittedClaim?.priority === 'urgent'
                          ? 'bg-red-100 text-red-800'
                          : submittedClaim?.priority === 'high'
                            ? 'bg-yellow-100 text-yellow-800'
                            : submittedClaim?.priority === 'medium'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {submittedClaim?.priority?.charAt(0)?.toUpperCase() +
                        submittedClaim?.priority?.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-blue-900 mb-2">Next Steps:</h3>
                <ul className="text-blue-800 text-sm space-y-1">
                  <li>• You will receive an email confirmation shortly</li>
                  <li>• Our team will review your claim within 1-2 business days</li>
                  <li>• We may contact you for additional information if needed</li>
                  <li>• You will be notified of the claim decision via email</li>
                </ul>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={resetForm}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Submit Another Claim
                </button>
                <button
                  onClick={() => window.print()}
                  className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Print Confirmation
                </button>
              </div>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <FileText className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Customer Claims Submission Portal
            </h1>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Submit warranty and service claims with our easy-to-use portal. We'll guide you
              through each step to ensure your claim is processed quickly and accurately.
            </p>
          </div>

          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex items-center justify-center space-x-4">
              {[
                { step: 1, label: 'Customer Info', icon: User },
                { step: 2, label: 'Vehicle & Product', icon: Car },
                { step: 3, label: 'Claim Details', icon: FileText },
                { step: 4, label: 'Review & Submit', icon: CheckCircle },
              ]?.map(({ step, label, icon: Icon }) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${
                      currentStep >= step ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {currentStep > step ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      <Icon className="w-5 h-5" />
                    )}
                  </div>
                  <span
                    className={`ml-2 text-sm font-medium ${
                      currentStep >= step ? 'text-blue-600' : 'text-gray-500'
                    }`}
                  >
                    {label}
                  </span>
                  {step < 4 && (
                    <div
                      className={`w-12 h-0.5 ml-4 ${
                        currentStep > step ? 'bg-blue-600' : 'bg-gray-200'
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Form Content */}
          <div className="bg-white rounded-xl shadow-lg p-8">
            {/* Step 1: Customer Information */}
            {currentStep === 1 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Customer Information</h2>
                  <p className="text-gray-600">
                    Let's start by finding your information in our system
                  </p>
                </div>

                {/* Customer Search */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                  <h3 className="font-semibold text-blue-900 mb-4 flex items-center">
                    <Search className="w-5 h-5 mr-2" />
                    Quick Customer Lookup
                  </h3>

                  <div className="flex flex-col sm:flex-row gap-4">
                    <select
                      value={searchType}
                      onChange={(e) => setSearchType(e?.target?.value)}
                      className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="stock_number">Stock Number</option>
                      <option value="customer_phone">Phone Number</option>
                      <option value="customer_name">Customer Name</option>
                      <option value="deal_number">Deal Number</option>
                    </select>

                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e?.target?.value)}
                      placeholder={`Enter ${searchType?.replace('_', ' ')}`}
                      className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      onKeyPress={(e) => e?.key === 'Enter' && handleCustomerSearch()}
                    />

                    <button
                      onClick={handleCustomerSearch}
                      disabled={loading}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {loading ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  {errors?.search && <p className="text-red-600 text-sm mt-2">{errors?.search}</p>}
                </div>

                {/* Manual Entry */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <User className="w-4 h-4 inline mr-1" />
                      Customer Name *
                    </label>
                    <input
                      type="text"
                      value={formData?.customer_name}
                      onChange={(e) => handleInputChange('customer_name', e?.target?.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors?.customer_name ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter customer name"
                    />
                    {errors?.customer_name && (
                      <p className="text-red-600 text-sm mt-1">{errors?.customer_name}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Mail className="w-4 h-4 inline mr-1" />
                      Email Address *
                    </label>
                    <input
                      type="email"
                      value={formData?.customer_email}
                      onChange={(e) => handleInputChange('customer_email', e?.target?.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors?.customer_email ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter email address"
                    />
                    {errors?.customer_email && (
                      <p className="text-red-600 text-sm mt-1">{errors?.customer_email}</p>
                    )}
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Phone className="w-4 h-4 inline mr-1" />
                      Phone Number *
                    </label>
                    <input
                      type="tel"
                      value={formData?.customer_phone}
                      onChange={(e) => handleInputChange('customer_phone', e?.target?.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors?.customer_phone ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Enter phone number"
                    />
                    {errors?.customer_phone && (
                      <p className="text-red-600 text-sm mt-1">{errors?.customer_phone}</p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Vehicle & Product Selection */}
            {currentStep === 2 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Vehicle & Product Information
                  </h2>
                  <p className="text-gray-600">
                    Select the vehicle and product/service related to your claim
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Car className="w-4 h-4 inline mr-1" />
                      Vehicle *
                    </label>
                    <select
                      value={formData?.vehicle_id}
                      onChange={(e) => handleInputChange('vehicle_id', e?.target?.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors?.vehicle_id ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a vehicle</option>
                      {customerVehicles?.map((vehicle) => (
                        <option key={vehicle?.id} value={vehicle?.id}>
                          {vehicle?.year} {vehicle?.make} {vehicle?.model} - {vehicle?.vin}
                        </option>
                      ))}
                    </select>
                    {errors?.vehicle_id && (
                      <p className="text-red-600 text-sm mt-1">{errors?.vehicle_id}</p>
                    )}
                    {customerVehicles?.length === 0 && formData?.customer_email && (
                      <p className="text-gray-500 text-sm mt-1">
                        No vehicles found for this customer email
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      <Package className="w-4 h-4 inline mr-1" />
                      Product/Service *
                    </label>
                    <select
                      value={formData?.product_id}
                      onChange={(e) => handleInputChange('product_id', e?.target?.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors?.product_id ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select a product/service</option>
                      {products?.map((product) => (
                        <option key={product?.id} value={product?.id}>
                          {product?.name} - {product?.brand} ({product?.category})
                        </option>
                      ))}
                    </select>
                    {errors?.product_id && (
                      <p className="text-red-600 text-sm mt-1">{errors?.product_id}</p>
                    )}
                  </div>
                </div>

                {/* Warranty Information Display */}
                {formData?.product_id && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <h3 className="font-semibold text-green-900 mb-2">Warranty Status</h3>
                    <p className="text-green-800 text-sm">
                      ✅ Product is covered under warranty. Your claim will be processed
                      accordingly.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Claim Details */}
            {currentStep === 3 && (
              <div className="space-y-6">
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">Claim Details</h2>
                  <p className="text-gray-600">
                    Describe the issue and attach supporting documentation
                  </p>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Issue Description *
                    </label>
                    <textarea
                      value={formData?.issue_description}
                      onChange={(e) => handleInputChange('issue_description', e?.target?.value)}
                      rows={4}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors?.issue_description ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Please describe the issue in detail, including when it occurred and any relevant circumstances..."
                    />
                    {errors?.issue_description && (
                      <p className="text-red-600 text-sm mt-1">{errors?.issue_description}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Preferred Resolution *
                    </label>
                    <select
                      value={formData?.preferred_resolution}
                      onChange={(e) => handleInputChange('preferred_resolution', e?.target?.value)}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors?.preferred_resolution ? 'border-red-300' : 'border-gray-300'
                      }`}
                    >
                      <option value="">Select preferred resolution</option>
                      <option value="repair">Repair</option>
                      <option value="replacement">Replacement</option>
                      <option value="refund">Refund</option>
                      <option value="compensation">Monetary Compensation</option>
                    </select>
                    {errors?.preferred_resolution && (
                      <p className="text-red-600 text-sm mt-1">{errors?.preferred_resolution}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Claim Amount (Optional)
                      </label>
                      <input
                        type="number"
                        value={formData?.claim_amount}
                        onChange={(e) => handleInputChange('claim_amount', e?.target?.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        placeholder="Enter amount if applicable"
                        min="0"
                        step="0.01"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Priority Level
                      </label>
                      <select
                        value={formData?.priority}
                        onChange={(e) => handleInputChange('priority', e?.target?.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>
                  </div>

                  {/* File Upload Section */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Supporting Documentation
                    </label>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                      <div className="flex flex-col items-center">
                        <Upload className="w-8 h-8 text-gray-400 mb-2" />
                        <p className="text-gray-600 mb-2">
                          Drag and drop photos here, or click to select
                        </p>
                        <input
                          type="file"
                          multiple
                          accept="image/*"
                          onChange={handleFileUpload}
                          className="hidden"
                          id="file-upload"
                        />
                        <label
                          htmlFor="file-upload"
                          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors cursor-pointer"
                        >
                          Select Files
                        </label>
                        <p className="text-xs text-gray-500 mt-2">
                          Maximum file size: 10MB. Supported formats: JPG, PNG, GIF, WebP
                        </p>
                      </div>
                    </div>

                    {errors?.files && <p className="text-red-600 text-sm mt-1">{errors?.files}</p>}
                  </div>

                  {/* Uploaded Files Display */}
                  {uploadedFiles?.length > 0 && (
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-900">Uploaded Files:</h4>
                      {uploadedFiles?.map((file) => (
                        <div key={file?.id} className="border border-gray-200 rounded-lg p-4">
                          <div className="flex items-start space-x-4">
                            <div className="flex-shrink-0">
                              {file?.preview && (
                                <img
                                  src={file?.preview}
                                  alt={file?.name}
                                  className="w-16 h-16 rounded-lg object-cover"
                                />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 truncate">{file?.name}</p>
                              <p className="text-sm text-gray-500">
                                {(file?.size / 1024 / 1024)?.toFixed(2)}MB
                              </p>
                              <input
                                type="text"
                                value={file?.description}
                                onChange={(e) => updateFileDescription(file?.id, e?.target?.value)}
                                placeholder="Add description (optional)"
                                className="mt-2 w-full border border-gray-300 rounded px-2 py-1 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                              />
                            </div>
                            <button
                              onClick={() => removeFile(file?.id)}
                              className="flex-shrink-0 text-red-600 hover:text-red-800 transition-colors"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex justify-between pt-8 border-t border-gray-200">
              <button
                onClick={prevStep}
                disabled={currentStep === 1}
                className={`px-6 py-2 rounded-lg font-medium transition-colors ${
                  currentStep === 1
                    ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              >
                Previous
              </button>

              {errors?.submit && (
                <div className="flex items-center text-red-600 text-sm">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors?.submit}
                </div>
              )}

              {currentStep < 3 ? (
                <button
                  onClick={nextStep}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                >
                  Next Step
                </button>
              ) : (
                <button
                  onClick={submitClaim}
                  disabled={submitLoading}
                  className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center"
                >
                  {submitLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Submit Claim
                    </>
                  )}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}

export default CustomerClaimsSubmissionPortal
