import React, { useState, useEffect } from 'react'

import Button from '../../../components/ui/Button'
import Input from '../../../components/ui/Input'
import Select from '../../../components/ui/Select'

const ReportBuilder = ({ onFilterChange, onExport, isExporting }) => {
  const [filters, setFilters] = useState({
    dateRange: 'last30days',
    startDate: '',
    endDate: '',
    vendors: [],
    products: [],
    profitThreshold: '',
    status: [],
    reportType: 'sales_summary',
  })

  const [savedFilters, setSavedFilters] = useState([])
  const [filterName, setFilterName] = useState('')
  const [showSaveDialog, setShowSaveDialog] = useState(false)

  useEffect(() => {
    const saved = localStorage.getItem('saved-report-filters')
    if (saved) {
      setSavedFilters(JSON.parse(saved))
    }
  }, [])

  const dateRangeOptions = [
    { value: 'today', label: 'Today' },
    { value: 'yesterday', label: 'Yesterday' },
    { value: 'last7days', label: 'Last 7 Days' },
    { value: 'last30days', label: 'Last 30 Days' },
    { value: 'last90days', label: 'Last 90 Days' },
    { value: 'thisMonth', label: 'This Month' },
    { value: 'lastMonth', label: 'Last Month' },
    { value: 'thisYear', label: 'This Year' },
    { value: 'custom', label: 'Custom Range' },
  ]

  const vendorOptions = [
    { value: 'toughguard_pro', label: 'ToughGuard Pro Services' },
    { value: 'evernew_solutions', label: 'Evernew Solutions LLC' },
    { value: 'crystal_clear', label: 'Crystal Clear Windshield' },
    { value: 'premium_tint', label: 'Premium Tint Masters' },
    { value: 'wrap_masters', label: 'Wrap Masters Studio' },
    { value: 'auto_shield', label: 'Auto Shield Protection' },
  ]

  const productOptions = [
    { value: 'toughguard', label: 'ToughGuard Protection' },
    { value: 'evernew', label: 'Evernew Coating' },
    { value: 'windshield', label: 'Windshield Protection' },
    { value: 'tint', label: 'Window Tinting' },
    { value: 'wraps', label: 'Vehicle Wraps' },
    { value: 'ceramic', label: 'Ceramic Coating' },
  ]

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' },
  ]

  const reportTypeOptions = [
    { value: 'sales_summary', label: 'Sales Summary Report' },
    { value: 'vendor_performance', label: 'Vendor Performance Analysis' },
    { value: 'product_profitability', label: 'Product Profitability Rankings' },
    { value: 'operational_efficiency', label: 'Operational Efficiency Metrics' },
    { value: 'financial_overview', label: 'Financial Overview Report' },
  ]

  const handleFilterChange = (key, value) => {
    const newFilters = { ...filters, [key]: value }
    setFilters(newFilters)
    onFilterChange(newFilters)
  }

  const handleSaveFilter = () => {
    if (!filterName?.trim()) return

    const newSavedFilter = {
      id: Date.now(),
      name: filterName,
      filters: { ...filters },
      createdAt: new Date()?.toISOString(),
    }

    const updatedSaved = [...savedFilters, newSavedFilter]
    setSavedFilters(updatedSaved)
    localStorage.setItem('saved-report-filters', JSON.stringify(updatedSaved))
    setFilterName('')
    setShowSaveDialog(false)
  }

  const handleLoadFilter = (savedFilter) => {
    setFilters(savedFilter?.filters)
    onFilterChange(savedFilter?.filters)
  }

  const handleDeleteSavedFilter = (filterId) => {
    const updatedSaved = savedFilters?.filter((f) => f?.id !== filterId)
    setSavedFilters(updatedSaved)
    localStorage.setItem('saved-report-filters', JSON.stringify(updatedSaved))
  }

  const resetFilters = () => {
    const defaultFilters = {
      dateRange: 'last30days',
      startDate: '',
      endDate: '',
      vendors: [],
      products: [],
      profitThreshold: '',
      status: [],
      reportType: 'sales_summary',
    }
    setFilters(defaultFilters)
    onFilterChange(defaultFilters)
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1 h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Report Builder</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Configure filters and generate custom reports
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            iconName="RotateCcw"
            iconPosition="left"
          >
            Reset
          </Button>
        </div>
      </div>
      {/* Filters */}
      <div className="flex-1 p-6 space-y-6 overflow-y-auto">
        {/* Report Type */}
        <div>
          <Select
            label="Report Type"
            options={reportTypeOptions}
            value={filters?.reportType}
            onChange={(value) => handleFilterChange('reportType', value)}
            required
          />
        </div>

        {/* Date Range */}
        <div>
          <Select
            label="Date Range"
            options={dateRangeOptions}
            value={filters?.dateRange}
            onChange={(value) => handleFilterChange('dateRange', value)}
          />

          {filters?.dateRange === 'custom' && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <Input
                label="Start Date"
                type="date"
                value={filters?.startDate}
                onChange={(e) => handleFilterChange('startDate', e?.target?.value)}
              />
              <Input
                label="End Date"
                type="date"
                value={filters?.endDate}
                onChange={(e) => handleFilterChange('endDate', e?.target?.value)}
              />
            </div>
          )}
        </div>

        {/* Vendors */}
        <div>
          <Select
            label="Vendors"
            description="Select specific vendors to include"
            options={vendorOptions}
            value={filters?.vendors}
            onChange={(value) => handleFilterChange('vendors', value)}
            multiple
            searchable
            clearable
          />
        </div>

        {/* Products */}
        <div>
          <Select
            label="Products"
            description="Filter by product categories"
            options={productOptions}
            value={filters?.products}
            onChange={(value) => handleFilterChange('products', value)}
            multiple
            searchable
            clearable
          />
        </div>

        {/* Status */}
        <div>
          <Select
            label="Job Status"
            description="Include specific job statuses"
            options={statusOptions}
            value={filters?.status}
            onChange={(value) => handleFilterChange('status', value)}
            multiple
            clearable
          />
        </div>

        {/* Profit Threshold */}
        <div>
          <Input
            label="Minimum Profit Threshold"
            type="number"
            placeholder="Enter minimum profit amount"
            value={filters?.profitThreshold}
            onChange={(e) => handleFilterChange('profitThreshold', e?.target?.value)}
            description="Only include records above this profit amount"
          />
        </div>

        {/* Saved Filters */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-foreground">Saved Filter Templates</label>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSaveDialog(!showSaveDialog)}
              iconName="Plus"
              iconPosition="left"
            >
              Save Current
            </Button>
          </div>

          {showSaveDialog && (
            <div className="mb-4 p-4 bg-muted rounded-lg">
              <Input
                label="Filter Name"
                placeholder="Enter filter template name"
                value={filterName}
                onChange={(e) => setFilterName(e?.target?.value)}
                className="mb-3"
              />
              <div className="flex space-x-2">
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleSaveFilter}
                  disabled={!filterName?.trim()}
                >
                  Save
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowSaveDialog(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}

          <div className="space-y-2 max-h-40 overflow-y-auto">
            {savedFilters?.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">No saved filter templates</p>
            ) : (
              savedFilters?.map((savedFilter) => (
                <div
                  key={savedFilter?.id}
                  className="flex items-center justify-between p-3 bg-muted rounded-lg"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {savedFilter?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Created {new Date(savedFilter.createdAt)?.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-1 ml-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleLoadFilter(savedFilter)}
                      iconName="Download"
                    />
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSavedFilter(savedFilter?.id)}
                      iconName="Trash2"
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
      {/* Export Actions */}
      <div className="p-6 border-t border-border">
        <div className="space-y-3">
          <Button
            variant="default"
            onClick={() => onExport('csv')}
            disabled={isExporting}
            loading={isExporting}
            iconName="Download"
            iconPosition="left"
            fullWidth
          >
            Export as CSV
          </Button>
          <Button
            variant="outline"
            onClick={() => onExport('excel')}
            disabled={isExporting}
            iconName="FileSpreadsheet"
            iconPosition="left"
            fullWidth
          >
            Export as Excel
          </Button>
          <Button
            variant="outline"
            onClick={() => onExport('pdf')}
            disabled={isExporting}
            iconName="FileText"
            iconPosition="left"
            fullWidth
          >
            Export as PDF
          </Button>
        </div>
      </div>
    </div>
  )
}

export default ReportBuilder
