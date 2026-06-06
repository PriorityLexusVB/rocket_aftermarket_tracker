// Wave XXX-AG: NewClaimModal — internal "+ New Claim" form for staff use.
// Reuses the guest claim schema + claimsService.createClaim, but skips the
// CAPTCHA / customer-facing chrome since this is behind ProtectedRoute.
import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js'
import Plus from 'lucide-react/dist/esm/icons/plus.js'
import X from 'lucide-react/dist/esm/icons/x.js'
import { guestClaimSchema } from '@/utils/claimSchemas'
import { claimsService } from '@/services/claimsService'
import { useToast } from '@/components/ui/ToastProvider'
// Wave XXX-AG hotfix-1 (Codex BLOCKER J+D): staff-created claims must set
// submitted_by so the live claims_set_dealer_id trigger can infer dealer_id
// when product_id is null (the "Other" path). Without this, "Other" claims
// fail with cryptic "claims.dealer_id is required" trigger error.
import { useAuth } from '@/contexts/AuthContext'

const EMPTY_FORM = {
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
}

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]

export default function NewClaimModal({ isOpen, onClose, onCreated }) {
  const toast = useToast()
  const { user } = useAuth() || {}
  const [formData, setFormData] = useState(EMPTY_FORM)
  const [products, setProducts] = useState([])
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [serverError, setServerError] = useState('')

  // Load products list when modal opens
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const data = await claimsService?.getProducts?.()
        if (!cancelled && Array.isArray(data)) setProducts(data)
      } catch {
        /* products are optional; show "Other" fallback */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [isOpen])

  // Reset form when modal closes
  useEffect(() => {
    if (!isOpen) {
      setFormData(EMPTY_FORM)
      setErrors({})
      setServerError('')
      setSubmitting(false)
    }
  }, [isOpen])

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    // Clear field error as user types
    if (errors[field]) {
      setErrors((prev) => {
        const next = { ...prev }
        delete next[field]
        return next
      })
    }
    // Clear "other_product_description" when picking a real product
    if (field === 'product_selection' && value !== 'other') {
      setFormData((prev) => ({ ...prev, other_product_description: '' }))
    }
  }

  const handleSubmit = async (e) => {
    e?.preventDefault()
    if (submitting) return

    const result = guestClaimSchema.safeParse(formData)
    if (!result.success) {
      const fieldErrors = {}
      result.error?.errors?.forEach((err) => {
        const path = err?.path?.[0]
        if (path) fieldErrors[path] = err?.message
      })
      setErrors(fieldErrors)
      setServerError('Please fix the highlighted fields.')
      return
    }

    setSubmitting(true)
    setServerError('')
    setErrors({})

    try {
      const vehicleInfoBlock = [
        `Vehicle: ${formData.vehicle_year} ${formData.vehicle_make} ${formData.vehicle_model}`,
        `VIN: ${formData.vehicle_vin}`,
      ].join('\n')

      const claimData = {
        customer_name: formData.customer_name.trim(),
        customer_email: formData.customer_email.trim(),
        customer_phone: formData.customer_phone.trim(),
        // Wave XXX-AG hotfix-1 (Codex BLOCKER J+D): set submitted_by so the
        // live dealer_id trigger can infer tenant even when product_id is
        // null (Other path). Also provides a clean audit trail.
        submitted_by: user?.id || null,
        product_id:
          formData.product_selection && formData.product_selection !== 'other'
            ? formData.product_selection
            : null,
        issue_description:
          formData.issue_description.trim() +
          `\n\n${vehicleInfoBlock}` +
          (formData.product_selection === 'other'
            ? `\n\nProduct: ${formData.other_product_description.trim()}`
            : '') +
          (formData.purchase_date
            ? `\n\nPurchase Date: ${formData.purchase_date}`
            : '') +
          (formData.comments
            ? `\n\nAdditional Comments: ${formData.comments.trim()}`
            : ''),
        preferred_resolution: formData.preferred_resolution.trim(),
        priority: formData.priority || 'medium',
        status: 'submitted',
      }

      const newClaim = await claimsService?.createClaim?.(claimData)
      if (!newClaim) throw new Error('Could not create claim — please try again.')

      toast?.success?.(`Claim ${newClaim?.claim_number || ''} created.`)
      onCreated?.(newClaim)
      onClose?.()
    } catch (err) {
      const msg = err?.message || 'Could not create claim.'
      setServerError(msg)
      toast?.error?.(msg)
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  const fieldClass = (field) =>
    `w-full rounded-md border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
      errors[field]
        ? 'border-red-400 focus:ring-red-500'
        : 'border-slate-300 focus:border-blue-500'
    }`

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="newclaim-backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-[70] bg-black/40 flex items-end sm:items-center justify-center"
        onClick={(e) => e.target === e.currentTarget && !submitting && onClose?.()}
      >
        <motion.div
          key="newclaim-panel"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 24, opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="bg-white w-full sm:max-w-2xl sm:rounded-xl rounded-t-xl shadow-2xl max-h-[92vh] flex flex-col"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                <Plus className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-semibold text-slate-900">New Claim</h2>
                <p className="text-xs text-slate-500">File a warranty claim on a customer's behalf.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => !submitting && onClose?.()}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-5 sm:px-6 py-5 space-y-5">
            {serverError && (
              <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
                {serverError}
              </div>
            )}

            {/* Customer block */}
            <fieldset className="space-y-3">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Customer
              </legend>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Customer name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => handleChange('customer_name', e.target.value)}
                    className={fieldClass('customer_name')}
                    disabled={submitting}
                  />
                  {errors.customer_name && (
                    <p className="mt-1 text-[11px] text-red-600">{errors.customer_name}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Phone <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    value={formData.customer_phone}
                    onChange={(e) => handleChange('customer_phone', e.target.value)}
                    className={fieldClass('customer_phone')}
                    disabled={submitting}
                  />
                  {errors.customer_phone && (
                    <p className="mt-1 text-[11px] text-red-600">{errors.customer_phone}</p>
                  )}
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.customer_email}
                    onChange={(e) => handleChange('customer_email', e.target.value)}
                    className={fieldClass('customer_email')}
                    disabled={submitting}
                  />
                  {errors.customer_email && (
                    <p className="mt-1 text-[11px] text-red-600">{errors.customer_email}</p>
                  )}
                </div>
              </div>
            </fieldset>

            {/* Vehicle block */}
            <fieldset className="space-y-3">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                Vehicle
              </legend>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={4}
                    value={formData.vehicle_year}
                    onChange={(e) => handleChange('vehicle_year', e.target.value)}
                    className={fieldClass('vehicle_year')}
                    disabled={submitting}
                  />
                  {errors.vehicle_year && (
                    <p className="mt-1 text-[11px] text-red-600">{errors.vehicle_year}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Make <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.vehicle_make}
                    onChange={(e) => handleChange('vehicle_make', e.target.value)}
                    className={fieldClass('vehicle_make')}
                    disabled={submitting}
                  />
                  {errors.vehicle_make && (
                    <p className="mt-1 text-[11px] text-red-600">{errors.vehicle_make}</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Model <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.vehicle_model}
                    onChange={(e) => handleChange('vehicle_model', e.target.value)}
                    className={fieldClass('vehicle_model')}
                    disabled={submitting}
                  />
                  {errors.vehicle_model && (
                    <p className="mt-1 text-[11px] text-red-600">{errors.vehicle_model}</p>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  VIN <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.vehicle_vin}
                  onChange={(e) => handleChange('vehicle_vin', e.target.value.toUpperCase())}
                  className={`${fieldClass('vehicle_vin')} font-mono uppercase`}
                  disabled={submitting}
                  maxLength={17}
                />
                {errors.vehicle_vin && (
                  <p className="mt-1 text-[11px] text-red-600">{errors.vehicle_vin}</p>
                )}
              </div>
            </fieldset>

            {/* Product + claim detail block */}
            <fieldset className="space-y-3">
              <legend className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                The Claim
              </legend>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Product <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.product_selection}
                  onChange={(e) => handleChange('product_selection', e.target.value)}
                  className={fieldClass('product_selection')}
                  disabled={submitting}
                >
                  <option value="">Choose a product…</option>
                  {products.map((p) => (
                    <option key={p?.id} value={p?.id}>
                      {p?.name}
                      {p?.brand ? ` — ${p.brand}` : ''}
                    </option>
                  ))}
                  <option value="other">Other (specify below)</option>
                </select>
                {errors.product_selection && (
                  <p className="mt-1 text-[11px] text-red-600">{errors.product_selection}</p>
                )}
              </div>

              {formData.product_selection === 'other' && (
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Describe the product <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.other_product_description}
                    onChange={(e) =>
                      handleChange('other_product_description', e.target.value)
                    }
                    className={fieldClass('other_product_description')}
                    disabled={submitting}
                  />
                  {errors.other_product_description && (
                    <p className="mt-1 text-[11px] text-red-600">
                      {errors.other_product_description}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Purchase date
                  </label>
                  <input
                    type="date"
                    value={formData.purchase_date}
                    onChange={(e) => handleChange('purchase_date', e.target.value)}
                    className={fieldClass('purchase_date')}
                    disabled={submitting}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Priority
                  </label>
                  <select
                    value={formData.priority}
                    onChange={(e) => handleChange('priority', e.target.value)}
                    className={fieldClass('priority')}
                    disabled={submitting}
                  >
                    {PRIORITY_OPTIONS.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Issue description <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.issue_description}
                  onChange={(e) => handleChange('issue_description', e.target.value)}
                  className={`${fieldClass('issue_description')} resize-none`}
                  rows={3}
                  disabled={submitting}
                  placeholder="What happened? When did it start?"
                />
                {errors.issue_description && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {errors.issue_description}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Customer's preferred resolution <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.preferred_resolution}
                  onChange={(e) => handleChange('preferred_resolution', e.target.value)}
                  className={`${fieldClass('preferred_resolution')} resize-none`}
                  rows={2}
                  disabled={submitting}
                  placeholder="What does the customer want — repair, refund, replacement?"
                />
                {errors.preferred_resolution && (
                  <p className="mt-1 text-[11px] text-red-600">
                    {errors.preferred_resolution}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Internal notes <span className="text-slate-400">(optional)</span>
                </label>
                <textarea
                  value={formData.comments}
                  onChange={(e) => handleChange('comments', e.target.value)}
                  className={`${fieldClass('comments')} resize-none`}
                  rows={2}
                  disabled={submitting}
                  placeholder="Anything else the warranty team should know."
                />
              </div>
            </fieldset>
          </form>

          {/* Footer actions */}
          <div className="px-5 sm:px-6 py-3 border-t border-slate-200 flex items-center justify-end gap-2 bg-slate-50 sm:rounded-b-2xl">
            <button
              type="button"
              onClick={() => !submitting && onClose?.()}
              className="px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 rounded-md disabled:opacity-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Creating…
                </>
              ) : (
                <>
                  <Plus className="w-3.5 h-3.5" />
                  Create Claim
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
