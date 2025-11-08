import React, { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'
import Checkbox from '../../../components/ui/Checkbox'

const AddVehicleModal = ({ isOpen, onClose, onSubmit }) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [vendors, setVendors] = useState([])
  const [products, setProducts] = useState([])
  const [selectedProducts, setSelectedProducts] = useState([])
  const [loadingVendors, setLoadingVendors] = useState(true)
  const [loadingProducts, setLoadingProducts] = useState(true)

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm({
    mode: 'onChange',
    defaultValues: {
      make: '',
      model: '',
      year: new Date()?.getFullYear(),
      stock_number: '',
      vin: '',
      color: '',
      mileage: '',
      license_plate: '',
      owner_name: '',
      owner_email: '',
      owner_phone: '',
      notes: '',
      vehicle_status: 'active',
      needs_loaner: false,
      primary_vendor_id: '',
    },
  })

  // Watch year and make for stock number generation
  const watchedYear = watch('year')
  const watchedMake = watch('make')
  const watchedNeedsLoaner = watch('needs_loaner')

  // Load vendors and products on mount
  useEffect(() => {
    const loadVendorsAndProducts = async () => {
      try {
        // Mock vendors data (replace with actual API call)
        const mockVendors = [
          { id: '1', name: 'Premium Auto Parts', specialty: 'Engine Components' },
          { id: '2', name: 'Elite Motors', specialty: 'Body Work' },
          { id: '3', name: 'Speed Tech', specialty: 'Performance Upgrades' },
        ]

        // Mock products data (replace with actual API call)
        const mockProducts = [
          { id: '1', name: 'Brake Pads Set', category: 'Braking System', unit_price: 89.99 },
          { id: '2', name: 'Air Filter', category: 'Engine', unit_price: 24.99 },
          { id: '3', name: 'LED Headlights', category: 'Lighting', unit_price: 159.99 },
          { id: '4', name: 'Performance Exhaust', category: 'Exhaust System', unit_price: 299.99 },
          { id: '5', name: 'Ceramic Coating', category: 'Protection', unit_price: 199.99 },
        ]

        setVendors(mockVendors)
        setProducts(mockProducts)
        setLoadingVendors(false)
        setLoadingProducts(false)
      } catch (error) {
        console.error('Error loading vendors and products:', error)
        setLoadingVendors(false)
        setLoadingProducts(false)
      }
    }

    if (isOpen) {
      loadVendorsAndProducts()
    }
  }, [isOpen])

  const vehicleStatusOptions = [
    { value: 'active', label: 'Active' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'retired', label: 'Retired' },
    { value: 'sold', label: 'Sold' },
  ]

  const currentYear = new Date()?.getFullYear()
  const yearOptions = []
  for (let year = currentYear + 1; year >= currentYear - 20; year--) {
    yearOptions?.push({ value: year, label: year?.toString() })
  }

  const commonMakes = [
    'Acura',
    'Audi',
    'BMW',
    'Buick',
    'Cadillac',
    'Chevrolet',
    'Chrysler',
    'Dodge',
    'Ford',
    'GMC',
    'Honda',
    'Hyundai',
    'Infiniti',
    'Jeep',
    'Kia',
    'Lexus',
    'Lincoln',
    'Mazda',
    'Mercedes-Benz',
    'Nissan',
    'Ram',
    'Subaru',
    'Tesla',
    'Toyota',
    'Volkswagen',
    'Volvo',
  ]

  const makeOptions = [
    { value: '', label: 'Select Make' },
    ...commonMakes?.map((make) => ({ value: make, label: make })),
  ]

  const vendorOptions = [
    { value: '', label: 'Select Vendor (Optional)' },
    ...vendors?.map((vendor) => ({
      value: vendor?.id,
      label: `${vendor?.name} - ${vendor?.specialty}`,
    })),
  ]

  // Generate suggested stock number
  const generateStockNumber = () => {
    if (watchedMake && watchedYear) {
      const makePrefix = watchedMake?.substring(0, 2)?.toUpperCase()
      const yearSuffix = watchedYear?.toString()?.slice(-2)
      const randomNum = Math.floor(Math.random() * 999) + 1
      return `${makePrefix}${yearSuffix}${randomNum?.toString()?.padStart(3, '0')}`
    }
    return ''
  }

  const fillSuggestedStockNumber = () => {
    const suggested = generateStockNumber()
    if (suggested) {
      setValue('stock_number', suggested)
    }
  }

  const handleProductToggle = (product, isChecked) => {
    if (isChecked) {
      setSelectedProducts((prev) => [
        ...prev,
        {
          ...product,
          quantity: 1,
          price: product?.unit_price,
        },
      ])
    } else {
      setSelectedProducts((prev) => prev?.filter((p) => p?.id !== product?.id))
    }
  }

  const updateProductQuantity = (productId, quantity) => {
    setSelectedProducts((prev) =>
      prev?.map((p) =>
        p?.id === productId ? { ...p, quantity: Math.max(1, parseInt(quantity) || 1) } : p
      )
    )
  }

  const updateProductPrice = (productId, price) => {
    setSelectedProducts((prev) =>
      prev?.map((p) => (p?.id === productId ? { ...p, price: parseFloat(price) || 0 } : p))
    )
  }

  const getTotalProductValue = () => {
    return selectedProducts?.reduce(
      (total, product) => total + product?.quantity * product?.price,
      0
    )
  }

  const handleFormSubmit = async (data) => {
    // Validate mandatory products
    if (selectedProducts?.length === 0) {
      setSubmitError(
        'At least one product must be selected. We never add cars without tracking aftermarket products.'
      )
      return
    }

    setIsSubmitting(true)
    setSubmitError('')

    try {
      // Clean up data - remove empty strings, convert numbers
      const cleanedData = {
        ...data,
        year: parseInt(data?.year),
        mileage: data?.mileage ? parseInt(data?.mileage) : null,
        needs_loaner: Boolean(data?.needs_loaner),
        primary_vendor_id: data?.primary_vendor_id || null,
        // Remove empty strings
        vin: data?.vin?.trim() || null,
        stock_number: data?.stock_number?.trim() || null,
        color: data?.color?.trim() || null,
        license_plate: data?.license_plate?.trim() || null,
        owner_name: data?.owner_name?.trim() || null,
        owner_email: data?.owner_email?.trim() || null,
        owner_phone: data?.owner_phone?.trim() || null,
        notes: data?.notes?.trim() || null,
        // Add selected products
        initial_products: selectedProducts,
        total_initial_product_value: getTotalProductValue(),
      }

      await onSubmit(cleanedData)
      reset()
      setSelectedProducts([])
      onClose()
    } catch (error) {
      console.error('Error adding vehicle:', error)
      setSubmitError(error?.message || 'Failed to add vehicle. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!isSubmitting) {
      reset()
      setSelectedProducts([])
      setSubmitError('')
      onClose()
    }
  }

  // Close modal on Escape key
  useEffect(() => {
    const handleEscape = (e) => {
      if (e?.key === 'Escape' && isOpen && !isSubmitting) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, isSubmitting])

  if (!isOpen) return null

  const canSave = selectedProducts?.length > 0 // Must have products

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
      {/* Modal */}
      <div className="relative bg-card border border-border rounded-xl shadow-elevation-3 w-full max-w-6xl max-h-[95vh] overflow-hidden mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
              <Icon name="Plus" size={20} className="text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-foreground">Add New Vehicle</h2>
              <p className="text-sm text-muted-foreground">
                Complete vehicle setup with vendor assignment and aftermarket products
              </p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={isSubmitting}
            className="hover:bg-muted"
            aria-label="Close modal"
          >
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="overflow-y-auto max-h-[calc(95vh-140px)]"
        >
          <div className="p-6 space-y-8">
            {/* Error Message */}
            {submitError && (
              <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Icon name="AlertCircle" size={16} className="text-destructive" />
                  <span className="text-sm text-destructive font-medium">Error</span>
                </div>
                <p className="text-sm text-destructive mt-1">{submitError}</p>
              </div>
            )}

            {/* Vehicle Information */}
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">Vehicle Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Select
                  label="Make *"
                  options={makeOptions}
                  {...register('make', { required: 'Make is required' })}
                  error={errors?.make?.message}
                  required
                />

                <Input
                  label="Model *"
                  type="text"
                  placeholder="e.g., Civic, F-150, Camry"
                  {...register('model', {
                    required: 'Model is required',
                    minLength: { value: 1, message: 'Model cannot be empty' },
                  })}
                  error={errors?.model?.message}
                  required
                />

                <Select
                  label="Year *"
                  options={yearOptions}
                  {...register('year', {
                    required: 'Year is required',
                    valueAsNumber: true,
                  })}
                  error={errors?.year?.message}
                  required
                />

                <div className="relative">
                  <Input
                    label="Stock Number"
                    type="text"
                    placeholder="e.g., HO24001, FO24002"
                    {...register('stock_number')}
                    error={errors?.stock_number?.message}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={fillSuggestedStockNumber}
                    className="absolute right-2 top-8 text-xs"
                    disabled={!watchedMake || !watchedYear}
                    aria-label="Auto-generate stock number"
                  >
                    Auto
                  </Button>
                </div>

                <Input
                  label="VIN"
                  type="text"
                  placeholder="17-character VIN"
                  {...register('vin', {
                    minLength: { value: 17, message: 'VIN must be 17 characters' },
                    maxLength: { value: 17, message: 'VIN must be 17 characters' },
                    pattern: {
                      value: /^[A-HJ-NPR-Z0-9]{17}$/i,
                      message: 'Invalid VIN format',
                    },
                  })}
                  error={errors?.vin?.message}
                  maxLength={17}
                />

                <Input
                  label="Color"
                  type="text"
                  placeholder="e.g., Black, White, Silver"
                  {...register('color')}
                  error={errors?.color?.message}
                />

                <Input
                  label="Mileage"
                  type="number"
                  placeholder="e.g., 45000"
                  {...register('mileage', {
                    min: { value: 0, message: 'Mileage cannot be negative' },
                    max: { value: 999999, message: 'Mileage too high' },
                  })}
                  error={errors?.mileage?.message}
                />

                <Input
                  label="License Plate"
                  type="text"
                  placeholder="e.g., ABC-123"
                  {...register('license_plate')}
                  error={errors?.license_plate?.message}
                />

                <Select
                  label="Status"
                  options={vehicleStatusOptions}
                  {...register('vehicle_status')}
                  error={errors?.vehicle_status?.message}
                />
              </div>
            </div>

            {/* Service Requirements */}
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">Service Requirements</h3>
              <div className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id="needs_loaner"
                    name="needs_loaner"
                    label=""
                    description=""
                    {...register('needs_loaner')}
                  />
                  <label htmlFor="needs_loaner" className="text-sm font-medium text-foreground">
                    Customer needs loaner vehicle
                  </label>
                </div>

                {watchedNeedsLoaner && (
                  <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <p className="text-sm text-primary">
                      <Icon name="Info" size={16} className="inline mr-2" />
                      Loaner vehicle will be arranged for this customer during service
                    </p>
                  </div>
                )}

                <Select
                  label="Primary Vendor Assignment"
                  options={vendorOptions}
                  {...register('primary_vendor_id')}
                  error={errors?.primary_vendor_id?.message}
                />
              </div>
            </div>

            {/* Aftermarket Products - MANDATORY */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-medium text-foreground">Aftermarket Products *</h3>
                  <p className="text-sm text-muted-foreground">
                    Select initial products for aftermarket tracking (required)
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  Selected: {selectedProducts?.length} products | Total: $
                  {getTotalProductValue()?.toFixed(2)}
                </div>
              </div>

              {loadingProducts ? (
                <div className="p-4 text-center">
                  <Icon name="Loader2" size={20} className="animate-spin mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">Loading products...</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 max-h-64 overflow-y-auto border border-border rounded-lg p-4">
                    {products?.map((product) => (
                      <div
                        key={product?.id}
                        className="flex items-center justify-between p-3 bg-muted/30 rounded-lg"
                      >
                        <div className="flex items-center space-x-3">
                          <Checkbox
                            id={`product_${product?.id}`}
                            name={`product_${product?.id}`}
                            label=""
                            description=""
                            checked={selectedProducts?.some((p) => p?.id === product?.id)}
                            onChange={(e) => handleProductToggle(product, e?.target?.checked)}
                          />
                          <div>
                            <label
                              htmlFor={`product_${product?.id}`}
                              className="text-sm font-medium text-foreground"
                            >
                              {product?.name}
                            </label>
                            <p className="text-xs text-muted-foreground">
                              {product?.category} - ${product?.unit_price}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Selected Products Configuration */}
                  {selectedProducts?.length > 0 && (
                    <div className="mt-4">
                      <h4 className="text-sm font-medium text-foreground mb-3">
                        Selected Products Configuration
                      </h4>
                      <div className="space-y-2">
                        {selectedProducts?.map((product) => (
                          <div
                            key={product?.id}
                            className="flex items-center justify-between p-3 bg-primary/5 border border-primary/20 rounded-lg"
                          >
                            <div className="flex-1">
                              <span className="text-sm font-medium text-foreground">
                                {product?.name}
                              </span>
                              <span className="text-xs text-muted-foreground ml-2">
                                ({product?.category})
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <label className="text-xs text-muted-foreground">Qty:</label>
                              <input
                                type="number"
                                min="1"
                                value={product?.quantity}
                                onChange={(e) =>
                                  updateProductQuantity(product?.id, e?.target?.value)
                                }
                                className="w-16 px-2 py-1 text-xs border border-border rounded text-center"
                              />
                              <label className="text-xs text-muted-foreground">Price:</label>
                              <input
                                type="number"
                                step="0.01"
                                value={product?.price}
                                onChange={(e) => updateProductPrice(product?.id, e?.target?.value)}
                                className="w-20 px-2 py-1 text-xs border border-border rounded text-right"
                              />
                              <span className="text-xs font-medium text-foreground">
                                = ${(product?.quantity * product?.price)?.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Owner Information */}
            <div>
              <h3 className="text-lg font-medium text-foreground mb-4">Owner Information</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Input
                  label="Owner Name"
                  type="text"
                  placeholder="e.g., John Smith"
                  {...register('owner_name')}
                  error={errors?.owner_name?.message}
                />

                <Input
                  label="Owner Email"
                  type="email"
                  placeholder="e.g., owner@email.com"
                  {...register('owner_email', {
                    pattern: {
                      value: /^\S+@\S+$/,
                      message: 'Invalid email format',
                    },
                  })}
                  error={errors?.owner_email?.message}
                />

                <Input
                  label="Owner Phone"
                  type="tel"
                  placeholder="e.g., (555) 123-4567"
                  {...register('owner_phone')}
                  error={errors?.owner_phone?.message}
                />
              </div>
            </div>

            {/* Additional Notes */}
            <div>
              <label htmlFor="notes" className="block text-sm font-medium text-foreground mb-2">
                Additional Notes
              </label>
              <textarea
                id="notes"
                rows={3}
                className="w-full px-3 py-2 bg-background border border-border rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
                placeholder="Any additional notes about the vehicle, service requirements, or customer preferences..."
                {...register('notes')}
              />
              {errors?.notes && (
                <p className="text-sm text-destructive mt-1">{errors?.notes?.message}</p>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-6 border-t border-border bg-muted/30">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Icon name="Info" size={16} />
                <span>* Required fields</span>
              </div>
              {selectedProducts?.length === 0 && (
                <div className="flex items-center space-x-2 text-sm text-amber-600">
                  <Icon name="AlertTriangle" size={16} />
                  <span>Products required for aftermarket tracking</span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-3">
              <Button
                type="button"
                variant="ghost"
                onClick={handleClose}
                disabled={isSubmitting}
                className=""
                aria-label="Cancel"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!canSave || isSubmitting}
                loading={isSubmitting}
                iconName="Plus"
                iconPosition="left"
                className=""
                onClick={() => {}}
                aria-label="Add Vehicle with Products"
              >
                Add Vehicle with Products
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddVehicleModal
