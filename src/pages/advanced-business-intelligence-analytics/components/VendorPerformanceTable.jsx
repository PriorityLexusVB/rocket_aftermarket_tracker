import React, { useState } from 'react'
import { Users, Star, DollarSign, Package, CheckCircle, AlertCircle } from 'lucide-react'

const VendorPerformanceTable = ({ data }) => {
  const [sortBy, setSortBy] = useState('total_revenue')
  const [sortOrder, setSortOrder] = useState('desc')
  const [filterBy, setFilterBy] = useState('all')

  // Sort and filter data
  const processedData = React.useMemo(() => {
    let filtered = data || []

    if (filterBy !== 'all') {
      switch (filterBy) {
        case 'high_performance':
          filtered = filtered?.filter((vendor) => vendor?.completion_rate >= 90)
          break
        case 'medium_performance':
          filtered = filtered?.filter(
            (vendor) => vendor?.completion_rate >= 70 && vendor?.completion_rate < 90
          )
          break
        case 'low_performance':
          filtered = filtered?.filter((vendor) => vendor?.completion_rate < 70)
          break
        default:
          break
      }
    }

    return filtered?.sort((a, b) => {
      const valueA = parseFloat(a?.[sortBy]) || 0
      const valueB = parseFloat(b?.[sortBy]) || 0
      return sortOrder === 'desc' ? valueB - valueA : valueA - valueB
    })
  }, [data, sortBy, sortOrder, filterBy])

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')
    } else {
      setSortBy(field)
      setSortOrder('desc')
    }
  }

  const getSortIcon = (field) => {
    if (sortBy !== field) return null
    return sortOrder === 'desc' ? '↓' : '↑'
  }

  const getRatingStars = (rating) => {
    const stars = []
    const fullStars = Math.floor(rating || 0)
    const hasHalfStar = (rating || 0) % 1 >= 0.5

    for (let i = 0; i < 5; i++) {
      if (i < fullStars) {
        stars?.push(<Star key={i} className="w-4 h-4 fill-yellow-400 text-yellow-400" />)
      } else if (i === fullStars && hasHalfStar) {
        stars?.push(<Star key={i} className="w-4 h-4 fill-yellow-400/50 text-yellow-400" />)
      } else {
        stars?.push(<Star key={i} className="w-4 h-4 text-gray-300" />)
      }
    }
    return stars
  }

  const getCompletionRateColor = (rate) => {
    if (rate >= 90) return 'text-green-600 bg-green-50'
    if (rate >= 70) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getCompletionRateIcon = (rate) => {
    if (rate >= 90) return <CheckCircle className="w-4 h-4" />
    if (rate >= 70) return <AlertCircle className="w-4 h-4" />
    return <AlertCircle className="w-4 h-4" />
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <Users className="w-6 h-6 text-indigo-600 mr-2" />
            Vendor Performance Analysis
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Comprehensive vendor analytics with completion rates and profitability
          </p>
        </div>

        <div className="flex items-center space-x-4">
          <select
            value={filterBy}
            onChange={(e) => setFilterBy(e?.target?.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
          >
            <option value="all">All Vendors</option>
            <option value="high_performance">High Performance (90%+)</option>
            <option value="medium_performance">Medium Performance (70-89%)</option>
            <option value="low_performance">Low Performance (&lt;70%)</option>
          </select>
        </div>
      </div>
      {processedData?.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Vendor</th>
                <th className="text-left py-3 px-4 font-semibold text-gray-700">Specialty</th>
                <th
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('total_jobs_count')}
                >
                  Jobs {getSortIcon('total_jobs_count')}
                </th>
                <th
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('completion_rate')}
                >
                  Completion Rate {getSortIcon('completion_rate')}
                </th>
                <th
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('total_products_sold')}
                >
                  Units Sold {getSortIcon('total_products_sold')}
                </th>
                <th
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('total_revenue')}
                >
                  Total Revenue {getSortIcon('total_revenue')}
                </th>
                <th
                  className="text-left py-3 px-4 font-semibold text-gray-700 cursor-pointer hover:text-indigo-600 transition-colors"
                  onClick={() => handleSort('avg_job_value')}
                >
                  Avg Job Value {getSortIcon('avg_job_value')}
                </th>
              </tr>
            </thead>
            <tbody>
              {processedData?.map((vendor, index) => (
                <tr
                  key={vendor?.vendor_id}
                  className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                  }`}
                >
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-semibold text-gray-900 mb-1">{vendor?.vendor_name}</div>
                      <div className="flex items-center space-x-1">
                        {getRatingStars(vendor?.rating)}
                        <span className="text-sm text-gray-500 ml-2">
                          ({vendor?.rating?.toFixed(1) || 'N/A'})
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <span className="px-2 py-1 bg-indigo-100 text-indigo-800 rounded-full text-xs font-medium">
                      {vendor?.specialty || 'General'}
                    </span>
                  </td>
                  <td className="py-4 px-4">
                    <div>
                      <div className="font-semibold text-gray-900">{vendor?.total_jobs_count}</div>
                      <div className="text-sm text-green-600">
                        {vendor?.completed_jobs_count} completed
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div
                      className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getCompletionRateColor(vendor?.completion_rate)}`}
                    >
                      {getCompletionRateIcon(vendor?.completion_rate)}
                      <span className="font-semibold text-sm">
                        {vendor?.completion_rate?.toFixed(1) || 0}%
                      </span>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <Package className="w-4 h-4 text-blue-500 mr-2" />
                      <div>
                        <div className="font-semibold text-gray-900">
                          {vendor?.total_products_sold}
                        </div>
                        <div className="text-sm text-gray-500">
                          from {vendor?.total_products_count} products
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="flex items-center">
                      <DollarSign className="w-4 h-4 text-green-500 mr-1" />
                      <div>
                        <div className="font-semibold text-green-600">
                          ${parseFloat(vendor?.total_revenue)?.toLocaleString()}
                        </div>
                        <div className="text-sm text-gray-500">
                          Jobs: ${parseFloat(vendor?.total_job_revenue)?.toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="py-4 px-4">
                    <div className="font-semibold text-gray-900">
                      ${parseFloat(vendor?.avg_job_value)?.toLocaleString()}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-500 mb-2">No Vendor Data</h3>
          <p className="text-gray-400">
            {filterBy === 'all'
              ? 'No vendor performance data available'
              : `No vendors match the selected performance criteria`}
          </p>
        </div>
      )}
      {/* Summary Stats */}
      {processedData?.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{processedData?.length}</div>
              <div className="text-sm text-gray-600">Active Vendors</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {(
                  processedData?.reduce((sum, v) => sum + (v?.completion_rate || 0), 0) /
                  processedData?.length
                )?.toFixed(1)}
                %
              </div>
              <div className="text-sm text-gray-600">Avg Completion Rate</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {processedData
                  ?.reduce((sum, v) => sum + (v?.total_products_sold || 0), 0)
                  ?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Units Sold</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                $
                {processedData
                  ?.reduce((sum, v) => sum + (parseFloat(v?.total_revenue) || 0), 0)
                  ?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default VendorPerformanceTable
