import React, { useState, useEffect } from 'react'
import { claimsService } from '../../services/claimsService'
import FileText from 'lucide-react/dist/esm/icons/file-text.js'
import CheckCircle from 'lucide-react/dist/esm/icons/check-circle.js'
import AlertCircle from 'lucide-react/dist/esm/icons/alert-circle.js'
import User from 'lucide-react/dist/esm/icons/user.js'
import Car from 'lucide-react/dist/esm/icons/car.js'
import Package from 'lucide-react/dist/esm/icons/package.js'
import MessageSquare from 'lucide-react/dist/esm/icons/message-square.js'
import Upload from 'lucide-react/dist/esm/icons/upload.js'
import Camera from 'lucide-react/dist/esm/icons/camera.js'
import Send from 'lucide-react/dist/esm/icons/send.js'
import Printer from 'lucide-react/dist/esm/icons/printer.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import Rocket from 'lucide-react/dist/esm/icons/rocket.js'
// Import centralized schema for validating guest warranty claims
import { guestClaimSchema } from '../../utils/claimSchemas'

// Shared label style — uppercase, tight tracking, xs
const LABEL_CLS =
  'block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wider'

// Input base — clean, consistent ring-on-focus
const INPUT_BASE =
  'w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-slate-50 disabled:text-slate-400'

const inputCls = (hasError) =>
  `${INPUT_BASE} ${hasError ? 'border-red-400 focus:ring-red-500' : 'border-slate-300'}`

// Section header with colored icon pill
const SectionHeader = ({ icon: Icon, color = 'blue', title }) => {
  const colorMap = {
    blue: 'bg-blue-100 text-blue-700',
    slate: 'bg-slate-100 text-slate-700',
    violet: 'bg-violet-100 text-violet-700',
    emerald: 'bg-emerald-100 text-emerald-700',
  }
  return (
    <div className="flex items-center gap-2 mb-5">
      <div
        className={`w-8 h-8 rounded-lg ${colorMap[color]} flex items-center justify-center flex-shrink-0`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <h2 className="text-base font-bold text-slate-900">{title}</h2>
    </div>
  )
}

// Field error message
const FieldError = ({ msg }) =>
  msg ? <p className="mt-1 text-[11px] text-red-600">{msg}</p> : null

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
    setFormData((prev) => ({ ...prev, [field]: value }))

    // Clear error when user starts typing
    if (errors?.[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }))
    }

    // Clear other_product_description when switching away from "other"
    if (field === 'product_selection' && value !== 'other') {
      setFormData((prev) => ({ ...prev, other_product_description: '' }))
    }
  }

  const validateForm = () => {
    const result = guestClaimSchema.safeParse(formData)
    if (!result?.success) {
      const newErrors = {}
      result.error?.issues?.forEach((issue) => {
        const pathKey = issue?.path?.[0]
        if (!newErrors[pathKey]) newErrors[pathKey] = issue?.message
      })
      setErrors(newErrors)
      return false
    }
    setErrors({})
    return true
  }

  const handleFileUpload = async (event) => {
    const files = Array.from(event?.target?.files || [])
    const MAX_FILES = 5

    if (uploadedFiles.length >= MAX_FILES) {
      setErrors((prev) => ({ ...prev, files: `You can upload up to ${MAX_FILES} files.` }))
      if (event?.target) event.target.value = ''
      return
    }

    for (const file of files) {
      if (uploadedFiles.length >= MAX_FILES) {
        setErrors((prev) => ({ ...prev, files: `You can upload up to ${MAX_FILES} files.` }))
        break
      }
      if (file?.size > 10 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, files: 'File size must be less than 10MB' }))
        continue
      }
      if (!file?.type?.startsWith('image/')) {
        setErrors((prev) => ({ ...prev, files: 'Only image files are allowed' }))
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

    if (event?.target) event.target.value = ''
  }

  const removeFile = (fileId) => {
    setUploadedFiles((prev) => {
      const fileToRemove = prev?.find((f) => f?.id === fileId)
      if (fileToRemove?.preview) URL.revokeObjectURL(fileToRemove?.preview)
      return prev?.filter((f) => f?.id !== fileId)
    })
  }

  const submitClaim = async () => {
    if (!validateForm()) {
      const firstErrorField = document?.querySelector('.border-red-400')
      if (firstErrorField) {
        firstErrorField?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    try {
      setSubmitLoading(true)
      setErrors({})

      let productId = null
      if (formData?.product_selection && formData?.product_selection !== 'other') {
        productId = formData?.product_selection
      }

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
      if (!newClaim) throw new Error('Failed to submit claim')

      for (const file of uploadedFiles) {
        try {
          await claimsService?.uploadClaimPhoto(
            newClaim?.id,
            file?.file,
            `Photo uploaded with guest claim by ${formData?.customer_name}`
          )
        } catch (fileError) {
          console.error(`Error uploading file ${file?.name}:`, fileError)
        }
      }

      setSubmittedClaim(newClaim)
      setSubmitted(true)
      window?.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (error) {
      console.error('Error submitting claim:', error)
      setErrors({ submit: error?.message || 'Failed to submit claim. Please try again.' })
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

  // ─── SUCCESS PAGE ────────────────────────────────────────────────────────────
  if (submitted && submittedClaim) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
        {/* Sticky branding bar */}
        <div className="bg-slate-900 text-white py-3 px-4">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <Rocket className="w-4 h-4 text-slate-400 flex-shrink-0" />
            <p className="text-sm font-semibold tracking-wide">
              Priority Lexus &middot; Warranty Claims
            </p>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-16">
          {/* Success icon */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Claim Submitted</h1>
            <p className="text-slate-600">
              Thank you, {submittedClaim?.customer_name}. Your claim has been received.
            </p>
          </div>

          {/* Claim number card */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 my-6 text-center">
            <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 mb-2">
              Your Claim Number
            </p>
            <p className="font-mono text-2xl font-bold text-emerald-900 mb-1">
              {submittedClaim?.claim_number}
            </p>
            <p className="text-xs text-emerald-700">Please save this number for your records</p>
          </div>

          {/* What happens next — Wave XXX-AF: no email-confirmation promise */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6 text-left">
            <h3 className="font-semibold text-blue-900 mb-2 text-sm">What happens next:</h3>
            <ul className="text-blue-800 text-sm space-y-1.5">
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span>
                Please save your claim number above — it is your reference for this request
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span>
                A member of the Priority Lexus team will contact you to follow up
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span>
                Our warranty team will review your claim within 1–2 business days
              </li>
              <li className="flex gap-2">
                <span className="text-blue-400 font-bold">•</span>
                We may reach out if additional information is needed
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={resetForm}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-md transition-colors"
            >
              <Send className="w-4 h-4" />
              Submit Another Claim
            </button>
            <button
              onClick={() => window?.print()}
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-300 text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-50 transition-colors"
            >
              <Printer className="w-4 h-4" />
              Print Confirmation
            </button>
          </div>
        </div>

        {/* Footer */}
        <footer className="text-center py-6 px-4">
          <p className="text-xs text-slate-500">
            Priority Lexus Virginia Beach &middot; 3909 Virginia Beach Blvd &middot; 757-486-3500
          </p>
        </footer>
      </div>
    )
  }

  // ─── FORM PAGE ───────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Sticky branding bar */}
      <div className="bg-slate-900 text-white py-3 px-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <Rocket className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <p className="text-sm font-semibold tracking-wide">
            Priority Lexus &middot; Warranty Claims
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="w-14 h-14 bg-blue-100 text-blue-700 rounded-2xl flex items-center justify-center mx-auto mb-5">
            <FileText className="w-7 h-7" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-3">
            Submit a Warranty Claim
          </h1>
          <p className="text-lg text-slate-600 max-w-xl mx-auto">
            Tell us what happened. A member of our team will contact you to follow up.
          </p>
        </div>

        {/* Submit error banner */}
        {errors?.submit && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-800">{errors?.submit}</p>
            </div>
          </div>
        )}

        <form onSubmit={(e) => e?.preventDefault()} className="space-y-5">
          {/* ── CUSTOMER INFORMATION ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <SectionHeader icon={User} color="blue" title="Customer Information" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className={LABEL_CLS}>
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData?.customer_name}
                  onChange={(e) => handleInputChange('customer_name', e?.target?.value)}
                  className={inputCls(errors?.customer_name)}
                  placeholder="Enter your full name"
                />
                <FieldError msg={errors?.customer_name} />
              </div>

              <div>
                <label className={LABEL_CLS}>
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData?.customer_email}
                  onChange={(e) => handleInputChange('customer_email', e?.target?.value)}
                  className={inputCls(errors?.customer_email)}
                  placeholder="your.email@example.com"
                />
                <FieldError msg={errors?.customer_email} />
              </div>

              <div className="md:col-span-2">
                <label className={LABEL_CLS}>
                  Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  value={formData?.customer_phone}
                  onChange={(e) => handleInputChange('customer_phone', e?.target?.value)}
                  className={inputCls(errors?.customer_phone)}
                  placeholder="(555) 123-4567"
                />
                <FieldError msg={errors?.customer_phone} />
              </div>
            </div>
          </div>

          {/* ── VEHICLE INFORMATION ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <SectionHeader icon={Car} color="slate" title="Vehicle Information" />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div>
                <label className={LABEL_CLS}>
                  Year <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={formData?.vehicle_year}
                  onChange={(e) => handleInputChange('vehicle_year', e?.target?.value)}
                  className={inputCls(errors?.vehicle_year)}
                  placeholder="2020"
                  min="1900"
                  max={new Date()?.getFullYear() + 1}
                />
                <FieldError msg={errors?.vehicle_year} />
              </div>

              <div>
                <label className={LABEL_CLS}>
                  Make <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData?.vehicle_make}
                  onChange={(e) => handleInputChange('vehicle_make', e?.target?.value)}
                  className={inputCls(errors?.vehicle_make)}
                  placeholder="Lexus"
                />
                <FieldError msg={errors?.vehicle_make} />
              </div>

              <div>
                <label className={LABEL_CLS}>
                  Model <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData?.vehicle_model}
                  onChange={(e) => handleInputChange('vehicle_model', e?.target?.value)}
                  className={inputCls(errors?.vehicle_model)}
                  placeholder="RX 350"
                />
                <FieldError msg={errors?.vehicle_model} />
              </div>

              <div className="md:col-span-3">
                <label className={LABEL_CLS}>
                  VIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData?.vehicle_vin}
                  onChange={(e) =>
                    handleInputChange('vehicle_vin', e?.target?.value?.toUpperCase())
                  }
                  className={inputCls(errors?.vehicle_vin)}
                  placeholder="1HGBH41JXMN109186"
                  maxLength="17"
                />
                <FieldError msg={errors?.vehicle_vin} />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  17-character code — found on your dashboard or driver-side door frame
                </p>
              </div>
            </div>
          </div>

          {/* ── PRODUCT INFORMATION ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <SectionHeader icon={Package} color="violet" title="Product Information" />

            <div className="space-y-5">
              <div>
                <label className={LABEL_CLS}>
                  Product / Service <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData?.product_selection}
                  onChange={(e) => handleInputChange('product_selection', e?.target?.value)}
                  disabled={loading}
                  className={inputCls(errors?.product_selection)}
                >
                  <option value="">
                    {loading ? 'Loading products…' : 'Select a product / service'}
                  </option>
                  {!loading && products?.length === 0 && !errors?.products && (
                    <option value="" disabled>
                      No products available — choose "Other" below
                    </option>
                  )}
                  {products?.map((product) => (
                    <option key={product?.id} value={product?.id}>
                      {product?.name} - {product?.brand} ({product?.category})
                    </option>
                  ))}
                  <option value="other">Other (please specify)</option>
                </select>
                <FieldError msg={errors?.products} />
                <FieldError msg={errors?.product_selection} />
              </div>

              {/* Other product description — shows when "other" is selected */}
              {formData?.product_selection === 'other' && (
                <div>
                  <label className={LABEL_CLS}>
                    Describe the product / service <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData?.other_product_description}
                    onChange={(e) =>
                      handleInputChange('other_product_description', e?.target?.value)
                    }
                    rows={3}
                    className={inputCls(errors?.other_product_description)}
                    placeholder="Please provide details about the product or service..."
                  />
                  <FieldError msg={errors?.other_product_description} />
                </div>
              )}

              <div>
                <label className={LABEL_CLS}>Purchase Date (Optional)</label>
                <input
                  type="date"
                  value={formData?.purchase_date}
                  onChange={(e) => handleInputChange('purchase_date', e?.target?.value)}
                  className={inputCls(false)}
                />
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Helps us determine warranty coverage
                </p>
              </div>
            </div>
          </div>

          {/* ── CLAIM DETAILS ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <SectionHeader icon={MessageSquare} color="blue" title="Claim Details" />

            <div className="space-y-5">
              <div>
                <label className={LABEL_CLS}>
                  Issue Description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData?.issue_description}
                  onChange={(e) => handleInputChange('issue_description', e?.target?.value)}
                  rows={4}
                  className={inputCls(errors?.issue_description)}
                  placeholder="Please describe the issue in detail, including when it occurred and any relevant circumstances..."
                />
                <FieldError msg={errors?.issue_description} />
              </div>

              <div>
                <label className={LABEL_CLS}>
                  Preferred Resolution <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData?.preferred_resolution}
                  onChange={(e) => handleInputChange('preferred_resolution', e?.target?.value)}
                  className={inputCls(errors?.preferred_resolution)}
                >
                  <option value="">(Select one)</option>
                  <option value="Repair">Repair</option>
                  <option value="Replace">Replace</option>
                  <option value="Refund">Refund / Reimbursement</option>
                  <option value="Not sure">Not sure — please advise</option>
                </select>
                <FieldError msg={errors?.preferred_resolution} />
              </div>

              <div>
                <label className={LABEL_CLS}>Comments (Optional)</label>
                <textarea
                  value={formData?.comments}
                  onChange={(e) => handleInputChange('comments', e?.target?.value)}
                  rows={3}
                  className={inputCls(false)}
                  placeholder="Any additional information or special requests..."
                />
              </div>
            </div>
          </div>

          {/* ── PHOTOS & IMAGES ── */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 sm:p-8">
            <SectionHeader icon={Camera} color="emerald" title="Photos & Images (Optional)" />

            {/* Drop zone */}
            <label
              htmlFor="file-upload"
              className="flex flex-col items-center gap-3 border-2 border-dashed border-slate-300 rounded-xl p-8 text-center hover:border-blue-400 hover:bg-blue-50/50 transition-colors cursor-pointer"
            >
              <Upload className="w-8 h-8 text-slate-400" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Drag photos here, or click to browse
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  Up to 5 photos · JPG, PNG, WebP · 10 MB each
                </p>
              </div>
              <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
              />
            </label>

            <FieldError msg={errors?.files} />

            {/* Uploaded files list */}
            {uploadedFiles?.length > 0 && (
              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Uploaded ({uploadedFiles.length} / 5)
                </p>
                {uploadedFiles?.map((file) => (
                  <div
                    key={file?.id}
                    className="flex items-center gap-3 border border-slate-200 rounded-lg p-3"
                  >
                    {file?.preview && (
                      <img
                        src={file?.preview}
                        alt={file?.name}
                        className="w-10 h-10 rounded object-cover flex-shrink-0"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{file?.name}</p>
                      <p className="text-xs text-slate-500">
                        {(file?.size / 1024 / 1024)?.toFixed(2)} MB
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(file?.id)}
                      className="flex-shrink-0 text-slate-400 hover:text-red-600 transition-colors"
                      type="button"
                      aria-label="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── SUBMIT ── */}
          <div className="pt-2 pb-4">
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={submitClaim}
                disabled={submitLoading || loading}
                type="button"
                className="w-full sm:w-auto px-6 py-3 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold rounded-md transition-colors disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {submitLoading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                    Submitting...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Submit Claim
                  </>
                )}
              </button>

              <button
                onClick={resetForm}
                type="button"
                disabled={submitLoading}
                className="w-full sm:w-auto px-6 py-3 border border-slate-300 text-slate-700 text-sm font-semibold rounded-md hover:bg-slate-50 transition-colors disabled:opacity-60 inline-flex items-center justify-center gap-2"
              >
                Reset Form
              </button>
            </div>

            <p className="text-center text-xs text-slate-500 mt-4">
              By submitting this form, you agree to our warranty terms and conditions.
            </p>
          </div>
        </form>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 px-4 border-t border-slate-100">
        <p className="text-xs text-slate-500">
          Priority Lexus Virginia Beach &middot; 3909 Virginia Beach Blvd &middot; 757-486-3500
        </p>
      </footer>
    </div>
  )
}

export default GuestClaimsSubmissionForm
