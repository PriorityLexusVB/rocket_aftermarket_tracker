import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import Sidebar from '../../components/ui/Sidebar'
import Icon from '../../components/AppIcon'
import Button from '../../components/ui/Button'
import ReportBuilder from './components/ReportBuilder'
import ReportPreview from './components/ReportPreview'
import QuickActions from './components/QuickActions'

const BusinessIntelligenceReports = () => {
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentFilters, setCurrentFilters] = useState({
    dateRange: 'last30days',
    startDate: '',
    endDate: '',
    vendors: [],
    products: [],
    profitThreshold: '',
    status: [],
    reportType: 'sales_summary',
  })
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [activeView, setActiveView] = useState('builder') // 'builder', 'preview', 'quick'

  const handleFilterChange = useCallback((newFilters) => {
    setCurrentFilters(newFilters)
    setActiveView('preview')
  }, [])

  const handleExport = useCallback(
    async (format) => {
      setIsExporting(true)
      setExportProgress(0)

      // Simulate export progress
      const progressInterval = setInterval(() => {
        setExportProgress((prev) => {
          if (prev >= 100) {
            clearInterval(progressInterval)
            setIsExporting(false)

            // Simulate download
            const fileName = `${currentFilters?.reportType}_${new Date()?.toISOString()?.split('T')?.[0]}.${format}`
            console.log(`Downloading ${fileName}`)

            // Show success notification (in real app, this would be a toast)
            setTimeout(() => {
              alert(`Report exported successfully as ${format?.toUpperCase()}`)
            }, 500)

            return 100
          }
          return prev + Math.random() * 15
        })
      }, 200)
    },
    [currentFilters]
  )

  const handleQuickReport = useCallback(
    (filters, reportName) => {
      setCurrentFilters({ ...currentFilters, ...filters })
      setActiveView('preview')
      console.log(`Generating quick report: ${reportName}`)
    },
    [currentFilters]
  )

  const handleResetFilters = useCallback(() => {
    const defaultFilters = {
      dateRange: 'last30days',
      startDate: '',
      endDate: '',
      vendors: [],
      products: [],
      profitThreshold: '',
      status: [],
      reportType: 'sales_summary',
    }
    setCurrentFilters(defaultFilters)
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e?.ctrlKey || e?.metaKey) {
        switch (e?.key) {
          case 'd':
            e?.preventDefault()
            handleQuickReport(
              {
                dateRange: 'today',
                reportType: 'sales_summary',
              },
              'Daily Sales Report'
            )
            break
          case 'e':
            e?.preventDefault()
            if (!isExporting) {
              handleExport('csv')
            }
            break
          case 'r':
            e?.preventDefault()
            handleResetFilters()
            break
          case 'f':
            e?.preventDefault()
            // Focus search would be implemented here
            break
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleQuickReport, handleExport, handleResetFilters, isExporting])

  const toggleSidebar = () => {
    setIsSidebarOpen(!isSidebarOpen)
  }

  const closeSidebar = () => {
    setIsSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={toggleSidebar} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={closeSidebar} />
      <main className="lg:ml-60 pt-16">
        <div className="p-6">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  Business Intelligence Reports
                </h1>
                <p className="text-muted-foreground mt-2">
                  Generate comprehensive reports and export data for analysis and compliance
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={() => navigate('/executive-analytics-dashboard')}
                  iconName="BarChart3"
                  iconPosition="left"
                >
                  Analytics Dashboard
                </Button>
                <Button
                  variant="default"
                  onClick={() => setActiveView('quick')}
                  iconName="Zap"
                  iconPosition="left"
                >
                  Quick Reports
                </Button>
              </div>
            </div>
          </div>

          {/* View Toggle */}
          <div className="mb-6">
            <div className="flex items-center space-x-1 bg-muted p-1 rounded-lg w-fit">
              <Button
                variant={activeView === 'builder' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('builder')}
                iconName="Settings"
                iconPosition="left"
              >
                Report Builder
              </Button>
              <Button
                variant={activeView === 'preview' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('preview')}
                iconName="Eye"
                iconPosition="left"
              >
                Preview
              </Button>
              <Button
                variant={activeView === 'quick' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveView('quick')}
                iconName="Zap"
                iconPosition="left"
              >
                Quick Actions
              </Button>
            </div>
          </div>

          {/* Main Content */}
          {activeView === 'quick' ? (
            <QuickActions onQuickReport={handleQuickReport} isExporting={isExporting} />
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-280px)]">
              {/* Report Builder Panel */}
              <div
                className={`lg:col-span-2 ${activeView === 'builder' ? 'block' : 'hidden lg:block'}`}
              >
                <ReportBuilder
                  onFilterChange={handleFilterChange}
                  onExport={handleExport}
                  isExporting={isExporting}
                />
              </div>

              {/* Report Preview Panel */}
              <div
                className={`lg:col-span-3 ${activeView === 'preview' ? 'block' : 'hidden lg:block'}`}
              >
                <ReportPreview
                  filters={currentFilters}
                  isExporting={isExporting}
                  exportProgress={exportProgress}
                />
              </div>
            </div>
          )}

          {/* Status Bar */}
          <div className="mt-6 p-4 bg-card border border-border rounded-lg shadow-elevation-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                <div className="flex items-center space-x-2">
                  <Icon name="Database" size={16} />
                  <span>Connected to Rocket Aftermarket DB</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Icon name="Clock" size={16} />
                  <span>Last updated: {new Date()?.toLocaleTimeString()}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Icon name="Shield" size={16} />
                  <span>Secure export enabled</span>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <span>Report generation time: ~2-5 seconds</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default BusinessIntelligenceReports
