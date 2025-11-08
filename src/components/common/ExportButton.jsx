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
  const { user, userProfile } = useAuth()

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

  const exportData = async () => {
    try {
      setIsExporting(true)

      // Get data from service instead of undefined generateExportData
      const result = await advancedFeaturesService?.exportData(
        exportType,
        filters,
        userProfile?.role || 'staff'
      )

      if (result?.error) {
        onExportError?.(result?.error?.message || 'Export failed')
        return
      }

      const data = result?.data

      if (!data || data?.length === 0) {
        onExportError?.('No data available for export')
        return
      }

      // Enhanced CSV columns with proper guards
      const csvData = data?.map((row) => {
        // Helper function to guard against NaN/undefined values
        const safeValue = (value, fallback = '') => {
          if (
            value === null ||
            value === undefined ||
            value === '' ||
            (typeof value === 'number' && (isNaN(value) || !isFinite(value)))
          ) {
            return fallback
          }
          return value
        }

        const safeNumber = (value, fallback = 0) => {
          const num = parseFloat(value)
          return isNaN(num) || !isFinite(num) ? fallback : num
        }

        const safeCurrency = (value) => {
          const num = safeNumber(value, 0)
          return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          })?.format(num)
        }

        return {
          // Core identification
          Stock: safeValue(row?.vehicle?.stock_number),
          Customer: safeValue(row?.customer_name),
          Phone: safeValue(row?.customer_phone),

          // Vehicle information
          Vehicle: row?.vehicle
            ? `${safeValue(row?.vehicle?.year)} ${safeValue(row?.vehicle?.make)} ${safeValue(row?.vehicle?.model)}`?.trim()
            : '',

          // Staff assignments
          Sales: safeValue(row?.assigned_to_name),
          Status: safeValue(row?.job_status, 'unknown')?.replace('_', ' ')?.toUpperCase(),

          // Service details
          ServiceType: row?.service_type === 'vendor' ? 'Off-Site' : 'On-Site',

          // Loaner information with proper boolean check
          Loaner: row?.customer_needs_loaner === true ? 'Yes' : 'No',

          // Next promised date with safe formatting
          NextPromised: (() => {
            if (!row?.job_parts || row?.job_parts?.length === 0) return ''

            const schedulingItems = row?.job_parts?.filter(
              (part) => part?.requires_scheduling && part?.promised_date
            )

            if (schedulingItems?.length === 0) return ''

            const earliestPromise = schedulingItems?.sort(
              (a, b) => new Date(a.promised_date) - new Date(b.promised_date)
            )?.[0]

            if (!earliestPromise?.promised_date) return ''

            try {
              return new Date(earliestPromise.promised_date)?.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })
            } catch {
              return ''
            }
          })(),

          // Financial information with currency formatting
          Value: safeCurrency(row?.total_amount),

          // Vendor information
          Vendor: safeValue(row?.vendor?.name),
        }
      })

      // Generate filename with timestamp
      const timestamp = new Date()?.toISOString()?.slice(0, 19)?.replace(/:/g, '-')
      const filename = `${exportType}_export_${timestamp}.csv`

      // Convert to CSV
      const csvContent = convertToCSV(csvData)

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)

      link?.setAttribute('href', url)
      link?.setAttribute('download', filename)
      link.style.visibility = 'hidden'
      document.body?.appendChild(link)
      link?.click()
      document.body?.removeChild(link)

      onExportComplete?.(data?.length, filename)
    } catch (error) {
      console.error('Export error:', error)
      onExportError?.(error?.message || 'Export failed')
    } finally {
      setIsExporting(false)
    }
  }

  // Helper function to convert data to CSV with proper escaping
  const convertToCSV = (data) => {
    if (!data || data?.length === 0) return ''

    const headers = Object.keys(data?.[0])
    const csvRows = [
      // Header row
      headers?.map((header) => `"${header}"`)?.join(','),
      // Data rows
      ...data?.map((row) =>
        headers
          ?.map((header) => {
            const value = row?.[header]
            // Escape quotes and wrap in quotes
            const escapedValue = String(value || '')?.replace(/"/g, '""')
            return `"${escapedValue}"`
          })
          ?.join(',')
      ),
    ]

    return csvRows?.join('\n')
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
