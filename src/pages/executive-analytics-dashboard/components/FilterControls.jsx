import React, { useState } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'
import Select from '../../../components/ui/Select'

const FilterControls = ({ onFiltersChange, onExport, onRefresh, lastUpdated }) => {
  const [dateRange, setDateRange] = useState('30')
  const [department, setDepartment] = useState('all')
  const [productFilter, setProductFilter] = useState('all')
  const [vendorFilter, setVendorFilter] = useState('all')

  const dateRangeOptions = [
    { value: '7', label: 'Last 7 days' },
    { value: '30', label: 'Last 30 days' },
    { value: '90', label: 'Last 90 days' },
    { value: '365', label: 'Last year' },
    { value: 'custom', label: 'Custom range' },
  ]

  const departmentOptions = [
    { value: 'all', label: 'All Departments' },
    { value: 'aftermarket', label: 'Aftermarket' },
    { value: 'service', label: 'Service' },
    { value: 'parts', label: 'Parts' },
  ]

  const productOptions = [
    { value: 'all', label: 'All Products' },
    { value: 'toughguard', label: 'ToughGuard' },
    { value: 'evernew', label: 'Evernew' },
    { value: 'windshield', label: 'Windshield Protection' },
    { value: 'tint', label: 'Window Tint' },
    { value: 'wraps', label: 'Vehicle Wraps' },
  ]

  const vendorOptions = [
    { value: 'all', label: 'All Vendors' },
    { value: 'premium-auto', label: 'Premium Auto Solutions' },
    { value: 'elite-detailing', label: 'Elite Detailing Co.' },
    { value: 'pro-tint', label: 'Pro Tint & Graphics' },
    { value: 'shield-masters', label: 'Shield Masters' },
  ]

  const handleFilterChange = (key, value) => {
    const newFilters = {
      dateRange,
      department,
      productFilter,
      vendorFilter,
      [key]: value,
    }

    switch (key) {
      case 'dateRange':
        setDateRange(value)
        break
      case 'department':
        setDepartment(value)
        break
      case 'productFilter':
        setProductFilter(value)
        break
      case 'vendorFilter':
        setVendorFilter(value)
        break
    }

    onFiltersChange(newFilters)
  }

  const resetFilters = () => {
    setDateRange('30')
    setDepartment('all')
    setProductFilter('all')
    setVendorFilter('all')

    onFiltersChange({
      dateRange: '30',
      department: 'all',
      productFilter: 'all',
      vendorFilter: 'all',
    })
  }

  const formatLastUpdated = (timestamp) => {
    const date = new Date(timestamp)
    return date?.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 shadow-elevation-1 mb-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
        {/* Filter Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4">
          <Select
            label="Date Range"
            options={dateRangeOptions}
            value={dateRange}
            onChange={(value) => handleFilterChange('dateRange', value)}
            className="w-full sm:w-40"
          />

          <Select
            label="Department"
            options={departmentOptions}
            value={department}
            onChange={(value) => handleFilterChange('department', value)}
            className="w-full sm:w-40"
          />

          <Select
            label="Product"
            options={productOptions}
            value={productFilter}
            onChange={(value) => handleFilterChange('productFilter', value)}
            className="w-full sm:w-40"
          />

          <Select
            label="Vendor"
            options={vendorOptions}
            value={vendorFilter}
            onChange={(value) => handleFilterChange('vendorFilter', value)}
            className="w-full sm:w-40"
          />

          <Button
            variant="outline"
            size="sm"
            onClick={resetFilters}
            iconName="RotateCcw"
            iconPosition="left"
            className="w-full sm:w-auto"
          >
            Reset
          </Button>
        </div>

        {/* Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-3">
          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Icon name="Clock" size={14} />
            <span>Updated: {formatLastUpdated(lastUpdated)}</span>
          </div>

          <div className="flex space-x-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              iconName="RefreshCw"
              iconPosition="left"
            >
              Refresh
            </Button>

            <Button
              variant="default"
              size="sm"
              onClick={onExport}
              iconName="Download"
              iconPosition="left"
            >
              Export
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Filters */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center space-x-2 mb-2">
          <Icon name="Filter" size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-muted-foreground">Quick Filters:</span>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="xs"
            onClick={() => handleFilterChange('dateRange', '7')}
            className={dateRange === '7' ? 'bg-primary/10 border-primary text-primary' : ''}
          >
            This Week
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => handleFilterChange('dateRange', '30')}
            className={dateRange === '30' ? 'bg-primary/10 border-primary text-primary' : ''}
          >
            This Month
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => handleFilterChange('productFilter', 'toughguard')}
            className={
              productFilter === 'toughguard' ? 'bg-primary/10 border-primary text-primary' : ''
            }
          >
            Top Product
          </Button>

          <Button
            variant="outline"
            size="xs"
            onClick={() => handleFilterChange('vendorFilter', 'premium-auto')}
            className={
              vendorFilter === 'premium-auto' ? 'bg-primary/10 border-primary text-primary' : ''
            }
          >
            Top Vendor
          </Button>
        </div>
      </div>
    </div>
  )
}

export default FilterControls
