import React, { useState } from 'react'
import Icon from '../AppIcon'
import Button from '../ui/Button'
import Select from '../ui/Select'
import { advancedFeaturesService } from '../../services/advancedFeaturesService'
import { useAuth } from '../../contexts/AuthContext'

const ExportButton = ({
  exportType, // 'jobs', 'vehicles', 'vendors', 'transactions'
  filters = {},
  selectedIds = [], // For exporting only selected items
  onExportStart,
  onExportComplete,
  onExportError,
  disabled = false,
  variant = 'outline',
  size = 'sm',
  className = '',
  'data-testid': dataTestId,
}) => {
  const [isExporting, setIsExporting] = useState(false)
  const [showOptions, setShowOptions] = useState(false)
  const [exportFormat, setExportFormat] = useState('csv')
  const [exportScope, setExportScope] = useState('filtered')
  const { userProfile } = useAuth()

  const exportOptions = [
    { value: 'csv', label: 'CSV File' },
    { value: 'excel', label: 'Excel File' },
  ]

  const scopeOptions = [
    { value: 'all', label: 'All Records' },
    { value: 'filtered', label: 'Filtered Results' },
    ...(selectedIds?.length > 0
      ? [{ value: 'selected', label: `Selected (${selectedIds?.length})` }]
      : []),
  ]

  const getExportFilename = () => {
    const timestamp = new Date()?.toISOString()?.split('T')?.[0]
    const scope = exportScope === 'selected' ? 'selected' : exportScope
    return `${exportType}-${scope}-${timestamp}.${exportFormat}`
  }

  const handleExport = async () => {
    if (isExporting) return

    try {
      setIsExporting(true)
      if (onExportStart) onExportStart()

      // Prepare filters based on scope
      let exportFilters = { ...filters }

      if (exportScope === 'selected' && selectedIds?.length > 0) {
        exportFilters.ids = selectedIds
      }

      if (exportScope === 'all') {
        exportFilters = {} // Clear all filters for full export
      }

      // Get data from service
      const result = await advancedFeaturesService?.exportData(
        exportType,
        exportFilters,
        userProfile?.role || 'staff'
      )

      if (result?.error) {
        throw new Error(result?.error?.message)
      }

      if (!result?.data || result?.data?.length === 0) {
        throw new Error('No data found to export')
      }

      // Export to file
      const filename = getExportFilename()
      const exportResult = await advancedFeaturesService?.exportToCSV(result?.data, filename)

      if (exportResult?.error) {
        throw new Error(exportResult?.error?.message)
      }

      setShowOptions(false)
      if (onExportComplete) {
        onExportComplete(result?.data?.length, filename)
      }
    } catch (error) {
      console.error('Export error:', error)
      if (onExportError) {
        onExportError(error?.message || 'Export failed')
      }
    } finally {
      setIsExporting(false)
    }
  }

  const getExportTypeLabel = () => {
    switch (exportType) {
      case 'jobs':
        return 'Jobs'
      case 'vehicles':
        return 'Vehicles'
      case 'vendors':
        return 'Vendors'
      case 'transactions':
        return 'Transactions'
      default:
        return 'Data'
    }
  }

  return (
    <div className="relative">
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowOptions(!showOptions)}
        disabled={disabled || isExporting}
        iconName={isExporting ? undefined : 'Download'}
        iconPosition="left"
        className={`${className} ${isExporting ? 'cursor-wait' : ''}`}
        aria-label={`Export ${getExportTypeLabel()}`}
        data-testid={dataTestId}
      >
        {isExporting ? (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-4 border-2 border-gray-300 border-t-primary rounded-full animate-spin" />
            <span>Exporting...</span>
          </div>
        ) : (
          `Export ${getExportTypeLabel()}`
        )}
      </Button>

      {/* Export Options Dropdown */}
      {showOptions && !isExporting && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-card border border-border rounded-lg shadow-lg z-50">
          <div className="p-4 space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Export Format
              </label>
              <Select
                value={exportFormat}
                onChange={setExportFormat}
                options={exportOptions}
                className="w-full"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">Export Scope</label>
              <Select
                value={exportScope}
                onChange={setExportScope}
                options={scopeOptions}
                className="w-full"
              />
            </div>

            {exportScope === 'filtered' && Object?.keys(filters)?.length === 0 && (
              <div className="text-xs text-orange-600 bg-orange-50 p-2 rounded">
                <Icon name="AlertTriangle" size={12} className="inline mr-1" />
                No filters applied. This will export all records.
              </div>
            )}

            {exportScope === 'selected' && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                <Icon name="Info" size={12} className="inline mr-1" />
                Exporting {selectedIds?.length} selected record
                {selectedIds?.length !== 1 ? 's' : ''}.
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowOptions(false)}
                className="min-w-0"
                aria-label="Cancel export"
              >
                Cancel
              </Button>

              <Button
                size="sm"
                onClick={handleExport}
                iconName="Download"
                iconPosition="left"
                className="min-w-0"
                aria-label={`Export ${getExportTypeLabel()}`}
              >
                Export
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ExportButton
