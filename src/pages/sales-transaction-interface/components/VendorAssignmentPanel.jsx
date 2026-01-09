import React, { useState, useEffect, useCallback } from 'react'
import Icon from '../../../components/AppIcon'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'
import { getVendors as getVendorsDropdown } from '../../../services/dropdownService'

const VendorAssignmentPanel = ({
  selectedProducts,
  vendorAssignments,
  onVendorAssign,
  onNotificationToggle,
}) => {
  const [bulkVendor, setBulkVendor] = useState('')
  const [estimatedCompletion, setEstimatedCompletion] = useState('')

  const [vendors, setVendors] = useState([])
  const [vendorsLoading, setVendorsLoading] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setVendorsLoading(true)
        const rows = await getVendorsDropdown({ activeOnly: true })
        setVendors(Array.isArray(rows) ? rows : [])
      } catch (e) {
        console.error('VendorAssignmentPanel: failed to load vendors', e)
        setVendors([])
      } finally {
        setVendorsLoading(false)
      }
    }

    // Only load when panel is relevant
    if (selectedProducts?.length > 0) {
      load()
    }
  }, [selectedProducts?.length])

  const getRecommendedVendors = (product) => {
    const desired = Array.isArray(product?.vendorSpecialties) ? product.vendorSpecialties : []
    const matches = vendors.filter((v) => {
      if (!desired.length) return true
      const specialty = String(v?.specialty || '').toLowerCase()
      return desired.some((s) => specialty.includes(String(s).toLowerCase()))
    })

    return matches.sort((a, b) => {
      // Prefer active vendors, then higher rating
      const aActive = a?.is_active !== false
      const bActive = b?.is_active !== false
      if (aActive && !bActive) return -1
      if (!aActive && bActive) return 1

      const ar = Number(a?.rating ?? 0)
      const br = Number(b?.rating ?? 0)
      return br - ar
    })
  }

  const getVendorOptions = (product) => {
    const recommended = getRecommendedVendors(product)
    const others = vendors?.filter((vendor) => !recommended?.includes(vendor))

    const options = [
      { value: '', label: 'Select Vendor' },
      ...recommended?.map((vendor) => ({
        value: vendor?.id,
        label: `${vendor?.name ?? vendor?.label}${vendor?.rating ? ` (${vendor?.rating}⭐)` : ''}`,
        description: vendor?.specialty ? String(vendor.specialty) : undefined,
      })),
      ...(others?.length > 0
        ? [{ value: 'divider', label: '--- Other Vendors ---', disabled: true }]
        : []),
      ...others?.map((vendor) => ({
        value: vendor?.id,
        label: `${vendor?.name ?? vendor?.label}${vendor?.rating ? ` (${vendor?.rating}⭐)` : ''}`,
        description: vendor?.specialty ? String(vendor.specialty) : undefined,
      })),
    ]

    return options
  }

  const handleVendorSelect = (productId, vendorId) => {
    const vendor = vendors?.find((v) => v?.id === vendorId)
    onVendorAssign(productId, vendor)
  }

  const handleBulkAssign = () => {
    if (bulkVendor) {
      const vendor = vendors?.find((v) => v?.id === bulkVendor)
      selectedProducts?.forEach((product) => {
        if (!vendorAssignments?.[product?.id]) {
          onVendorAssign(product?.id, vendor)
        }
      })
      setBulkVendor('')
    }
  }

  const calculateEstimatedCompletion = useCallback(() => {
    const now = new Date()
    const totalHours = selectedProducts?.reduce((total, product) => {
      const vendor = vendorAssignments?.[product?.id]
      if (vendor) {
        const avgHours = parseFloat(String(vendor?.averageTime || '').split(' ')?.[0])
        if (!Number.isFinite(avgHours)) return total
        return total + avgHours
      }
      return total
    }, 0)

    const completionDate = new Date(now.getTime() + totalHours * 60 * 60 * 1000)
    return completionDate?.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }, [selectedProducts, vendorAssignments])

  const getWorkloadColor = (current, max) => {
    const percentage = (current / max) * 100
    if (percentage >= 90) return 'text-error'
    if (percentage >= 70) return 'text-warning'
    return 'text-success'
  }

  const bulkVendorOptions = [
    { value: '', label: 'Select vendor for all products' },
    ...vendors?.map((vendor) => ({
      value: vendor?.id,
      label: `${vendor?.name ?? vendor?.label}${vendor?.rating ? ` (${vendor?.rating}⭐)` : ''}`,
      description: vendor?.specialty ? String(vendor.specialty) : undefined,
    })),
  ]

  useEffect(() => {
    if (Object.keys(vendorAssignments)?.length > 0) {
      setEstimatedCompletion(calculateEstimatedCompletion())
    }
  }, [calculateEstimatedCompletion, vendorAssignments])

  useEffect(() => {
    // If vendors are loading or unavailable, hide any stale estimate.
    if (vendorsLoading || vendors.length === 0) {
      setEstimatedCompletion('')
    }
  }, [vendorsLoading, vendors.length])

  if (selectedProducts?.length === 0) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center space-x-3 mb-4">
          <div className="flex items-center justify-center w-10 h-10 bg-muted rounded-lg">
            <Icon name="Users" size={20} className="text-muted-foreground" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Vendor Assignment</h3>
            <p className="text-sm text-muted-foreground">Select products first to assign vendors</p>
          </div>
        </div>
        <div className="text-center py-8">
          <Icon name="Package" size={48} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No products selected for vendor assignment</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-secondary/10 rounded-lg">
            <Icon name="Users" size={20} className="text-secondary" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Vendor Assignment</h3>
            <p className="text-sm text-muted-foreground">Assign vendors to selected products</p>
          </div>
        </div>
        {estimatedCompletion && (
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Estimated Completion</p>
            <p className="font-medium text-foreground">{estimatedCompletion}</p>
          </div>
        )}
      </div>
      {/* Bulk Assignment */}
      {selectedProducts?.length > 1 && (
        <div className="mb-6 p-4 bg-muted/30 border border-border rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-3">Bulk Assignment</h4>
          <div className="flex space-x-3">
            <Select
              options={bulkVendorOptions}
              value={bulkVendor}
              onChange={setBulkVendor}
              placeholder="Select vendor for all products"
              className="flex-1"
            />
            <Button
              variant="outline"
              onClick={handleBulkAssign}
              disabled={!bulkVendor}
              iconName="Users"
            >
              Assign All
            </Button>
          </div>
        </div>
      )}
      {/* Individual Product Assignments */}
      <div className="space-y-4">
        {selectedProducts?.map((product) => {
          const assignedVendor = vendorAssignments?.[product?.id]
          const vendorOptions = getVendorOptions(product)

          return (
            <div key={product?.id} className="p-4 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Icon name={product?.icon} size={16} className="text-primary" />
                  <div>
                    <h4 className="font-medium text-foreground">{product?.name}</h4>
                    <p className="text-sm text-muted-foreground">
                      Specialties needed: {product?.vendorSpecialties?.join(', ')}
                    </p>
                  </div>
                </div>
                {assignedVendor && (
                  <div className="flex items-center space-x-2">
                    <Icon name="CheckCircle" size={16} className="text-success" />
                    <span className="text-sm font-medium text-success">Assigned</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Select
                  label="Assigned Vendor"
                  options={vendorOptions}
                  value={assignedVendor?.id || ''}
                  onChange={(vendorId) => handleVendorSelect(product?.id, vendorId)}
                  searchable
                />

                {assignedVendor && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-muted-foreground">Rating:</span>
                        <p className="font-medium text-foreground">{assignedVendor?.rating}⭐</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Avg Time:</span>
                        <p className="font-medium text-foreground">{assignedVendor?.averageTime}</p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Status:</span>
                        <p
                          className={`font-medium ${
                            assignedVendor?.status === 'Available' ? 'text-success' : 'text-warning'
                          }`}
                        >
                          {assignedVendor?.status}
                        </p>
                      </div>
                      <div>
                        <span className="text-muted-foreground">Workload:</span>
                        <p
                          className={`font-medium ${getWorkloadColor(assignedVendor?.currentWorkload, assignedVendor?.maxCapacity)}`}
                        >
                          {assignedVendor?.currentWorkload}/{assignedVendor?.maxCapacity}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-2 border-t border-border">
                      <Icon name="Phone" size={14} className="text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">{assignedVendor?.phone}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onNotificationToggle(product?.id, 'sms')}
                        iconName="MessageSquare"
                        className="ml-auto"
                      >
                        Send SMS
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {/* Recommended Vendors */}
              {!assignedVendor && (
                <div className="mt-4 pt-4 border-t border-border">
                  <h5 className="text-sm font-medium text-foreground mb-2">Recommended Vendors</h5>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {getRecommendedVendors(product)
                      ?.slice(0, 4)
                      ?.map((vendor) => (
                        <div
                          key={vendor?.id}
                          className="p-2 border border-border rounded cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => handleVendorSelect(product?.id, vendor?.id)}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-medium text-foreground">{vendor?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {vendor?.rating}⭐ • {vendor?.completedJobs} jobs
                              </p>
                            </div>
                            <div className="text-right">
                              <p
                                className={`text-xs font-medium ${
                                  vendor?.status === 'Available' ? 'text-success' : 'text-warning'
                                }`}
                              >
                                {vendor?.status}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {vendor?.currentWorkload}/{vendor?.maxCapacity}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {/* Assignment Summary */}
      {Object.keys(vendorAssignments)?.length > 0 && (
        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-lg">
          <div className="flex items-center space-x-3 mb-3">
            <Icon name="ClipboardCheck" size={16} className="text-primary" />
            <h4 className="font-medium text-foreground">Assignment Summary</h4>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Products Assigned:</span>
              <p className="font-medium text-foreground">
                {Object.keys(vendorAssignments)?.length} of {selectedProducts?.length}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Vendors Involved:</span>
              <p className="font-medium text-foreground">
                {new Set(Object.values(vendorAssignments).map((v) => v.id))?.size}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Est. Completion:</span>
              <p className="font-medium text-foreground">{estimatedCompletion}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VendorAssignmentPanel
