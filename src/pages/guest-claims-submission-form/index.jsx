import React, { useState, useEffect } from 'react'
import { claimsService } from '../../services/claimsService'
import {
  FileText,
  CheckCircle,
  AlertCircle,
  User,
  Calendar,
  Package,
  MessageSquare,
  Upload,
  X,
} from 'lucide-react'

// Import centralized schema for validating guest warranty claims
import { guestClaimSchema } from '../../utils/claimSchemas'

const GuestClaimsSubmissionForm = () => {
  // Form state
  const [formData, setFormData] = useState({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    vehicle_year: '',
    vehicle_make: '',
    vehicle_model: '',
    vehicle_vin: '',
    product_selection: '',
    other_product_description: '',
    purchase_date: '',
    issue_description: '',
    preferred_resolution: '',
    comments: '',
    priority: 'medium',
  })

  // UI state
  const [loading, setLoading] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [errors, setErrors] = useState({})
  const [submitted, setSubmitted] = useState(false)
  const [submittedClaim, setSubmittedClaim] = useState(null)

  // Data state
  const [products, setProducts] = useState([])
  const [uploadedFiles, setUploadedFiles] = useState([])

  // Load products on component mount
  useEffect(() => {
    loadProducts()
  }, [])

  const loadProducts = async () => {
    try {
      setLoading(true)
      const productsData = await claimsService?.getProducts()
      setProducts(productsData || [])
    } catch (error) {
      console.error('Error loading products:', error)
      setErrors({ products: 'Failed to load product options' })
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

    // Clear other_product_description when switching away from "other"
    if (field === 'product_selection' && value !== 'other') {
      setFormData((prev) => ({
        ...prev,
        other_product_description: '',
      }))
    }
  }

  const validateForm = () => {
    // Validate form data using centralized Zod schema
    const result = guestClaimSchema.safeParse(formData)

    if (!result?.success) {
      const newErrors = {}
      result.error?.issues?.forEach((issue) => {
        // The path array contains the key of the field that failed.
        const pathKey = issue?.path?.[0]
        newErrors[pathKey] = issue?.message
      })
      setErrors(newErrors)
      return false
    }

    // Clear any previous errors if validation passes
    setErrors({})
    return true
  }

  const handleFileUpload = async (event) => {
    const files = Array.from(event?.target?.files || [])

    const MAX_FILES = 5
    if (uploadedFiles.length >= MAX_FILES) {
      setErrors((prev) => ({
        ...prev,
        files: `You can upload up to ${MAX_FILES} files.`,
      }))
      if (event?.target) event.target.value = ''
      return
    }

    for (const file of files) {
      if (uploadedFiles.length >= MAX_FILES) {
        setErrors((prev) => ({
          ...prev,
          files: `You can upload up to ${MAX_FILES} files.`,
        }))
        break
      }

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

      const fileId = `${Date.now()}-${Math.random().toString(16).slice(2)}-${file?.name}`
      setUploadedFiles((prev) => [
        ...prev,
        {
          id: fileId,
          file,
          name: file?.name,
          size: file?.size,
          type: file?.type,
          preview: URL.createObjectURL(file),
        },
      ])
    }

    // Clear file input
    if (event?.target) {
      event.target.value = ''
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

  const submitClaim = async () => {
    if (!validateForm()) {
      // Scroll to first error
      const firstErrorField = document?.querySelector('.border-red-300')
      if (firstErrorField) {
        firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    try {
      setSubmitLoading(true)
      setErrors({})

      // Get product ID if a specific product was selected
      let productId = null
      if (formData?.product_selection && formData?.product_selection !== 'other') {
        productId = formData?.product_selection
      }

      // Create the claim data
      const vehicleInfoBlock = [
        `Vehicle: ${formData?.vehicle_year} ${formData?.vehicle_make} ${formData?.vehicle_model}`,
        `VIN: ${formData?.vehicle_vin}`,
      ].join('\n')

      const claimData = {
        customer_name: formData?.customer_name?.trim(),
        customer_email: formData?.customer_email?.trim(),
        customer_phone: formData?.customer_phone?.trim(),
        product_id: productId,
        issue_description:
          formData?.issue_description?.trim() +
          `\n\n${vehicleInfoBlock}` +
          (formData?.product_selection === 'other'
            ? `\n\nProduct: ${formData?.other_product_description?.trim()}`
            : '') +
          (formData?.purchase_date ? `\n\nPurchase Date: ${formData?.purchase_date}` : '') +
          (formData?.comments ? `\n\nAdditional Comments: ${formData?.comments?.trim()}` : ''),
        preferred_resolution: formData?.preferred_resolution?.trim(),
        priority: formData?.priority || 'medium',
        status: 'submitted',
      }

      const newClaim = await claimsService?.createClaim(claimData)

      if (!newClaim) {
        throw new Error('Failed to submit claim')
      }

      // Upload files if any
      for (const file of uploadedFiles) {
        try {
          await claimsService?.uploadClaimPhoto(
            newClaim?.id,
            file?.file,
            `Photo uploaded with guest claim by ${formData?.customer_name}`
          )
        } catch (fileError) {
          console.error(`Error uploading file ${file?.name}:`, fileError)
          // Continue with other files even if one fails
        }
      }

      setSubmittedClaim(newClaim)
      setSubmitted(true)

      // Scroll to top to show success message
      window?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Error submitting claim:', error)
      setErrors({
        submit: error?.message || 'Failed to submit claim. Please try again.',
      })

      // Scroll to error
      window?.scrollTo({ top: 0, behavior: 'smooth' })
    } finally {
      setSubmitLoading(false)
    }
  }

  const resetForm = () => {
    for (const f of uploadedFiles) {
      if (f?.preview) URL.revokeObjectURL(f.preview)
    }
    setFormData({
      customer_name: '',
      customer_email: '',
      customer_phone: '',
      vehicle_year: '',
      vehicle_make: '',
      vehicle_model: '',
      vehicle_vin: '',
      product_selection: '',
      other_product_description: '',
      purchase_date: '',
      issue_description: '',
      preferred_resolution: '',
      comments: '',
      priority: 'medium',
    })
    setSubmitted(false)
    setSubmittedClaim(null)
    setUploadedFiles([])
    setErrors({})
  }

  // Success page
  if (submitted && submittedClaim) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>

            <h1 className="text-2xl font-bold text-gray-900 mb-4">Claim Submitted Successfully!</h1>

            <div className="bg-gray-50 rounded-lg p-6 mb-6">
              <p className="text-lg font-semibold text-gray-900 mb-2">
                Claim Number: {submittedClaim?.claim_number}
              </p>
              <p className="text-gray-600 mb-4">
                Thank you for submitting your warranty claim. We have received your request and it
                is now under review.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-700">Customer:</span>
                  <p className="text-gray-900">{submittedClaim?.customer_name}</p>
                </div>
                <div>
                  <span className="font-medium text-gray-700">Status:</span>
                  <span className="inline-block px-2 py-1 rounded-full text-xs font-medium ml-2 bg-yellow-100 text-yellow-800">
                    Submitted
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
              <h3 className="font-semibold text-blue-900 mb-2">What happens next:</h3>
              <ul className="text-blue-800 text-sm space-y-1">
                <li>• You will receive an email confirmation shortly</li>
                <li>• Our warranty team will review your claim within 1-2 business days</li>
                <li>• We may contact you if additional information is needed</li>
                <li>• You will be notified of our decision via email</li>
                <li>• Keep your claim number for future reference</li>
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
                onClick={() => window?.print()}
                className="border border-gray-300 text-gray-700 px-6 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Print Confirmation
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Guest Claims Submission Form</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            Submit your warranty or service claim quickly and easily. Please fill out all required
            fields to ensure prompt processing of your request.
          </p>
        </div>

        {/* Error Alert */}
        {errors?.submit && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
              <p className="text-red-800">{errors?.submit}</p>
            </div>
          </div>
        )}

        {/* Main Form */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={(e) => e?.preventDefault()} className="space-y-8">
            {/* Customer Information Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <User className="w-5 h-5 mr-2" />
                Customer Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={formData?.customer_name}
                    onChange={(e) => handleInputChange('customer_name', e?.target?.value)}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.customer_name ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Enter your full name"
                  />
                  {errors?.customer_name && (
                    <p className="text-red-600 text-sm mt-1">{errors?.customer_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData?.customer_email}
                    onChange={(e) => handleInputChange('customer_email', e?.target?.value)}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.customer_email ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="your.email@example.com"
                  />
                  {errors?.customer_email && (
                    <p className="text-red-600 text-sm mt-1">{errors?.customer_email}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={formData?.customer_phone}
                    onChange={(e) => handleInputChange('customer_phone', e?.target?.value)}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.customer_phone ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="(555) 123-4567"
                  />
                  {errors?.customer_phone && (
                    <p className="text-red-600 text-sm mt-1">{errors?.customer_phone}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Vehicle Information Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Calendar className="w-5 h-5 mr-2" />
                Vehicle Information
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Year *</label>
                  <input
                    type="number"
                    value={formData?.vehicle_year}
                    onChange={(e) => handleInputChange('vehicle_year', e?.target?.value)}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.vehicle_year ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="2020"
                    min="1900"
                    max={new Date()?.getFullYear() + 1}
                  />
                  {errors?.vehicle_year && (
                    <p className="text-red-600 text-sm mt-1">{errors?.vehicle_year}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Make *</label>
                  <input
                    type="text"
                    value={formData?.vehicle_make}
                    onChange={(e) => handleInputChange('vehicle_make', e?.target?.value)}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.vehicle_make ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Honda"
                  />
                  {errors?.vehicle_make && (
                    <p className="text-red-600 text-sm mt-1">{errors?.vehicle_make}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Model *</label>
                  <input
                    type="text"
                    value={formData?.vehicle_model}
                    onChange={(e) => handleInputChange('vehicle_model', e?.target?.value)}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.vehicle_model ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Accord"
                  />
                  {errors?.vehicle_model && (
                    <p className="text-red-600 text-sm mt-1">{errors?.vehicle_model}</p>
                  )}
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    VIN (Vehicle Identification Number) *
                  </label>
                  <input
                    type="text"
                    value={formData?.vehicle_vin}
                    onChange={(e) =>
                      handleInputChange('vehicle_vin', e?.target?.value?.toUpperCase())
                    }
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.vehicle_vin ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="1HGBH41JXMN109186"
                    maxLength="17"
                  />
                  {errors?.vehicle_vin && (
                    <p className="text-red-600 text-sm mt-1">{errors?.vehicle_vin}</p>
                  )}
                  <p className="text-gray-500 text-sm mt-1">
                    17-character code usually found on your dashboard or driver's side door frame
                  </p>
                </div>
              </div>
            </div>

            {/* Product Selection Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Package className="w-5 h-5 mr-2" />
                Product Information
              </h2>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Product/Service *
                  </label>
                  <select
                    value={formData?.product_selection}
                    onChange={(e) => handleInputChange('product_selection', e?.target?.value)}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.product_selection ? 'border-red-300' : 'border-gray-300'
                    }`}
                  >
                    <option value="">Select a product/service</option>
                    {products?.map((product) => (
                      <option key={product?.id} value={product?.id}>
                        {product?.name} - {product?.brand} ({product?.category})
                      </option>
                    ))}
                    <option value="other">Other (please specify)</option>
                  </select>
                  {errors?.product_selection && (
                    <p className="text-red-600 text-sm mt-1">{errors?.product_selection}</p>
                  )}
                </div>

                {/* Other Product Description - shows when "other" is selected */}
                {formData?.product_selection === 'other' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Please describe the product/service *
                    </label>
                    <textarea
                      value={formData?.other_product_description}
                      onChange={(e) =>
                        handleInputChange('other_product_description', e?.target?.value)
                      }
                      rows={3}
                      className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                        errors?.other_product_description ? 'border-red-300' : 'border-gray-300'
                      }`}
                      placeholder="Please provide details about the product or service..."
                    />
                    {errors?.other_product_description && (
                      <p className="text-red-600 text-sm mt-1">
                        {errors?.other_product_description}
                      </p>
                    )}
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Purchase Date (Optional)
                  </label>
                  <input
                    type="date"
                    value={formData?.purchase_date}
                    onChange={(e) => handleInputChange('purchase_date', e?.target?.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <p className="text-gray-500 text-sm mt-1">Helps us determine warranty coverage</p>
                </div>
              </div>
            </div>

            {/* Claim Details Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2" />
                Claim Details
              </h2>

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
                  <textarea
                    value={formData?.preferred_resolution}
                    onChange={(e) => handleInputChange('preferred_resolution', e?.target?.value)}
                    rows={3}
                    className={`w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                      errors?.preferred_resolution ? 'border-red-300' : 'border-gray-300'
                    }`}
                    placeholder="Please describe how you would like this issue to be resolved..."
                  />
                  {errors?.preferred_resolution && (
                    <p className="text-red-600 text-sm mt-1">{errors?.preferred_resolution}</p>
                  )}
                  <p className="text-gray-500 text-sm mt-1">
                    Please provide details about your desired outcome for this claim
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Comments (Optional)
                  </label>
                  <textarea
                    value={formData?.comments}
                    onChange={(e) => handleInputChange('comments', e?.target?.value)}
                    rows={3}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Any additional information or special requests..."
                  />
                </div>
              </div>
            </div>

            {/* File Upload Section */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <Upload className="w-5 h-5 mr-2" />
                Supporting Documentation (Optional)
              </h2>

              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                <div className="flex flex-col items-center">
                  <Upload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-gray-600 mb-2">Upload photos to support your claim</p>
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
                    Choose Files
                  </label>
                  <p className="text-xs text-gray-500 mt-2">
                    Maximum file size: 10MB per file. Supported formats: JPG, PNG, GIF, WebP (max 5
                    files)
                  </p>
                </div>
              </div>

              {errors?.files && <p className="text-red-600 text-sm mt-2">{errors?.files}</p>}

              {/* Uploaded Files Display */}
              {uploadedFiles?.length > 0 && (
                <div className="mt-4 space-y-3">
                  <h4 className="font-medium text-gray-900">Uploaded Files:</h4>
                  {uploadedFiles?.map((file) => (
                    <div key={file?.id} className="border border-gray-200 rounded-lg p-3">
                      <div className="flex items-center space-x-3">
                        {file?.preview && (
                          <img
                            src={file?.preview}
                            alt={file?.name}
                            className="w-12 h-12 rounded object-cover flex-shrink-0"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">{file?.name}</p>
                          <p className="text-sm text-gray-500">
                            {(file?.size / 1024 / 1024)?.toFixed(2)}MB
                          </p>
                        </div>
                        <button
                          onClick={() => removeFile(file?.id)}
                          className="flex-shrink-0 text-red-600 hover:text-red-800 transition-colors"
                          type="button"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Submit Button */}
            <div className="border-t border-gray-200 pt-8">
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={submitClaim}
                  disabled={submitLoading || loading}
                  type="button"
                  className="bg-blue-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                >
                  {submitLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Submitting Claim...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Submit Claim
                    </>
                  )}
                </button>

                <button
                  onClick={resetForm}
                  type="button"
                  disabled={submitLoading}
                  className="border border-gray-300 text-gray-700 px-8 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Reset Form
                </button>
              </div>

              <p className="text-center text-sm text-gray-500 mt-4">
                By submitting this form, you agree to our warranty terms and conditions.
              </p>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

export default GuestClaimsSubmissionForm
