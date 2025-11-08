import React, { useState } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'

const ExportPanel = ({ vehicleData, workItems, onExport }) => {
  const [exportFormat, setExportFormat] = useState('pdf')
  const [exportType, setExportType] = useState('summary')
  const [isExporting, setIsExporting] = useState(false)

  const formatOptions = [
    { value: 'pdf', label: 'PDF Document', description: 'Professional formatted report' },
    { value: 'xlsx', label: 'Excel Spreadsheet', description: 'Detailed data export' },
    { value: 'csv', label: 'CSV File', description: 'Raw data for analysis' },
  ]

  const typeOptions = [
    { value: 'summary', label: 'Work Summary', description: 'Customer-facing summary' },
    { value: 'detailed', label: 'Detailed Report', description: 'Complete work breakdown' },
    { value: 'financial', label: 'Financial Report', description: 'Cost and profit analysis' },
    { value: 'vendor', label: 'Vendor Report', description: 'Vendor-specific breakdown' },
  ]

  const handleExport = async () => {
    setIsExporting(true)

    try {
      const exportData = {
        vehicle: vehicleData,
        workItems: workItems,
        format: exportFormat,
        type: exportType,
        generatedAt: new Date()?.toISOString(),
        generatedBy: 'Current User', // This would come from auth context
      }

      await onExport(exportData)

      // Simulate export process
      setTimeout(() => {
        setIsExporting(false)
      }, 2000)
    } catch (error) {
      console.error('Export failed:', error)
      setIsExporting(false)
    }
  }

  const getPreviewData = () => {
    const completedItems = workItems?.filter((item) => item?.status === 'Complete')
    const totalCost = workItems?.reduce((sum, item) => sum + (item?.estimatedCost || 0), 0)
    const totalSale = workItems?.reduce((sum, item) => sum + (item?.salePrice || 0), 0)
    const totalProfit = totalSale - totalCost

    return {
      totalItems: workItems?.length,
      completedItems: completedItems?.length,
      pendingItems: workItems?.filter((item) => item?.status === 'Pending')?.length,
      inProgressItems: workItems?.filter((item) => item?.status === 'In Progress')?.length,
      totalCost,
      totalSale,
      totalProfit,
    }
  }

  const previewData = getPreviewData()

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1">
      <div className="p-4 border-b border-border">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-accent/10 rounded-lg">
            <Icon name="Download" size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Export Reports</h3>
            <p className="text-xs text-muted-foreground">Generate customer and internal reports</p>
          </div>
        </div>
      </div>
      <div className="p-4 space-y-4">
        {/* Export Configuration */}
        <div className="grid grid-cols-1 gap-4">
          <Select
            label="Export Format"
            options={formatOptions}
            value={exportFormat}
            onChange={setExportFormat}
          />

          <Select
            label="Report Type"
            options={typeOptions}
            value={exportType}
            onChange={setExportType}
          />
        </div>

        {/* Preview Summary */}
        <div className="bg-muted/30 rounded-lg p-4">
          <h4 className="text-sm font-medium text-foreground mb-3">Export Preview</h4>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Items:</span>
                <span className="text-foreground font-medium">{previewData?.totalItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Completed:</span>
                <span className="text-success font-medium">{previewData?.completedItems}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">In Progress:</span>
                <span className="text-warning font-medium">{previewData?.inProgressItems}</span>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Cost:</span>
                <span className="text-foreground font-medium">
                  ${previewData?.totalCost?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Sale:</span>
                <span className="text-foreground font-medium">
                  ${previewData?.totalSale?.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Profit:</span>
                <span
                  className={`font-medium ${previewData?.totalProfit >= 0 ? 'text-success' : 'text-error'}`}
                >
                  ${previewData?.totalProfit?.toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Export Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="text-xs text-muted-foreground">
            Report will include vehicle details and {exportType} information
          </div>

          <Button
            variant="default"
            size="sm"
            onClick={handleExport}
            disabled={isExporting}
            loading={isExporting}
            iconName="Download"
            iconPosition="left"
          >
            {isExporting ? 'Generating...' : 'Export Report'}
          </Button>
        </div>

        {/* Quick Export Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
          <span className="text-xs text-muted-foreground mr-2">Quick Export:</span>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setExportFormat('pdf')
              setExportType('summary')
              handleExport()
            }}
            iconName="FileText"
            iconPosition="left"
          >
            Customer Summary
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => {
              setExportFormat('xlsx')
              setExportType('financial')
              handleExport()
            }}
            iconName="DollarSign"
            iconPosition="left"
          >
            Financial Report
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ExportPanel
