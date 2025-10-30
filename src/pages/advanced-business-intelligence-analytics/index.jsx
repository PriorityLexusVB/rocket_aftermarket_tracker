import React, { useState, useEffect } from 'react';
import { Users, Package, DollarSign, Filter, Download, RefreshCw, ChevronDown, ShoppingCart, Activity } from 'lucide-react';
import AppLayout from '../../components/layouts/AppLayout';
import analyticsService from '../../services/analyticsService';
import VehicleTypeChart from './components/VehicleTypeChart';
import ProductPerformanceMatrix from './components/ProductPerformanceMatrix';
import VendorPerformanceTable from './components/VendorPerformanceTable';
import DealAnalyticsWidget from './components/DealAnalyticsWidget';
import SalesTrendsChart from './components/SalesTrendsChart';
import MetricCard from './components/MetricCard';

const AdvancedBusinessIntelligenceAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  
  // Data states
  const [dashboardData, setDashboardData] = useState({
    vehicle_type_analysis: { new: [], used: [] },
    products_per_deal: { averages: {}, deals: [] },
    vendor_performance: [],
    category_analysis: [],
    sales_trends: [],
    summary_stats: {}
  });
  
  // Filter states
  const [timeframe, setTimeframe] = useState('6months');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showFilters, setShowFilters] = useState(false);

  // Load dashboard data
  const loadDashboardData = async (isRefresh = false) => {
    try {
      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const data = await analyticsService?.getDashboardSummary();
      setDashboardData(data);
    } catch (err) {
      console.error('Error loading dashboard data:', err);
      setError('Failed to load analytics data. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load sales trends with different timeframe
  const loadSalesTrends = async (newTimeframe) => {
    try {
      const trends = await analyticsService?.getSalesTrends(newTimeframe);
      setDashboardData(prev => ({
        ...prev,
        sales_trends: trends
      }));
      setTimeframe(newTimeframe);
    } catch (err) {
      console.error('Error loading sales trends:', err);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const handleRefresh = () => {
    loadDashboardData(true);
  };

  const handleTimeframeChange = (newTimeframe) => {
    loadSalesTrends(newTimeframe);
  };

  const handleExportData = () => {
    try {
      const exportData = {
        generated_at: new Date()?.toISOString(),
        summary_stats: dashboardData?.summary_stats,
        vehicle_type_analysis: dashboardData?.vehicle_type_analysis,
        products_per_deal_averages: dashboardData?.products_per_deal?.averages,
        vendor_performance: dashboardData?.vendor_performance,
        category_analysis: dashboardData?.category_analysis
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-report-${new Date()?.toISOString()?.split('T')?.[0]}.json`;
      document.body?.appendChild(a);
      a?.click();
      document.body?.removeChild(a);
    } catch (err) {
      console.error('Error exporting data:', err);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-lg text-gray-600">Loading analytics dashboard...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Advanced Business Intelligence Analytics
                </h1>
                <p className="mt-2 text-gray-600">
                  Comprehensive aftermarket performance insights and multi-dimensional analysis
                </p>
              </div>
              
              <div className="flex items-center space-x-4">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center space-x-2"
                >
                  <Filter className="w-4 h-4" />
                  <span>Filters</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
                </button>
                
                <button
                  onClick={handleExportData}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-2"
                >
                  <Download className="w-4 h-4" />
                  <span>Export</span>
                </button>
                
                <button
                  onClick={handleRefresh}
                  disabled={refreshing}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center space-x-2 disabled:opacity-50"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>
            </div>

            {/* Filters Panel */}
            {showFilters && (
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Time Frame
                    </label>
                    <select
                      value={timeframe}
                      onChange={(e) => handleTimeframeChange(e?.target?.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="1month">Last 1 Month</option>
                      <option value="3months">Last 3 Months</option>
                      <option value="6months">Last 6 Months</option>
                      <option value="1year">Last 1 Year</option>
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Product Category
                    </label>
                    <select
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e?.target?.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="all">All Categories</option>
                      {dashboardData?.category_analysis?.map((category) => (
                        <option key={category?.category} value={category?.category}>
                          {category?.category}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Error State */}
        {error && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Activity className="w-5 h-5 text-red-400" />
                </div>
                <div className="ml-3">
                  <p className="text-sm text-red-700">{error}</p>
                </div>
                <div className="ml-auto">
                  <button
                    onClick={() => loadDashboardData()}
                    className="text-red-700 hover:text-red-800 text-sm font-medium"
                  >
                    Try Again
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Key Metrics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <MetricCard
              icon={<ShoppingCart className="w-5 h-5" />}
              title="Total Deals"
              value={dashboardData?.summary_stats?.total_deals?.toString() || '0'}
              trend="+12%"
              trendUp={true}
              description="Total deals processed"
            />
            <MetricCard
              icon={<Package className="w-5 h-5" />}
              title="Products Sold"
              value={dashboardData?.summary_stats?.total_products_sold?.toString() || '0'}
              trend="+8%"
              trendUp={true}
              description="Total products sold"
            />
            <MetricCard
              icon={<DollarSign className="w-5 h-5" />}
              title="Total Revenue"
              value={`$${parseFloat(dashboardData?.summary_stats?.total_revenue || 0)?.toLocaleString()}`}
              trend="+15%"
              trendUp={true}
              description="Total sales revenue"
            />
            <MetricCard
              icon={<Users className="w-5 h-5" />}
              title="Active Vendors"
              value={dashboardData?.summary_stats?.active_vendors?.toString() || '0'}
              trend="+3%"
              trendUp={true}
              description="Active vendor partners"
            />
          </div>

          {/* Vehicle Type Analysis & Deal Analytics */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-8 mb-8">
            <VehicleTypeChart data={dashboardData?.vehicle_type_analysis} />
            <DealAnalyticsWidget data={dashboardData?.products_per_deal} />
          </div>

          {/* Product Performance Matrix */}
          <div className="mb-8">
            <ProductPerformanceMatrix 
              data={dashboardData?.category_analysis}
              selectedCategory={selectedCategory}
            />
          </div>

          {/* Sales Trends Chart */}
          <div className="mb-8">
            <SalesTrendsChart 
              data={dashboardData?.sales_trends}
              timeframe={timeframe}
            />
          </div>

          {/* Vendor Performance Table */}
          <div className="mb-8">
            <VendorPerformanceTable data={dashboardData?.vendor_performance} />
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default AdvancedBusinessIntelligenceAnalytics;