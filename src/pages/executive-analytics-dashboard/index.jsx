import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import MetricsCard from './components/MetricsCard';
import ProfitChart from './components/ProfitChart';
import ProductPerformanceTable from './components/ProductPerformanceTable';
import VendorPerformanceMatrix from './components/VendorPerformanceMatrix';
import FilterControls from './components/FilterControls';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import OverdueJobsWidget from './components/OverdueJobsWidget';
import OverdueAlertBar from '../../components/common/OverdueAlertBar';

const ExecutiveAnalyticsDashboard = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [filters, setFilters] = useState({
    dateRange: '30',
    department: 'all',
    productFilter: 'all',
    vendorFilter: 'all'
  });

  // Mock data for dashboard metrics
  const metricsData = [
    {
      title: 'Total Profit',
      value: '$284,750',
      change: '+12.5%',
      changeType: 'positive',
      icon: 'DollarSign',
      description: 'Last 30 days',
      trend: { direction: 'up', value: '+$32,150' }
    },
    {
      title: 'Active Jobs',
      value: '147',
      change: '+8.2%',
      changeType: 'positive',
      icon: 'Briefcase',
      description: 'Currently in progress',
      trend: { direction: 'up', value: '+11 jobs' }
    },
    {
      title: 'Completion Rate',
      value: '94.2%',
      change: '+2.1%',
      changeType: 'positive',
      icon: 'CheckCircle',
      description: 'On-time delivery',
      trend: { direction: 'up', value: '+2.1%' }
    },
    {
      title: 'Avg Job Value',
      value: '$1,847',
      change: '-3.4%',
      changeType: 'negative',
      icon: 'TrendingUp',
      description: 'Per completed job',
      trend: { direction: 'down', value: '-$65' }
    }
  ];

  // Mock data for profit chart
  const profitChartData = [
    { name: 'Jan', value: 245000 },
    { name: 'Feb', value: 267000 },
    { name: 'Mar', value: 289000 },
    { name: 'Apr', value: 312000 },
    { name: 'May', value: 298000 },
    { name: 'Jun', value: 334000 },
    { name: 'Jul', value: 356000 },
    { name: 'Aug', value: 342000 },
    { name: 'Sep', value: 378000 },
    { name: 'Oct', value: 395000 },
    { name: 'Nov', value: 412000 },
    { name: 'Dec', value: 428000 }
  ];

  // Mock data for product performance
  const productPerformanceData = [
    {
      id: 1,
      name: 'ToughGuard Protection',
      category: 'Paint Protection',
      icon: 'Shield',
      profit: 89750,
      volume: 234,
      margin: 38.5,
      growth: 15.2
    },
    {
      id: 2,
      name: 'Evernew Coating',
      category: 'Ceramic Coating',
      icon: 'Sparkles',
      profit: 67890,
      volume: 156,
      margin: 42.1,
      growth: 8.7
    },
    {
      id: 3,
      name: 'Windshield Protection',
      category: 'Glass Protection',
      icon: 'Car',
      profit: 45620,
      volume: 189,
      margin: 28.3,
      growth: -2.1
    },
    {
      id: 4,
      name: 'Premium Tint',
      category: 'Window Tinting',
      icon: 'Sun',
      profit: 38940,
      volume: 267,
      margin: 31.7,
      growth: 12.4
    },
    {
      id: 5,
      name: 'Vehicle Wraps',
      category: 'Graphics & Wraps',
      icon: 'Palette',
      profit: 42350,
      volume: 78,
      margin: 45.8,
      growth: 22.1
    }
  ];

  // Mock data for vendor performance
  const vendorPerformanceData = [
    {
      id: 1,
      name: 'Premium Auto Solutions',
      specialty: 'Paint Protection',
      completionRate: 96.8,
      avgTurnaround: 3.2,
      profitContribution: 125750,
      activeJobs: 23
    },
    {
      id: 2,
      name: 'Elite Detailing Co.',
      specialty: 'Ceramic Coating',
      completionRate: 94.2,
      avgTurnaround: 4.1,
      profitContribution: 89340,
      activeJobs: 18
    },
    {
      id: 3,
      name: 'Pro Tint & Graphics',
      specialty: 'Tinting & Wraps',
      completionRate: 91.5,
      avgTurnaround: 2.8,
      profitContribution: 67890,
      activeJobs: 31
    },
    {
      id: 4,
      name: 'Shield Masters',
      specialty: 'Glass Protection',
      completionRate: 88.7,
      avgTurnaround: 5.3,
      profitContribution: 45620,
      activeJobs: 15
    },
    {
      id: 5,
      name: 'Apex Automotive',
      specialty: 'Multi-Service',
      completionRate: 92.3,
      avgTurnaround: 4.7,
      profitContribution: 78450,
      activeJobs: 27
    },
    {
      id: 6,
      name: 'Precision Wraps',
      specialty: 'Vehicle Wraps',
      completionRate: 89.4,
      avgTurnaround: 6.2,
      profitContribution: 52340,
      activeJobs: 12
    }
  ];

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
      setLastUpdated(new Date());
    }, 500);
  };

  const handleExport = () => {
    // Simulate export functionality
    const exportData = {
      metrics: metricsData,
      products: productPerformanceData,
      vendors: vendorPerformanceData,
      filters: filters,
      exportDate: new Date()?.toISOString()
    };
    
    console.log('Exporting dashboard data:', exportData);
    
    // Create and download CSV
    const csvContent = `Dashboard Export - ${new Date()?.toLocaleDateString()}\n\nMetrics Summary:\nTotal Profit: $284,750\nActive Jobs: 147\nCompletion Rate: 94.2%\nAvg Job Value: $1,847\n\nFilters Applied:\nDate Range: ${filters?.dateRange} days\nDepartment: ${filters?.department}\nProduct: ${filters?.productFilter}\nVendor: ${filters?.vendorFilter}`;
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL?.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dashboard-export-${new Date()?.toISOString()?.split('T')?.[0]}.csv`;
    a?.click();
    window.URL?.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setLastUpdated(new Date());
    }, 800);
  };

  const handleQuickNavigation = (path) => {
    navigate(path);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        
        <main className="lg:ml-60 pt-16">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading dashboard data...</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="lg:ml-60 pt-16">
        <div className="p-6 max-w-7xl mx-auto">
          {/* Overdue Alert Bar */}
          <OverdueAlertBar />

          {/* Page Header */}
          <div className="mb-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h1 className="text-2xl font-bold text-foreground mb-2">Executive Analytics Dashboard</h1>
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
                  className=""
                >
                  Reports
                </Button>
                
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleQuickNavigation('/sales-transaction-interface')}
                  iconName="Plus"
                  iconPosition="left"
                  className=""
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
              <Button
                variant="outline"
                onClick={() => handleQuickNavigation('/vehicle-management-hub')}
                className="h-auto p-4 flex-col space-y-2"
              >
                <Icon name="Car" size={24} className="text-primary" />
                <span className="text-sm font-medium">Vehicle Hub</span>
                <span className="text-xs text-muted-foreground">Manage inventory</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => handleQuickNavigation('/vendor-operations-center')}
                className="h-auto p-4 flex-col space-y-2"
              >
                <Icon name="Users" size={24} className="text-primary" />
                <span className="text-sm font-medium">Vendor Center</span>
                <span className="text-xs text-muted-foreground">Manage vendors</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => handleQuickNavigation('/sales-transaction-interface')}
                className="h-auto p-4 flex-col space-y-2"
              >
                <Icon name="DollarSign" size={24} className="text-primary" />
                <span className="text-sm font-medium">Sales Interface</span>
                <span className="text-xs text-muted-foreground">Log transactions</span>
              </Button>

              <Button
                variant="outline"
                onClick={() => handleQuickNavigation('/business-intelligence-reports')}
                className="h-auto p-4 flex-col space-y-2"
              >
                <Icon name="BarChart3" size={24} className="text-primary" />
                <span className="text-sm font-medium">BI Reports</span>
                <span className="text-xs text-muted-foreground">Generate reports</span>
              </Button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ExecutiveAnalyticsDashboard;