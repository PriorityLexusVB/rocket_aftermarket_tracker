import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  AreaChart,
  Area,
} from 'recharts'
import { TrendingUp } from 'lucide-react'

const SalesTrendsChart = ({ data, timeframe }) => {
  const getTimeframeLabel = () => {
    switch (timeframe) {
      case '1month':
        return 'Last 1 Month'
      case '3months':
        return 'Last 3 Months'
      case '6months':
        return 'Last 6 Months'
      case '1year':
        return 'Last 1 Year'
      default:
        return 'Last 6 Months'
    }
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      const data = payload?.[0]?.payload
      return (
        <div className="bg-white p-4 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{data?.month_name}</p>
          <div className="space-y-1">
            <p className="text-green-600">Revenue: ${data?.total_revenue}</p>
            <p className="text-blue-600">Quantity: {data?.total_quantity}</p>
            <p className="text-purple-600">Products: {data?.products_sold}</p>
          </div>
        </div>
      )
    }
    return null
  }

  const CategoryTooltip = ({ active, payload, label }) => {
    if (active && payload && payload?.length) {
      return (
        <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload?.map((entry, index) => (
            <p key={index} style={{ color: entry?.color }}>
              {entry?.dataKey}: ${entry?.value}
            </p>
          ))}
        </div>
      )
    }
    return null
  }

  // Calculate trend indicators
  const calculateTrend = () => {
    if (!data || data?.length < 2) return { revenue: 0, quantity: 0 }

    const latest = data?.[data?.length - 1]
    const previous = data?.[data?.length - 2]

    const revenueTrend =
      latest?.total_revenue > previous?.total_revenue
        ? (
            ((latest?.total_revenue - previous?.total_revenue) / previous?.total_revenue) *
            100
          )?.toFixed(1)
        : -(
            ((previous?.total_revenue - latest?.total_revenue) / previous?.total_revenue) *
            100
          )?.toFixed(1)

    const quantityTrend =
      latest?.total_quantity > previous?.total_quantity
        ? (
            ((latest?.total_quantity - previous?.total_quantity) / previous?.total_quantity) *
            100
          )?.toFixed(1)
        : -(
            ((previous?.total_quantity - latest?.total_quantity) / previous?.total_quantity) *
            100
          )?.toFixed(1)

    return {
      revenue: parseFloat(revenueTrend),
      quantity: parseFloat(quantityTrend),
    }
  }

  const trends = calculateTrend()

  // Prepare category data for stacked area chart
  const prepareCategoryData = () => {
    if (!data || data?.length === 0) return []

    // Get all unique categories
    const allCategories = new Set()
    data?.forEach((month) => {
      month?.categories?.forEach((cat) => allCategories?.add(cat?.name))
    })

    // Create colors for categories
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f97316']
    const categoryColors = {}
    Array.from(allCategories)?.forEach((cat, index) => {
      categoryColors[cat] = colors?.[index % colors?.length]
    })

    // Transform data for stacked chart
    return data?.map((month) => {
      const result = { month_name: month?.month_name }
      month?.categories?.forEach((cat) => {
        result[cat.name] = parseFloat(cat?.value)
      })
      return result
    })
  }

  const categoryData = prepareCategoryData()
  const allCategories =
    categoryData?.length > 0
      ? Object.keys(categoryData?.[0])?.filter((key) => key !== 'month_name')
      : []

  const categoryColors = [
    '#3b82f6',
    '#10b981',
    '#f59e0b',
    '#ef4444',
    '#8b5cf6',
    '#06b6d4',
    '#f97316',
  ]

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-gray-900 flex items-center">
            <TrendingUp className="w-6 h-6 text-indigo-600 mr-2" />
            Sales Trends Analysis
          </h3>
          <p className="text-gray-600 text-sm mt-1">
            Time-series visualization with seasonal trends • {getTimeframeLabel()}
          </p>
        </div>

        {data && data?.length > 1 && (
          <div className="flex items-center space-x-4">
            <div className="text-center">
              <div
                className={`text-lg font-bold ${trends?.revenue >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {trends?.revenue >= 0 ? '+' : ''}
                {trends?.revenue}%
              </div>
              <div className="text-sm text-gray-600">Revenue Trend</div>
            </div>
            <div className="text-center">
              <div
                className={`text-lg font-bold ${trends?.quantity >= 0 ? 'text-green-600' : 'text-red-600'}`}
              >
                {trends?.quantity >= 0 ? '+' : ''}
                {trends?.quantity}%
              </div>
              <div className="text-sm text-gray-600">Quantity Trend</div>
            </div>
          </div>
        )}
      </div>
      {/* Main Trends Chart */}
      <div className="mb-8">
        <h4 className="text-lg font-semibold text-gray-800 mb-4">Revenue & Quantity Trends</h4>
        {data && data?.length > 0 ? (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month_name"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis yAxisId="left" />
                <YAxis yAxisId="right" orientation="right" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  yAxisId="left"
                  type="monotone"
                  dataKey="total_revenue"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', strokeWidth: 2, r: 4 }}
                  name="Revenue ($)"
                />
                <Line
                  yAxisId="right"
                  type="monotone"
                  dataKey="total_quantity"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={{ fill: '#3b82f6', strokeWidth: 2, r: 4 }}
                  name="Quantity Sold"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-80 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-300" />
              <p>No sales trend data available for the selected timeframe</p>
            </div>
          </div>
        )}
      </div>
      {/* Category Breakdown Chart */}
      {categoryData?.length > 0 && allCategories?.length > 0 && (
        <div>
          <h4 className="text-lg font-semibold text-gray-800 mb-4">Revenue by Product Category</h4>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={categoryData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="month_name"
                  tick={{ fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis />
                <Tooltip content={<CategoryTooltip />} />
                <Legend />
                {allCategories?.map((category, index) => (
                  <Area
                    key={category}
                    type="monotone"
                    dataKey={category}
                    stackId="1"
                    stroke={categoryColors?.[index % categoryColors?.length]}
                    fill={categoryColors?.[index % categoryColors?.length]}
                    fillOpacity={0.7}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
      {/* Summary Statistics */}
      {data && data?.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-indigo-600">{data?.length}</div>
              <div className="text-sm text-gray-600">Months Analyzed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                $
                {data
                  ?.reduce((sum, month) => sum + parseFloat(month?.total_revenue || 0), 0)
                  ?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Revenue</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {data
                  ?.reduce((sum, month) => sum + (month?.total_quantity || 0), 0)
                  ?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Total Quantity</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                $
                {(
                  data?.reduce((sum, month) => sum + parseFloat(month?.total_revenue || 0), 0) /
                  data?.length
                )?.toLocaleString()}
              </div>
              <div className="text-sm text-gray-600">Avg Monthly Revenue</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SalesTrendsChart
