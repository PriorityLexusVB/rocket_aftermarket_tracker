import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Header from '../../components/ui/Header'
import Sidebar from '../../components/ui/Sidebar'
import VehicleInfoPanel from './components/VehicleInfoPanel'
import QuickAddToolbar from './components/QuickAddToolbar'
import AftermarketWorkTable from './components/AftermarketWorkTable'
import ActionHistoryPanel from './components/ActionHistoryPanel'
import ExportPanel from './components/ExportPanel'
import Icon from '../../components/AppIcon'
import Button from '../../components/ui/Button'
import { vehicleService } from '../../services/vehicleService'

const VehicleDetailWorkstation = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [vehicleData, setVehicleData] = useState(null)
  const [workItems, setWorkItems] = useState([])
  const [actionHistory, setActionHistory] = useState([])
  const [availableVendors, setAvailableVendors] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setIsLoading(true)
      setLoadError('')
      setVehicleData(null)
      setWorkItems([])
      setAvailableVendors([])
      setActionHistory([])

      try {
        if (!id) throw new Error('Missing vehicle id')

        const [{ data: vehicle, error: vehicleErr }, { data: history, error: historyErr }] =
          await Promise.all([
            vehicleService.getVehicleById(id),
            vehicleService.getVehicleHistoryForVehiclesPage(id),
          ])

        if (vehicleErr) throw new Error(vehicleErr?.message || 'Failed to load vehicle')
        if (!vehicle) throw new Error('Vehicle not found')

        if (!isMounted) return

        setVehicleData({
          ...vehicle,
          stockNumber: vehicle?.stockNumber ?? vehicle?.stock_number ?? '',
        })

        if (historyErr) {
          setActionHistory([])
        } else {
          const mapped = (history || []).map((h, idx) => {
            const timestamp = h?.date || new Date().toISOString()
            const baseUser = h?.assignee || h?.vendor || 'System'
            if (h?.type === 'job') {
              return {
                id: `job-${idx}-${timestamp}`,
                type: 'created',
                user: baseUser,
                description: `created job ${h?.title || ''}`.trim(),
                details: h?.description || '',
                timestamp,
              }
            }
            return {
              id: `comm-${idx}-${timestamp}`,
              type: 'updated',
              user: baseUser,
              description: h?.title || 'updated communication',
              details: h?.description || '',
              timestamp,
            }
          })
          setActionHistory(mapped)
        }
      } catch (err) {
        if (!isMounted) return
        setLoadError(err?.message || 'Failed to load vehicle')
      } finally {
        if (isMounted) setIsLoading(false)
      }
    }

    load()
    return () => {
      isMounted = false
    }
  }, [id])

  const handleVehicleUpdate = (updatedVehicle) => {
    setVehicleData(updatedVehicle)
  }

  const handleAddProduct = (productData) => {
    const newWorkItem = {
      id: `WI${Date.now()}`,
      ...productData,
      profit: (productData?.salePrice || 0) - (productData?.estimatedCost || 0),
    }

    setWorkItems((prev) => [...prev, newWorkItem])
  }

  const handleUpdateWorkItem = (updatedItem) => {
    setWorkItems((prev) => prev?.map((item) => (item?.id === updatedItem?.id ? updatedItem : item)))
  }

  const handleDeleteWorkItem = (itemId) => {
    setWorkItems((prev) => prev?.filter((w) => w?.id !== itemId))
  }

  const handleExport = async (exportData) => {
    console.warn('Export not implemented:', exportData)
    alert('Export is not implemented yet.')
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <main className="lg:ml-60 pt-16">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Icon name="Loader2" size={32} className="text-primary animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading vehicle details...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  if (!vehicleData) {
    return (
      <div className="min-h-screen bg-background">
        <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

        <main className="lg:ml-60 pt-16">
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <Icon name="AlertCircle" size={48} className="text-error mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-foreground mb-2">Vehicle Not Found</h2>
              <p className="text-muted-foreground mb-4">
                {loadError || 'The requested vehicle could not be found.'}
              </p>
              <Button
                variant="default"
                onClick={() => navigate('/vehicle-management-hub')}
                iconName="ArrowLeft"
                iconPosition="left"
              >
                Back to Vehicle Hub
              </Button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className="lg:ml-60 pt-16">
        <div className="p-6">
          {/* Page Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => navigate('/vehicle-management-hub')}
                  className="shrink-0"
                >
                  <Icon name="ArrowLeft" size={20} />
                </Button>
                <div>
                  <h1 className="text-2xl font-bold text-foreground">
                    {vehicleData?.year} {vehicleData?.make} {vehicleData?.model}
                  </h1>
                  <p className="text-muted-foreground">
                    Stock #{vehicleData?.stockNumber} • VIN: {vehicleData?.vin}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate('/sales-transaction-interface')}
                  iconName="Plus"
                  iconPosition="left"
                >
                  New Sale
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => window.print()}
                  iconName="Printer"
                  iconPosition="left"
                >
                  Print
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
            {/* Left Panel - Vehicle Info (30%) */}
            <div className="xl:col-span-1 space-y-6">
              <VehicleInfoPanel
                vehicle={vehicleData}
                onUpdate={handleVehicleUpdate}
                userRole={null}
              />

              <ActionHistoryPanel vehicleId={vehicleData?.id} actionHistory={actionHistory} />

              <ExportPanel
                vehicleData={vehicleData}
                workItems={workItems}
                onExport={handleExport}
              />
            </div>

            {/* Right Panel - Work Management (70%) */}
            <div className="xl:col-span-3 space-y-6">
              <QuickAddToolbar
                onAddProduct={handleAddProduct}
                availableVendors={availableVendors}
              />

              <AftermarketWorkTable
                workItems={workItems}
                onUpdateItem={handleUpdateWorkItem}
                onDeleteItem={handleDeleteWorkItem}
                userRole={null}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default VehicleDetailWorkstation
