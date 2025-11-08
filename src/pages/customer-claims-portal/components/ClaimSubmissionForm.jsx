import React, { useState } from 'react'
import { Upload, X, AlertCircle, File } from 'lucide-react'
import { claimsService } from '../../../services/claimsService'

const ClaimSubmissionForm = ({ vehicles, products, onSubmit, onCancel }) => {
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

  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const handleInputChange = (e) => {
    const { name, value } = e?.target
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }))
  }

  const handleFileChange = (e) => {
    const selectedFiles = Array.from(e?.target?.files || [])
    const validFiles = selectedFiles?.filter((file) => {
      const isValidType = [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/jpg',
        'application/pdf',
      ]?.includes(file?.type)
      const isValidSize = file?.size <= 10 * 1024 * 1024 // 10MB
      return isValidType && isValidSize
    })

    setFiles((prev) => [...prev, ...validFiles]?.slice(0, 5)) // Max 5 files
  }

  const removeFile = (index) => {
    setFiles((prev) => prev?.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      // Validate required fields
      if (!formData?.customer_name || !formData?.customer_email || !formData?.issue_description) {
        throw new Error('Please fill in all required fields')
      }

      if (!formData?.vehicle_id && !formData?.product_id) {
        throw new Error('Please select either a vehicle or product for the claim')
      }

      // Submit the claim
      const claimResult = await onSubmit(formData)

      // Upload files if any
      if (files?.length > 0 && claimResult?.id) {
        await Promise.all(
          files?.map((file, index) =>
            claimsService?.uploadClaimPhoto(
              claimResult?.id,
              file,
              `Damage documentation ${index + 1}`
            )
          )
        )
      }

      // Reset form
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
      setFiles([])
    } catch (err) {
      setError(err?.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Submit New Claim</h2>
        <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
          <X className="w-6 h-6" />
        </button>
      </div>
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <p className="text-red-700">{error}</p>
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Customer Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Full Name *</label>
            <input
              type="text"
              name="customer_name"
              value={formData?.customer_name}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your full name"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Email Address *</label>
            <input
              type="email"
              name="customer_email"
              value={formData?.customer_email}
              onChange={handleInputChange}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="your.email@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
            <input
              type="tel"
              name="customer_phone"
              value={formData?.customer_phone}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
            <select
              name="priority"
              value={formData?.priority}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
        </div>

        {/* Vehicle and Product Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Vehicle</label>
            <select
              name="vehicle_id"
              value={formData?.vehicle_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a vehicle</option>
              {vehicles?.map((vehicle) => (
                <option key={vehicle?.id} value={vehicle?.id}>
                  {vehicle?.year} {vehicle?.make} {vehicle?.model} ({vehicle?.vin?.slice(-6)})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Product/Service</label>
            <select
              name="product_id"
              value={formData?.product_id}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Select a product</option>
              {products?.map((product) => (
                <option key={product?.id} value={product?.id}>
                  {product?.name} - {product?.brand} (${product?.unit_price})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Issue Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Issue Description *
          </label>
          <textarea
            name="issue_description"
            value={formData?.issue_description}
            onChange={handleInputChange}
            required
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Describe the issue you're experiencing in detail..."
          />
        </div>

        {/* Preferred Resolution */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Preferred Resolution
          </label>
          <textarea
            name="preferred_resolution"
            value={formData?.preferred_resolution}
            onChange={handleInputChange}
            rows={2}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="What would you like us to do to resolve this issue?"
          />
        </div>

        {/* Claim Amount */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Estimated Claim Amount
          </label>
          <input
            type="number"
            name="claim_amount"
            value={formData?.claim_amount}
            onChange={handleInputChange}
            min="0"
            step="0.01"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="0.00"
          />
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Photo Documentation
          </label>
          <p className="text-xs text-gray-500 mb-3">
            Upload photos showing the issue (Max 5 files, 10MB each, JPG/PNG/PDF)
          </p>

          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 transition-colors">
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label htmlFor="file-upload" className="cursor-pointer">
              <File className="w-8 h-8 text-gray-400 mx-auto mb-2" />
              <p className="text-sm text-gray-600">Click to upload files or drag and drop</p>
            </label>
          </div>

          {files?.length > 0 && (
            <div className="mt-4 space-y-2">
              {files?.map((file, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                >
                  <span className="text-sm text-gray-700 truncate">
                    {file?.name} ({(file?.size / 1024 / 1024)?.toFixed(2)} MB)
                  </span>
                  <button
                    type="button"
                    onClick={() => removeFile(index)}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-between pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
          >
            {submitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                Submitting...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Submit Claim
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}

export default ClaimSubmissionForm
