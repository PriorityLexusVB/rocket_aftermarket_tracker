import React, { useState, useEffect, useCallback } from 'react'
import Icon from '../../../components/AppIcon'
import Select from '../../../components/ui/Select'
import Button from '../../../components/ui/Button'

const VendorAssignmentPanel = ({
  selectedProducts,
  vendorAssignments,
  onVendorAssign,
  onNotificationToggle,
}) => {
  const [bulkVendor, setBulkVendor] = useState('')
  const [estimatedCompletion, setEstimatedCompletion] = useState('')

  // Mock vendor data
  const mockVendors = [
    {
      id: 'vendor_001',
      name: 'Premium Auto Detailing',
      specialties: ['Paint Protection', 'Ceramic Coating', 'Premium Detailing'],
      rating: 4.9,
      completedJobs: 156,
      averageTime: '4.2 hours',
      status: 'Available',
      phone: '+1 (555) 123-4567',
      email: 'contact@premiumautodetailing.com',
      currentWorkload: 3,
      maxCapacity: 8,
    },
    {
      id: 'vendor_002',
      name: 'Crystal Clear Tinting',
      specialties: ['Window Tinting', 'Glass Work', 'Installation'],
      rating: 4.7,
      completedJobs: 89,
      averageTime: '2.8 hours',
      status: 'Available',
      phone: '+1 (555) 234-5678',
      email: 'info@crystalcleartinting.com',
      currentWorkload: 2,
      maxCapacity: 5,
    },
    {
      id: 'vendor_003',
      name: 'Wrap Masters Studio',
      specialties: ['Vinyl Installation', 'Custom Graphics', 'Vehicle Wraps'],
      rating: 4.8,
      completedJobs: 67,
      averageTime: '8.5 hours',
      status: 'Busy',
      phone: '+1 (555) 345-6789',
      email: 'studio@wrapmasters.com',
      currentWorkload: 4,
      maxCapacity: 4,
    },
    {
      id: 'vendor_004',
      name: 'Guardian Coatings',
      specialties: ['Undercoating', 'Rust Prevention', 'Paint Protection'],
      rating: 4.6,
      completedJobs: 134,
      averageTime: '3.1 hours',
      status: 'Available',
      phone: '+1 (555) 456-7890',
      email: 'service@guardiancoatings.com',
      currentWorkload: 1,
      maxCapacity: 6,
    },
    {
      id: 'vendor_005',
      name: 'Elite Auto Services',
      specialties: ['General', 'Installation', 'Maintenance'],
      rating: 4.4,
      completedJobs: 203,
      averageTime: '3.8 hours',
      status: 'Available',
      phone: '+1 (555) 567-8901',
      email: 'contact@eliteautoservices.com',
      currentWorkload: 2,
      maxCapacity: 10,
    },
  ]

  const getRecommendedVendors = (product) => {
    return mockVendors
      ?.filter((vendor) =>
        product?.vendorSpecialties?.some((specialty) => vendor?.specialties?.includes(specialty))
      )
      ?.sort((a, b) => {
        // Sort by availability, then rating, then workload
        if (a?.status === 'Available' && b?.status !== 'Available') return -1
        if (a?.status !== 'Available' && b?.status === 'Available') return 1
        if (b?.rating !== a?.rating) return b?.rating - a?.rating
        return a?.currentWorkload - b?.currentWorkload
      })
  }

  const getVendorOptions = (product) => {
    const recommended = getRecommendedVendors(product)
    const others = mockVendors?.filter((vendor) => !recommended?.includes(vendor))

    const options = [
      { value: '', label: 'Select Vendor' },
      ...recommended?.map((vendor) => ({
        value: vendor?.id,
        label: `${vendor?.name} (${vendor?.rating}⭐) - ${vendor?.status}`,
        description: `${vendor?.specialties?.join(', ')} • ${vendor?.currentWorkload}/${vendor?.maxCapacity} jobs`,
      })),
      ...(others?.length > 0
        ? [{ value: 'divider', label: '--- Other Vendors ---', disabled: true }]
        : []),
      ...others?.map((vendor) => ({
        value: vendor?.id,
        label: `${vendor?.name} (${vendor?.rating}⭐) - ${vendor?.status}`,
        description: `${vendor?.specialties?.join(', ')} • ${vendor?.currentWorkload}/${vendor?.maxCapacity} jobs`,
      })),
    ]

    return options
  }

  const handleVendorSelect = (productId, vendorId) => {
    const vendor = mockVendors?.find((v) => v?.id === vendorId)
    onVendorAssign(productId, vendor)
  }

  const handleBulkAssign = () => {
    if (bulkVendor) {
      const vendor = mockVendors?.find((v) => v?.id === bulkVendor)
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
        const avgHours = parseFloat(vendor?.averageTime?.split(' ')?.[0])
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
    ...mockVendors?.map((vendor) => ({
      value: vendor?.id,
      label: `${vendor?.name} (${vendor?.rating}⭐) - ${vendor?.status}`,
      description: `${vendor?.currentWorkload}/${vendor?.maxCapacity} current jobs`,
    })),
  ]

  useEffect(() => {
    if (Object.keys(vendorAssignments)?.length > 0) {
      setEstimatedCompletion(calculateEstimatedCompletion())
    }
  }, [calculateEstimatedCompletion, vendorAssignments])

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
