import React, { useState } from 'react'
import {
  Calendar,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  Filter,
  ChevronDown,
  ChevronRight,
  Activity,
} from 'lucide-react'

const VendorSidebar = ({
  vendors = [],
  selectedVendors = [],
  onVendorToggle,
  overviewStats = {},
  conflicts = [],
  onQuickAdd,
}) => {
  const [expandedSections, setExpandedSections] = useState({
    overview: true,
    vendors: true,
    conflicts: true,
    upcoming: true,
  })

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev?.[section],
    }))
  }

  const handleVendorToggle = (vendorId) => {
    const newSelection = selectedVendors?.includes(vendorId)
      ? selectedVendors?.filter((id) => id !== vendorId)
      : [...selectedVendors, vendorId]

    onVendorToggle?.(newSelection)
  }

  const clearAllFilters = () => {
    onVendorToggle?.([])
  }

  const selectAllVendors = () => {
    onVendorToggle?.(vendors?.map((v) => v?.id))
  }

  // Section component
  const SidebarSection = ({ title, icon: IconComponent, expanded, onToggle, children, badge }) => (
    <div className="border-b border-gray-200 last:border-b-0">
      <button
        onClick={() => onToggle()}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <IconComponent className="h-4 w-4 text-gray-600" />
          <span className="font-medium text-gray-900">{title}</span>
          {badge !== undefined && (
            <span
              className={`
              px-2 py-1 text-xs rounded-full font-medium
              ${badge > 0 ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}
            `}
            >
              {badge}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronDown className="h-4 w-4 text-gray-400" />
        ) : (
          <ChevronRight className="h-4 w-4 text-gray-400" />
        )}
      </button>

      {expanded && <div className="px-4 pb-4">{children}</div>}
    </div>
  )

  return (
    <div className="w-1/4 bg-white border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Schedule Control</h2>
          <button
            onClick={onQuickAdd}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Quick Add Job"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Overview Stats */}
        <SidebarSection
          title="Overview"
          icon={Activity}
          expanded={expandedSections?.overview}
          onToggle={() => toggleSection('overview')}
        >
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-blue-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-blue-600">
                {overviewStats?.totalJobs || 0}
              </div>
              <div className="text-xs text-blue-700">Total Jobs</div>
            </div>

            <div className="bg-green-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-green-600">
                {overviewStats?.scheduledToday || 0}
              </div>
              <div className="text-xs text-green-700">Today</div>
            </div>

            <div className="bg-red-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-red-600">
                {overviewStats?.overdueJobs || 0}
              </div>
              <div className="text-xs text-red-700">Overdue</div>
            </div>

            <div className="bg-purple-50 rounded-lg p-3 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {overviewStats?.availableVendors || 0}
              </div>
              <div className="text-xs text-purple-700">Vendors</div>
            </div>
          </div>
        </SidebarSection>

        {/* Vendor Filter */}
        <SidebarSection
          title="Vendor Filter"
          icon={Filter}
          expanded={expandedSections?.vendors}
          onToggle={() => toggleSection('vendors')}
          badge={selectedVendors?.length}
        >
          <div className="space-y-3">
            {/* Filter controls */}
            <div className="flex space-x-2">
              <button
                onClick={selectAllVendors}
                className="text-xs px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
              >
                Select All
              </button>
              <button
                onClick={clearAllFilters}
                className="text-xs px-2 py-1 text-gray-600 hover:bg-gray-50 rounded transition-colors"
              >
                Clear All
              </button>
            </div>

            {/* Vendor list */}
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {vendors?.map((vendor) => (
                <label
                  key={vendor?.id}
                  className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
                >
                  <input
                    type="checkbox"
                    checked={selectedVendors?.includes(vendor?.id)}
                    onChange={() => handleVendorToggle(vendor?.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{vendor?.name}</div>
                    <div className="text-xs text-gray-500">
                      {vendor?.specialty || 'General Services'}
                    </div>
                  </div>
                  <div className="w-3 h-3 rounded-full bg-green-500" title="Active" />
                </label>
              ))}

              {vendors?.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-4">No vendors available</div>
              )}
            </div>
          </div>
        </SidebarSection>

        {/* Scheduling Conflicts */}
        <SidebarSection
          title="Conflicts"
          icon={AlertTriangle}
          expanded={expandedSections?.conflicts}
          onToggle={() => toggleSection('conflicts')}
          badge={conflicts?.length}
        >
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {conflicts?.length === 0 ? (
              <div className="flex items-center space-x-2 text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span className="text-sm">No conflicts detected</span>
              </div>
            ) : (
              conflicts?.map((conflict, index) => (
                <div key={index} className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertTriangle className="h-4 w-4 text-red-500 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-red-800 truncate">
                        Vendor Overlap
                      </div>
                      <div className="text-xs text-red-600 mt-1">
                        {conflict?.job1?.title} conflicts with {conflict?.job2?.title}
                      </div>
                      <div className="text-xs text-red-500 mt-1">
                        {conflict?.job1?.scheduled_start_time &&
                          new Date(conflict.job1.scheduled_start_time)?.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}{' '}
                        -
                        {conflict?.job1?.scheduled_end_time &&
                          new Date(conflict.job1.scheduled_end_time)?.toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </SidebarSection>

        {/* Upcoming Appointments */}
        <SidebarSection
          title="Upcoming"
          icon={Clock}
          expanded={expandedSections?.upcoming}
          onToggle={() => toggleSection('upcoming')}
        >
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {/* This would be populated with upcoming appointments */}
            <div className="text-center text-gray-500 text-sm py-4">
              <Calendar className="h-8 w-8 mx-auto text-gray-400 mb-2" />
              Upcoming appointments will appear here
            </div>
          </div>
        </SidebarSection>
      </div>
      {/* Quick Actions Footer */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={onQuickAdd}
          className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm font-medium">Schedule New Job</span>
        </button>
      </div>
    </div>
  )
}

export default VendorSidebar
