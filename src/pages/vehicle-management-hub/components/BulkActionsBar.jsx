import React, { useState, useEffect } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'
import { getVendors } from '../../../services/dropdownService'

const BulkActionsBar = ({
  selectedCount,
  onBulkStatusUpdate,
  onBulkExport,
  onBulkDelete,
  onClearSelection,
  onBulkAssignVendor,
  onBulkMarkPriority,
}) => {
  const [bulkAction, setBulkAction] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  // Vendor assignment modal state
  const [showVendorModal, setShowVendorModal] = useState(false)
  const [vendors, setVendors] = useState([])
  const [selectedVendorId, setSelectedVendorId] = useState('')
  const [loadingVendors, setLoadingVendors] = useState(false)

  // Status selection modal state
  const [showStatusModal, setShowStatusModal] = useState(false)
  const [selectedStatus, setSelectedStatus] = useState('')

  const jobStatusOptions = [
    { value: 'draft', label: 'Draft' },
    { value: 'pending', label: 'Pending' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'quality_check', label: 'Quality Check' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const statusOptions = [
    { value: 'available', label: 'Available' },
    { value: 'in-work', label: 'In Work' },
    { value: 'completed', label: 'Completed' },
    { value: 'sold', label: 'Sold' },
  ]

  // Load vendors when the vendor modal opens
  useEffect(() => {
    if (!showVendorModal) return
    setLoadingVendors(true)
    getVendors({ activeOnly: true })
      .then((opts) => setVendors(opts || []))
      .catch(() => setVendors([]))
      .finally(() => setLoadingVendors(false))
  }, [showVendorModal])

  const handleBulkAction = async (action) => {
    if (!action) return

    switch (action) {
      case 'update-status':
        // Open the status selection modal so the user can pick a job status
        setSelectedStatus('')
        setShowStatusModal(true)
        setBulkAction('')
        return
      case 'export-selected':
        setIsProcessing(true)
        try {
          await onBulkExport()
        } catch (error) {
          console.error('Bulk export failed:', error)
        } finally {
          setIsProcessing(false)
          setBulkAction('')
        }
        return
      case 'assign-vendor':
        // Open the vendor assignment modal
        setSelectedVendorId('')
        setShowVendorModal(true)
        setBulkAction('')
        return
      case 'mark-priority': {
        // Immediate action — no modal needed
        setIsProcessing(true)
        try {
          if (typeof onBulkMarkPriority === 'function') {
            await onBulkMarkPriority()
          } else {
            console.warn('BulkActionsBar: onBulkMarkPriority prop not provided')
          }
        } catch (error) {
          console.error('Mark priority failed:', error)
        } finally {
          setIsProcessing(false)
          setBulkAction('')
        }
        return
      }
      case 'delete':
        if (window.confirm(`Are you sure you want to delete ${selectedCount} vehicles?`)) {
          setIsProcessing(true)
          try {
            await onBulkDelete()
          } catch (error) {
            console.error('Bulk delete failed:', error)
          } finally {
            setIsProcessing(false)
          }
        }
        setBulkAction('')
        return
      default:
        setBulkAction('')
        return
    }
  }

  const handleStatusConfirm = async () => {
    if (!selectedStatus) return
    setShowStatusModal(false)
    setIsProcessing(true)
    try {
      await onBulkStatusUpdate(selectedStatus)
    } catch (error) {
      console.error('Bulk status update failed:', error)
    } finally {
      setIsProcessing(false)
      setSelectedStatus('')
    }
  }

  const handleVendorConfirm = async () => {
    if (!selectedVendorId) return
    setShowVendorModal(false)
    setIsProcessing(true)
    try {
      if (typeof onBulkAssignVendor === 'function') {
        await onBulkAssignVendor(selectedVendorId)
      } else {
        console.warn('BulkActionsBar: onBulkAssignVendor prop not provided')
      }
    } catch (error) {
      console.error('Bulk vendor assignment failed:', error)
    } finally {
      setIsProcessing(false)
      setSelectedVendorId('')
    }
  }

  const handleStatusUpdate = async (status) => {
    setIsProcessing(true)
    try {
      await onBulkStatusUpdate(status)
    } catch (error) {
      console.error('Status update failed:', error)
    } finally {
      setIsProcessing(false)
    }
  }

  if (selectedCount === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
      <div className="bg-card border border-border rounded-lg shadow-elevation-3 px-6 py-4">
        <div className="flex items-center space-x-4">
          {/* Selection Info */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center justify-center w-8 h-8 bg-primary text-primary-foreground rounded-full">
              <span className="text-sm font-medium">{selectedCount}</span>
            </div>
            <span className="text-sm font-medium text-foreground">
              {selectedCount === 1 ? 'vehicle' : 'vehicles'} selected
            </span>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2">
            {/* Status Update Dropdown */}
            <Select
              placeholder="Update Status"
              options={statusOptions}
              value=""
              onChange={handleStatusUpdate}
              disabled={isProcessing}
              className="w-40"
            />

            {/* Export Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('export-selected')}
              disabled={isProcessing}
              loading={isProcessing && bulkAction === 'export-selected'}
              iconName="Download"
              iconPosition="left"
            >
              Export
            </Button>

            {/* Assign Vendor Button */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleBulkAction('assign-vendor')}
              disabled={isProcessing}
              iconName="Users"
              iconPosition="left"
            >
              Assign Vendor
            </Button>

            {/* More Actions Dropdown */}
            <Select
              placeholder="More Actions"
              options={[
                { value: '', label: 'More Actions...' },
                { value: 'mark-priority', label: 'Mark as Priority' },
                { value: 'delete', label: 'Delete Selected' },
              ]}
              value=""
              onChange={handleBulkAction}
              disabled={isProcessing}
              className="w-40"
            />
          </div>

          {/* Clear Selection */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={isProcessing}
            iconName="X"
            iconPosition="left"
          >
            Clear
          </Button>
        </div>

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="mt-3 pt-3 border-t border-border">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <Icon name="Loader2" size={16} className="animate-spin" />
              <span>Processing {selectedCount} vehicles...</span>
            </div>
          </div>
        )}
      </div>

      {/* Status Selection Modal */}
      {showStatusModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-elevation-3 p-6 w-80">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Update Job Status for {selectedCount} {selectedCount === 1 ? 'Vehicle' : 'Vehicles'}
            </h3>
            <Select
              placeholder="Select a status"
              options={jobStatusOptions}
              value={selectedStatus}
              onChange={(val) => setSelectedStatus(val)}
              className="w-full mb-4"
            />
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowStatusModal(false); setSelectedStatus('') }}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleStatusConfirm}
                disabled={!selectedStatus}
              >
                Apply
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Vendor Assignment Modal */}
      {showVendorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-card border border-border rounded-lg shadow-elevation-3 p-6 w-80">
            <h3 className="text-base font-semibold text-foreground mb-4">
              Assign Vendor to {selectedCount} {selectedCount === 1 ? 'Vehicle' : 'Vehicles'}
            </h3>
            {loadingVendors ? (
              <div className="flex items-center space-x-2 text-sm text-muted-foreground mb-4">
                <Icon name="Loader2" size={16} className="animate-spin" />
                <span>Loading vendors...</span>
              </div>
            ) : (
              <Select
                placeholder="Select a vendor"
                options={vendors}
                value={selectedVendorId}
                onChange={(val) => setSelectedVendorId(val)}
                className="w-full mb-4"
              />
            )}
            <div className="flex justify-end space-x-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setShowVendorModal(false); setSelectedVendorId('') }}
              >
                Cancel
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={handleVendorConfirm}
                disabled={!selectedVendorId || loadingVendors}
              >
                Assign
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BulkActionsBar
