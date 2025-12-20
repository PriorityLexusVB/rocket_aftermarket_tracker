import React from 'react'
import { Filter } from 'lucide-react'

const FilterPanel = ({
  vendors = [],
  filters = { vendors: [], priorities: [], overdue: false, dateRange: 'all' },
  onFiltersChange,
  onClearFilters,
  className = '',
}) => {
  const priorities = ['low', 'medium', 'high', 'urgent']
  const dateRanges = [
    { value: 'all', label: 'All Time' },
    { value: 'today', label: 'Today' },
    { value: 'week', label: 'This Week' },
    { value: 'month', label: 'This Month' },
  ]

  const handleVendorChange = (vendorId, checked) => {
    const newVendors = checked
      ? [...filters?.vendors, vendorId]
      : filters?.vendors?.filter((id) => id !== vendorId)

    onFiltersChange?.({
      ...filters,
      vendors: newVendors,
    })
  }

  const handlePriorityChange = (priority, checked) => {
    const newPriorities = checked
      ? [...filters?.priorities, priority]
      : filters?.priorities?.filter((p) => p !== priority)

    onFiltersChange?.({
      ...filters,
      priorities: newPriorities,
    })
  }

  const handleDateRangeChange = (dateRange) => {
    onFiltersChange?.({
      ...filters,
      dateRange,
    })
  }

  const handleOverdueChange = (checked) => {
    onFiltersChange?.({
      ...filters,
      overdue: checked,
    })
  }

  const getActiveFiltersCount = () => {
    return (
      filters?.vendors?.length +
      filters?.priorities?.length +
      (filters?.overdue ? 1 : 0) +
      (filters?.dateRange !== 'all' ? 1 : 0)
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-4 w-4 text-gray-600" />
          <h3 className="font-medium text-gray-900">Filters</h3>
          {getActiveFiltersCount() > 0 && (
            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
              {getActiveFiltersCount()} active
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={onClearFilters}
            disabled={getActiveFiltersCount() === 0}
            className="text-sm text-gray-600 hover:text-gray-900 disabled:text-gray-400 disabled:cursor-not-allowed"
          >
            Clear All
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Vendors Filter */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Vendors</h4>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {vendors?.map((vendor) => (
              <label key={vendor?.id} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters?.vendors?.includes(vendor?.id)}
                  onChange={(e) => handleVendorChange(vendor?.id, e?.target?.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600 truncate">{vendor?.name}</span>
              </label>
            ))}
            {vendors?.length === 0 && <p className="text-sm text-gray-400">No vendors available</p>}
          </div>
        </div>

        {/* Priority Filter */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Priority</h4>
          <div className="space-y-2">
            {priorities?.map((priority) => (
              <label key={priority} className="flex items-center">
                <input
                  type="checkbox"
                  checked={filters?.priorities?.includes(priority)}
                  onChange={(e) => handlePriorityChange(priority, e?.target?.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600 capitalize">{priority}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Date Range</h4>
          <div className="space-y-2">
            {dateRanges?.map((range) => (
              <label key={range?.value} className="flex items-center">
                <input
                  type="radio"
                  name="dateRange"
                  value={range?.value}
                  checked={filters?.dateRange === range?.value}
                  onChange={() => handleDateRangeChange(range?.value)}
                  className="border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="ml-2 text-sm text-gray-600">{range?.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Special Filters */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-700">Special</h4>
          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={filters?.overdue}
                onChange={(e) => handleOverdueChange(e?.target?.checked)}
                className="rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="ml-2 text-sm text-gray-600">Overdue Jobs</span>
            </label>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="text-xs text-gray-500">Quick filters for common views</div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() =>
                onFiltersChange?.({
                  vendors: [],
                  priorities: ['urgent', 'high'],
                  overdue: false,
                  dateRange: 'week',
                })
              }
              className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded hover:bg-orange-200 transition-colors"
            >
              High Priority
            </button>

            <button
              onClick={() =>
                onFiltersChange?.({
                  vendors: [],
                  priorities: [],
                  overdue: true,
                  dateRange: 'all',
                })
              }
              className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded hover:bg-red-200 transition-colors"
            >
              Overdue Only
            </button>

            <button
              onClick={() =>
                onFiltersChange?.({
                  vendors: [],
                  priorities: [],
                  overdue: false,
                  dateRange: 'today',
                })
              }
              className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded hover:bg-blue-200 transition-colors"
            >
              Today's Jobs
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default FilterPanel
