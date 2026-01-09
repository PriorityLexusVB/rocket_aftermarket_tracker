import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import Sidebar from '../../components/ui/Sidebar'
import MetricsCard from './components/MetricsCard'
import ProfitChart from './components/ProfitChart'
import ProductPerformanceTable from './components/ProductPerformanceTable'
import VendorPerformanceMatrix from './components/VendorPerformanceMatrix'
import FilterControls from './components/FilterControls'
import Icon from '../../components/AppIcon'
import Button from '../../components/ui/Button'
import OverdueJobsWidget from './components/OverdueJobsWidget'
import OverdueAlertBar from '../../components/common/OverdueAlertBar'

const ExecutiveAnalyticsDashboard = () => {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [filters, setFilters] = useState({
    dateRange: '30',
    department: 'all',
    productFilter: 'all',
    vendorFilter: 'all',
  })

  const metricsData = []

  const profitChartData = []

  const productPerformanceData = []

  const vendorPerformanceData = []

  useEffect(() => {
    setIsLoading(false)
  }, [])

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters)
    setIsLoading(false)
    setLastUpdated(new Date())
  }

  const handleExport = () => {
    const exportData = {
      metrics: metricsData,
      products: productPerformanceData,
      vendors: vendorPerformanceData,
      filters: filters,
      exportDate: new Date()?.toISOString(),
    }

    console.log('Exporting dashboard data:', exportData)

    const csvContent = `Dashboard Export - ${new Date()?.toLocaleDateString()}\n\nMetrics Summary:\n(No metrics data available)\n\nFilters Applied:\nDate Range: ${filters?.dateRange} days\nDepartment: ${filters?.department}\nProduct: ${filters?.productFilter}\nVendor: ${filters?.vendorFilter}`

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL?.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `dashboard-export-${new Date()?.toISOString()?.split('T')?.[0]}.csv`
    a?.click()
    window.URL?.revokeObjectURL(url)
  }

  const handleRefresh = () => {
    setIsLoading(true)
    setTimeout(() => {
      setIsLoading(false)
      setLastUpdated(new Date())
    }, 800)
  }

  const handleQuickNavigation = (path) => {
    navigate(path)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
        <Sidebar
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          setIsOpen={setIsSidebarOpen}
        />

        <main className="lg:ml-60 pt-16">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading dashboard data...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        setIsOpen={setIsSidebarOpen}
      />
      <main className="lg:ml-60 pt-16">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Overdue Alert Bar */}
          <OverdueAlertBar />

          {/* Page Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">
                  Executive Analytics Dashboard
                </h1>
                <p className="text-muted-foreground">
                  Comprehensive aftermarket department performance and profitability insights
                </p>
              </div>

              <div className="flex items-center space-x-3 mt-4 sm:mt-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickNavigation('/business-intelligence-reports')}
                  iconName="FileText"
                  iconPosition="left"
                  className="flex items-center"
                  aria-label="Navigate to reports page"
                >
                  Reports
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleQuickNavigation('/sales-transaction-interface')}
                  iconName="Plus"
                  iconPosition="left"
                  className="flex items-center"
                  aria-label="Navigate to create new sale page"
                >
                  New Sale
                </Button>
              </div>
            </div>
          </div>

          {/* Filter Controls */}
          <FilterControls
            onFiltersChange={handleFiltersChange}
            onExport={handleExport}
            onRefresh={handleRefresh}
            lastUpdated={lastUpdated}
          />

          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {metricsData?.map((metric, index) => (
              <MetricsCard key={index} {...metric} />
            ))}
          </div>

          {/* Charts and Overdue Jobs Section */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            <div className="lg:col-span-2">
              <ProfitChart
                data={profitChartData}
                type="line"
                title="Monthly Profit Trend"
                height={300}
              />
            </div>

            <OverdueJobsWidget />
          </div>

          {/* Product Performance Table */}
          <div className="mb-8">
            <ProductPerformanceTable data={productPerformanceData} />
          </div>

          {/* Vendor Performance Matrix */}
          <div className="mb-8">
            <VendorPerformanceMatrix data={vendorPerformanceData} />
          </div>

          {/* Quick Actions */}
          <div className="bg-card border border-border rounded-lg p-6 shadow-elevation-1">
            <h3 className="text-lg font-semibold text-foreground mb-4">Quick Actions</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                onClick={() => handleQuickNavigation('/vehicle-management-hub')}
                className="h-auto p-4 flex flex-col space-y-2 border border-border rounded-lg bg-card hover:bg-accent transition-colors"
              >
                <Icon name="Car" size={24} className="text-primary" />
                <span className="text-sm font-medium">Vehicle Hub</span>
                <span className="text-xs text-muted-foreground">Manage inventory</span>
              </button>

              <button
                onClick={() => handleQuickNavigation('/vendor-operations-center')}
                className="h-auto p-4 flex flex-col space-y-2 border border-border rounded-lg bg-card hover:bg-accent transition-colors"
              >
                <Icon name="Users" size={24} className="text-primary" />
                <span className="text-sm font-medium">Vendor Center</span>
                <span className="text-xs text-muted-foreground">Manage vendors</span>
              </button>

              <button
                onClick={() => handleQuickNavigation('/sales-transaction-interface')}
                className="h-auto p-4 flex flex-col space-y-2 border border-border rounded-lg bg-card hover:bg-accent transition-colors"
              >
                <Icon name="DollarSign" size={24} className="text-primary" />
                <span className="text-sm font-medium">Sales Interface</span>
                <span className="text-xs text-muted-foreground">Log transactions</span>
              </button>

              <button
                onClick={() => handleQuickNavigation('/business-intelligence-reports')}
                className="h-auto p-4 flex flex-col space-y-2 border border-border rounded-lg bg-card hover:bg-accent transition-colors"
              >
                <Icon name="BarChart3" size={24} className="text-primary" />
                <span className="text-sm font-medium">BI Reports</span>
                <span className="text-xs text-muted-foreground">Generate reports</span>
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default ExecutiveAnalyticsDashboard
