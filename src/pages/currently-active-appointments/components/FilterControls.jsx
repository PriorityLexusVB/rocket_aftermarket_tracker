import React from 'react'
import { Filter, Building2, Star } from 'lucide-react'

const FilterControls = ({
  statusFilter,
  setStatusFilter,
  vendorFilter,
  setVendorFilter,
  priorityFilter,
  setPriorityFilter,
  vendors,
}) => {
  return (
    <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl border border-gray-200/50 p-6 mb-6">
      <div className="flex items-center space-x-2 mb-4">
        <Filter className="w-5 h-5 text-gray-600" />
        <h3 className="font-semibold text-gray-900">Filter Appointments</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Status Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e?.target?.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 appearance-none cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="scheduled">Scheduled</option>
            <option value="in_progress">In Progress</option>
            <option value="quality_check">Quality Check</option>
            <option value="pending">Pending</option>
            <option value="overdue">Overdue Items</option>
          </select>
        </div>

        {/* Vendor Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
            <Building2 className="w-4 h-4" />
            <span>Vendor</span>
          </label>
          <select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e?.target?.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 appearance-none cursor-pointer"
          >
            <option value="all">All Vendors</option>
            {vendors?.map((vendor) => (
              <option key={vendor?.id} value={vendor?.id}>
                {vendor?.name}
              </option>
            ))}
          </select>
        </div>

        {/* Priority Filter */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-gray-700 flex items-center space-x-1">
            <Star className="w-4 h-4" />
            <span>Priority</span>
          </label>
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e?.target?.value)}
            className="w-full p-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white text-gray-900 appearance-none cursor-pointer"
          >
            <option value="all">All Priorities</option>
            <option value="urgent">🔴 Urgent</option>
            <option value="high">🟠 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
          </select>
        </div>
      </div>

      {/* Active Filters Display */}
      <div className="flex items-center space-x-2 mt-4">
        {(statusFilter !== 'all' || vendorFilter !== 'all' || priorityFilter !== 'all') && (
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">Active filters:</span>

            {statusFilter !== 'all' && (
              <div className="inline-flex items-center px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                <span>Status: {statusFilter?.replace('_', ' ')}</span>
                <button
                  onClick={() => setStatusFilter('all')}
                  className="ml-2 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </div>
            )}

            {vendorFilter !== 'all' && (
              <div className="inline-flex items-center px-3 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                <span>Vendor: {vendors?.find((v) => v?.id === vendorFilter)?.name}</span>
                <button
                  onClick={() => setVendorFilter('all')}
                  className="ml-2 text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </div>
            )}

            {priorityFilter !== 'all' && (
              <div className="inline-flex items-center px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium">
                <span>Priority: {priorityFilter}</span>
                <button
                  onClick={() => setPriorityFilter('all')}
                  className="ml-2 text-purple-600 hover:text-purple-800"
                >
                  ×
                </button>
              </div>
            )}

            <button
              onClick={() => {
                setStatusFilter('all')
                setVendorFilter('all')
                setPriorityFilter('all')
              }}
              className="text-sm text-gray-600 hover:text-gray-800 font-medium"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default FilterControls
