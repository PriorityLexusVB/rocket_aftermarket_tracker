import React, { useState, useEffect } from 'react'
import {
  BarChart3,
  TrendingUp,
  Clock,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  PieChart,
} from 'lucide-react'
import claimsAnalyticsService from '../../services/claimsAnalyticsService'
import MetricCard from './components/MetricCard'
import ClaimsDistributionChart from './components/ClaimsDistributionChart'
import ResolutionTrendsChart from './components/ResolutionTrendsChart'
import VendorPerformanceMatrix from './components/VendorPerformanceMatrix'
import SeasonalHeatMap from './components/SeasonalHeatMap'
import FinancialImpactWidget from './components/FinancialImpactWidget'
import AdvancedFilters from '../../components/common/AdvancedFilters'
import ExportButton from '../../components/common/ExportButton'

const ClaimsAnalyticsDashboard = () => {
  const [dashboardData, setDashboardData] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [timeframe, setTimeframe] = useState('6months')
  const [selectedFilters, setSelectedFilters] = useState({})
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)

  useEffect(() => {
    loadDashboardData()
  }, [timeframe])

  const loadDashboardData = async () => {
    try {
      setLoading(true)
      setError('')
      const data = await claimsAnalyticsService?.getDashboardSummary()
      setDashboardData(data)
      setLastUpdated(new Date())
    } catch (err) {
      console.error('Claims analytics dashboard load failed:', err)
      setError('Failed to load claims analytics dashboard. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData()
    setRefreshing(false)
  }

  const handleTimeframeChange = (newTimeframe) => {
    setTimeframe(newTimeframe)
  }

  const handleFilterChange = (filters) => {
    setSelectedFilters(filters)
  }

  const handleClearFilters = () => {
    setSelectedFilters({})
  }

  const handleExport = () => {
    const exportData = {
      overview_metrics: dashboardData?.overview_metrics,
      product_claims: dashboardData?.product_claims_distribution,
      vendor_performance: dashboardData?.vendor_performance,
      financial_impact: dashboardData?.financial_impact,
      generated_at: new Date()?.toISOString(),
    }

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `claims-analytics-${new Date()?.toISOString()?.split('T')?.[0]}.json`
    document.body?.appendChild(a)
    a?.click()
    document.body?.removeChild(a)
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading claims analytics dashboard...</p>
        </div>
      </div>
    )
  }

  const {
    overview_metrics = {},
    product_claims_distribution = [],
    resolution_trends = [],
    vendor_performance = [],
    seasonal_patterns = { monthly: [], seasonal: [] },
    financial_impact = {},
  } = dashboardData

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <BarChart3 className="h-8 w-8 text-blue-600" />
              Claims Analytics Dashboard
            </h1>
            <p className="text-gray-600 mt-1">
              Comprehensive insights into claim patterns, resolution performance, and financial
              impact
            </p>
          </div>

          <div className="flex items-center gap-4">
            {lastUpdated && (
              <span className="text-sm text-gray-500">
                Last updated: {lastUpdated?.toLocaleTimeString()}
              </span>
            )}

            <div className="flex items-center gap-2">
              <select
                value={timeframe}
                onChange={(e) => handleTimeframeChange(e?.target?.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="1month">Last Month</option>
                <option value="3months">Last 3 Months</option>
                <option value="6months">Last 6 Months</option>
                <option value="1year">Last Year</option>
              </select>

              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>

              <ExportButton
                onExport={handleExport}
                filename={`claims-analytics-${new Date()?.toISOString()?.split('T')?.[0]}`}
              />
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">{error}</span>
              <button
                onClick={() => setError('')}
                className="ml-auto text-red-600 hover:text-red-800"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Filters */}
      <div className="px-6 py-4 bg-white border-b border-gray-200">
        <AdvancedFilters
          filters={selectedFilters}
          onFiltersChange={handleFilterChange}
          onClearFilters={handleClearFilters}
          pageType="claims"
          className="max-w-6xl"
        />
      </div>
      {/* Main Content */}
      <div className="px-6 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <MetricCard
            title="Total Claims"
            value={overview_metrics?.total_claims?.toLocaleString() || '0'}
            change={overview_metrics?.month_over_month_change || 0}
            changeLabel="vs last month"
            icon={<BarChart3 className="h-6 w-6" />}
            trend="up"
          />

          <MetricCard
            title="Avg Resolution Time"
            value={`${overview_metrics?.avg_resolution_time || 0} days`}
            change={-12.5}
            changeLabel="improvement"
            icon={<Clock className="h-6 w-6" />}
            trend="down"
            positive="down"
          />

          <MetricCard
            title="Approval Rate"
            value={`${overview_metrics?.approval_rate || 0}%`}
            change={overview_metrics?.approval_rate > 85 ? 5.2 : -2.1}
            changeLabel="vs target"
            icon={<TrendingUp className="h-6 w-6" />}
            trend={overview_metrics?.approval_rate > 85 ? 'up' : 'down'}
          />

          <MetricCard
            title="Financial Impact"
            value={`$${overview_metrics?.total_financial_impact || '0'}`}
            change={parseFloat(overview_metrics?.estimated_vs_actual_variance) || 0}
            changeLabel="vs estimated"
            icon={<DollarSign className="h-6 w-6" />}
            trend={parseFloat(overview_metrics?.estimated_vs_actual_variance) > 0 ? 'up' : 'down'}
            positive="down"
          />
        </div>

        {/* Charts Row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ClaimsDistributionChart
            data={product_claims_distribution}
            title="Claim Distribution by Product Type"
          />

          <ResolutionTrendsChart
            data={resolution_trends}
            title="Resolution Time Trends"
            timeframe={timeframe}
          />
        </div>

        {/* Vendor Performance Matrix */}
        <VendorPerformanceMatrix data={vendor_performance} title="Vendor Claim Analysis" />

        {/* Charts Row 2 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SeasonalHeatMap data={seasonal_patterns} title="Seasonal Claim Patterns" />

          <FinancialImpactWidget data={financial_impact} title="Financial Impact Tracking" />
        </div>

        {/* Advanced Analytics Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Advanced Analysis</h3>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <PieChart className="h-4 w-4" />
              Interactive drill-down capabilities
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-4 bg-blue-50 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">Top Failure Patterns</h4>
              <div className="space-y-2">
                {product_claims_distribution?.slice(0, 3)?.map((item, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-blue-800">{item?.category}</span>
                    <span className="font-medium text-blue-900">{item?.total_claims}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-green-50 rounded-lg">
              <h4 className="font-medium text-green-900 mb-2">Best Performing Vendors</h4>
              <div className="space-y-2">
                {vendor_performance?.slice(0, 3)?.map((vendor, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="text-green-800">{vendor?.vendor_name}</span>
                    <span className="font-medium text-green-900">{vendor?.efficiency_score}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-amber-50 rounded-lg">
              <h4 className="font-medium text-amber-900 mb-2">Cost Optimization</h4>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-amber-800">Recovery Rate</span>
                  <span className="font-medium text-amber-900">
                    {financial_impact?.recovery_rate || 0}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-800">Cost Accuracy</span>
                  <span className="font-medium text-amber-900">
                    {financial_impact?.cost_accuracy_rate || 0}%
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-amber-800">Net Impact</span>
                  <span className="font-medium text-amber-900">
                    ${financial_impact?.net_financial_impact || 0}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ClaimsAnalyticsDashboard
