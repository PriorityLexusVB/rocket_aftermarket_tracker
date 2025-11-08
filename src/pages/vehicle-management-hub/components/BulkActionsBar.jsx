import React, { useState } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'

const BulkActionsBar = ({
  selectedCount,
  onBulkStatusUpdate,
  onBulkExport,
  onBulkDelete,
  onClearSelection,
}) => {
  const [bulkAction, setBulkAction] = useState('')
  const [isProcessing, setIsProcessing] = useState(false)

  const bulkActionOptions = [
    { value: '', label: 'Choose action...' },
    { value: 'update-status', label: 'Update Status' },
    { value: 'export-selected', label: 'Export Selected' },
    { value: 'assign-vendor', label: 'Assign Vendor' },
    { value: 'mark-priority', label: 'Mark Priority' },
    { value: 'delete', label: 'Delete Selected' },
  ]

  const statusOptions = [
    { value: 'available', label: 'Available' },
    { value: 'in-work', label: 'In Work' },
    { value: 'completed', label: 'Completed' },
    { value: 'sold', label: 'Sold' },
  ]

  const handleBulkAction = async (action) => {
    setIsProcessing(true)

    try {
      switch (action) {
        case 'update-status':
          // This would open a modal or dropdown for status selection
          console.log('Update status for selected vehicles')
          break
        case 'export-selected':
          await onBulkExport()
          break
        case 'assign-vendor':
          console.log('Assign vendor to selected vehicles')
          break
        case 'mark-priority':
          console.log('Mark selected vehicles as priority')
          break
        case 'delete':
          if (window.confirm(`Are you sure you want to delete ${selectedCount} vehicles?`)) {
            await onBulkDelete()
          }
          break
        default:
          break
      }
    } catch (error) {
      console.error('Bulk action failed:', error)
    } finally {
      setIsProcessing(false)
      setBulkAction('')
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
                { value: 'duplicate', label: 'Duplicate Vehicles' },
                { value: 'archive', label: 'Archive Selected' },
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
    </div>
  )
}

export default BulkActionsBar
