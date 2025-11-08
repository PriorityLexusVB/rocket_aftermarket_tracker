import React, { useState, useEffect } from 'react'
import Icon from '../../../components/AppIcon'
import Button from '../../../components/ui/Button'

const ReportPreview = ({ filters, isExporting, exportProgress }) => {
  const [previewData, setPreviewData] = useState([])
  const [recordCount, setRecordCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  // Mock data based on report type
  const generateMockData = (reportType) => {
    const baseData = {
      sales_summary: [
        {
          date: '2024-09-20',
          vehicle: '2023 Honda Accord - VIN: 1HGCV1F30PA123456',
          product: 'ToughGuard Protection',
          vendor: 'ToughGuard Pro Services',
          salePrice: 1299.99,
          cost: 899.99,
          profit: 400.0,
          status: 'Completed',
        },
        {
          date: '2024-09-19',
          vehicle: '2024 Toyota Camry - VIN: 4T1C11AK5PU234567',
          product: 'Ceramic Coating',
          vendor: 'Evernew Solutions LLC',
          salePrice: 899.99,
          cost: 599.99,
          profit: 300.0,
          status: 'In Progress',
        },
        {
          date: '2024-09-18',
          vehicle: '2023 Ford F-150 - VIN: 1FTFW1E50PFC345678',
          product: 'Window Tinting',
          vendor: 'Premium Tint Masters',
          salePrice: 549.99,
          cost: 349.99,
          profit: 200.0,
          status: 'Completed',
        },
      ],
      vendor_performance: [
        {
          vendor: 'ToughGuard Pro Services',
          totalJobs: 45,
          completedJobs: 42,
          avgCompletionTime: '3.2 days',
          totalRevenue: 58499.55,
          avgRating: 4.8,
          overdueJobs: 1,
        },
        {
          vendor: 'Evernew Solutions LLC',
          totalJobs: 38,
          completedJobs: 35,
          avgCompletionTime: '2.8 days',
          totalRevenue: 34199.62,
          avgRating: 4.6,
          overdueJobs: 2,
        },
        {
          vendor: 'Premium Tint Masters',
          totalJobs: 52,
          completedJobs: 48,
          avgCompletionTime: '1.5 days',
          totalRevenue: 28599.48,
          avgRating: 4.9,
          overdueJobs: 0,
        },
      ],
      product_profitability: [
        {
          product: 'ToughGuard Protection',
          totalSales: 67,
          totalRevenue: 87099.33,
          totalCost: 60269.31,
          totalProfit: 26830.02,
          avgProfitMargin: '30.8%',
          topVendor: 'ToughGuard Pro Services',
        },
        {
          product: 'Ceramic Coating',
          totalSales: 43,
          totalRevenue: 38699.57,
          totalCost: 25789.71,
          totalProfit: 12909.86,
          avgProfitMargin: '33.4%',
          topVendor: 'Evernew Solutions LLC',
        },
        {
          product: 'Window Tinting',
          totalSales: 89,
          totalRevenue: 48949.11,
          totalCost: 31166.49,
          totalProfit: 17782.62,
          avgProfitMargin: '36.3%',
          topVendor: 'Premium Tint Masters',
        },
      ],
    }

    return baseData?.[reportType] || baseData?.sales_summary
  }

  useEffect(() => {
    setIsLoading(true)
    // Simulate API call delay
    setTimeout(() => {
      const mockData = generateMockData(filters?.reportType)
      setPreviewData(mockData)
      setRecordCount(mockData?.length * 15) // Simulate larger dataset
      setIsLoading(false)
    }, 500)
  }, [filters])

  const getColumnHeaders = () => {
    const headers = {
      sales_summary: [
        'Date',
        'Vehicle',
        'Product',
        'Vendor',
        'Sale Price',
        'Cost',
        'Profit',
        'Status',
      ],
      vendor_performance: [
        'Vendor',
        'Total Jobs',
        'Completed',
        'Avg Time',
        'Revenue',
        'Rating',
        'Overdue',
      ],
      product_profitability: [
        'Product',
        'Sales',
        'Revenue',
        'Cost',
        'Profit',
        'Margin',
        'Top Vendor',
      ],
    }
    return headers?.[filters?.reportType] || headers?.sales_summary
  }

  const renderTableRow = (item, index) => {
    switch (filters?.reportType) {
      case 'vendor_performance':
        return (
          <tr key={index} className="border-b border-border hover:bg-muted/50">
            <td className="px-4 py-3 text-sm font-medium text-foreground">{item?.vendor}</td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{item?.totalJobs}</td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{item?.completedJobs}</td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{item?.avgCompletionTime}</td>
            <td className="px-4 py-3 text-sm font-medium text-success">
              ${item?.totalRevenue?.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center">
                <Icon name="Star" size={14} className="text-warning mr-1" />
                {item?.avgRating}
              </div>
            </td>
            <td className="px-4 py-3 text-sm">
              {item?.overdueJobs > 0 ? (
                <span className="text-error font-medium">{item?.overdueJobs}</span>
              ) : (
                <span className="text-success">0</span>
              )}
            </td>
          </tr>
        )
      case 'product_profitability':
        return (
          <tr key={index} className="border-b border-border hover:bg-muted/50">
            <td className="px-4 py-3 text-sm font-medium text-foreground">{item?.product}</td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{item?.totalSales}</td>
            <td className="px-4 py-3 text-sm font-medium text-success">
              ${item?.totalRevenue?.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">
              ${item?.totalCost?.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-sm font-medium text-success">
              ${item?.totalProfit?.toLocaleString()}
            </td>
            <td className="px-4 py-3 text-sm font-medium text-accent">{item?.avgProfitMargin}</td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{item?.topVendor}</td>
          </tr>
        )
      default: // sales_summary
        return (
          <tr key={index} className="border-b border-border hover:bg-muted/50">
            <td className="px-4 py-3 text-sm text-muted-foreground">{item?.date}</td>
            <td className="px-4 py-3 text-sm font-medium text-foreground max-w-xs truncate">
              {item?.vehicle}
            </td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{item?.product}</td>
            <td className="px-4 py-3 text-sm text-muted-foreground">{item?.vendor}</td>
            <td className="px-4 py-3 text-sm font-medium text-success">${item?.salePrice}</td>
            <td className="px-4 py-3 text-sm text-muted-foreground">${item?.cost}</td>
            <td className="px-4 py-3 text-sm font-medium text-success">${item?.profit}</td>
            <td className="px-4 py-3 text-sm">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  item?.status === 'Completed'
                    ? 'bg-success/10 text-success'
                    : item?.status === 'In Progress'
                      ? 'bg-warning/10 text-warning'
                      : 'bg-muted text-muted-foreground'
                }`}
              >
                {item?.status}
              </span>
            </td>
          </tr>
        )
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1 h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Report Preview</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {isLoading ? 'Loading preview...' : `${recordCount?.toLocaleString()} records found`}
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              variant="ghost"
              size="sm"
              iconName="RefreshCw"
              iconPosition="left"
              onClick={() => window.location?.reload()}
            >
              Refresh
            </Button>
          </div>
        </div>
      </div>
      {/* Export Progress */}
      {isExporting && (
        <div className="p-4 bg-muted border-b border-border">
          <div className="flex items-center space-x-3">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">Exporting Report...</span>
                <span className="text-sm text-muted-foreground">{exportProgress}%</span>
              </div>
              <div className="w-full bg-border rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${exportProgress}%` }}
                />
              </div>
            </div>
            <Icon name="Download" size={20} className="text-primary animate-pulse" />
          </div>
        </div>
      )}
      {/* Preview Content */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Icon name="Loader2" size={32} className="text-primary animate-spin mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">Loading report preview...</p>
            </div>
          </div>
        ) : previewData?.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Icon name="FileX" size={48} className="text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium text-foreground mb-2">No Data Found</h3>
              <p className="text-sm text-muted-foreground">
                No records match your current filter criteria.
                <br />
                Try adjusting your filters to see results.
              </p>
            </div>
          </div>
        ) : (
          <div className="overflow-auto h-full">
            <table className="w-full">
              <thead className="bg-muted sticky top-0">
                <tr>
                  {getColumnHeaders()?.map((header, index) => (
                    <th
                      key={index}
                      className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-card divide-y divide-border">
                {previewData?.map((item, index) => renderTableRow(item, index))}
              </tbody>
            </table>

            {/* Preview Footer */}
            <div className="p-4 bg-muted border-t border-border">
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Showing first {previewData?.length} records</span>
                <span>Total: {recordCount?.toLocaleString()} records</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default ReportPreview
