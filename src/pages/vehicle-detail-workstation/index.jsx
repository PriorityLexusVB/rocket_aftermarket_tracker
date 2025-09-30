import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import VehicleInfoPanel from './components/VehicleInfoPanel';
import QuickAddToolbar from './components/QuickAddToolbar';
import AftermarketWorkTable from './components/AftermarketWorkTable';
import ActionHistoryPanel from './components/ActionHistoryPanel';
import ExportPanel from './components/ExportPanel';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';

const VehicleDetailWorkstation = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState('manager'); // Mock user role
  const [vehicleData, setVehicleData] = useState(null);
  const [workItems, setWorkItems] = useState([]);
  const [actionHistory, setActionHistory] = useState([]);
  const [availableVendors, setAvailableVendors] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data initialization
  useEffect(() => {
    const initializeData = () => {
      // Mock vehicle data
      const mockVehicle = {
        id: id || 'VH001',
        vin: '1HGBH41JXMN109186',
        year: 2023,
        make: 'Honda',
        model: 'Accord',
        color: 'Pearl White',
        mileage: 15420,
        stockNumber: 'ST-2023-001',
        status: 'Available',
        lastUpdated: '2025-01-20T10:30:00Z'
      };

      // Mock work items
      const mockWorkItems = [
        {
          id: 'WI001',
          productType: 'ToughGuard Protection',
          productDescription: 'Premium paint protection film - full front end',
          vendorId: 'V001',
          vendorName: 'Elite Auto Protection',
          status: 'In Progress',
          dateAdded: '2025-01-18T09:00:00Z',
          estimatedCost: 450.00,
          salePrice: 899.00,
          profit: 449.00
        },
        {
          id: 'WI002',
          productType: 'Window Tint',
          productDescription: 'Ceramic window tint - all windows',
          vendorId: 'V002',
          vendorName: 'Crystal Clear Tinting',
          status: 'Complete',
          dateAdded: '2025-01-15T14:30:00Z',
          estimatedCost: 180.00,
          salePrice: 350.00,
          profit: 170.00
        },
        {
          id: 'WI003',
          productType: 'Evernew Coating',
          productDescription: 'Ceramic coating system - 5 year protection',
          vendorId: 'V003',
          vendorName: 'Premium Detailing Co',
          status: 'Pending',
          dateAdded: '2025-01-10T11:15:00Z',
          estimatedCost: 320.00,
          salePrice: 650.00,
          profit: 330.00
        }
      ];

      // Mock vendors
      const mockVendors = [
        {
          id: 'V001',
          name: 'Elite Auto Protection',
          specialties: ['Paint Protection', 'Clear Bra', 'PPF'],
          rating: 4.8,
          status: 'Active'
        },
        {
          id: 'V002',
          name: 'Crystal Clear Tinting',
          specialties: ['Window Tinting', 'Ceramic Tint'],
          rating: 4.9,
          status: 'Active'
        },
        {
          id: 'V003',
          name: 'Premium Detailing Co',
          specialties: ['Ceramic Coating', 'Paint Correction'],
          rating: 4.7,
          status: 'Active'
        },
        {
          id: 'V004',
          name: 'Wrap Masters',
          specialties: ['Vehicle Wraps', 'Graphics', 'Vinyl'],
          rating: 4.6,
          status: 'Active'
        },
        {
          id: 'V005',
          name: 'Glass Guard Pro',
          specialties: ['Glass Protection', 'Windshield Film'],
          rating: 4.5,
          status: 'Active'
        }
      ];

      // Mock action history
      const mockActionHistory = [
        {
          id: 'AH001',
          type: 'created',
          user: 'Sarah Johnson',
          description: 'added ToughGuard Protection work item',
          details: 'Assigned to Elite Auto Protection',
          timestamp: '2025-01-18T09:00:00Z'
        },
        {
          id: 'AH002',
          type: 'status_changed',
          user: 'Mike Chen',
          description: 'updated Window Tint status',
          details: 'Changed from In Progress to Complete',
          changes: {
            status: { from: 'In Progress', to: 'Complete' }
          },
          timestamp: '2025-01-17T16:45:00Z'
        },
        {
          id: 'AH003',
          type: 'price_updated',
          user: 'Sarah Johnson',
          description: 'updated pricing for Evernew Coating',
          details: 'Adjusted sale price based on market rates',
          changes: {
            salePrice: { from: '$600.00', to: '$650.00' }
          },
          timestamp: '2025-01-16T13:20:00Z'
        },
        {
          id: 'AH004',
          type: 'created',
          user: 'David Wilson',
          description: 'created vehicle record',
          details: 'Initial vehicle setup completed',
          timestamp: '2025-01-15T08:30:00Z'
        },
        {
          id: 'AH005',
          type: 'exported',
          user: 'Sarah Johnson',
          description: 'exported customer summary report',
          details: 'PDF format - sent to customer',
          timestamp: '2025-01-14T11:10:00Z'
        }
      ];

      setVehicleData(mockVehicle);
      setWorkItems(mockWorkItems);
      setAvailableVendors(mockVendors);
      setActionHistory(mockActionHistory);
      setIsLoading(false);
    };

    initializeData();
  }, [id]);

  const handleVehicleUpdate = (updatedVehicle) => {
    setVehicleData(updatedVehicle);
    
    // Add to action history
    const newAction = {
      id: `AH${Date.now()}`,
      type: 'updated',
      user: 'Current User',
      description: 'updated vehicle information',
      details: 'Vehicle details modified',
      timestamp: new Date()?.toISOString()
    };
    setActionHistory(prev => [newAction, ...prev]);
  };

  const handleAddProduct = (productData) => {
    const newWorkItem = {
      id: `WI${Date.now()}`,
      ...productData,
      profit: (productData?.salePrice || 0) - (productData?.estimatedCost || 0)
    };
    
    setWorkItems(prev => [...prev, newWorkItem]);
    
    // Add to action history
    const newAction = {
      id: `AH${Date.now()}`,
      type: 'created',
      user: 'Current User',
      description: `added ${productData?.productType} work item`,
      details: `Assigned to ${productData?.vendorName}`,
      timestamp: new Date()?.toISOString()
    };
    setActionHistory(prev => [newAction, ...prev]);
  };

  const handleUpdateWorkItem = (updatedItem) => {
    setWorkItems(prev => 
      prev?.map(item => 
        item?.id === updatedItem?.id ? updatedItem : item
      )
    );
    
    // Add to action history
    const newAction = {
      id: `AH${Date.now()}`,
      type: 'updated',
      user: 'Current User',
      description: `updated ${updatedItem?.productType}`,
      details: 'Work item details modified',
      timestamp: new Date()?.toISOString()
    };
    setActionHistory(prev => [newAction, ...prev]);
  };

  const handleDeleteWorkItem = (itemId) => {
    const item = workItems?.find(w => w?.id === itemId);
    setWorkItems(prev => prev?.filter(w => w?.id !== itemId));
    
    // Add to action history
    const newAction = {
      id: `AH${Date.now()}`,
      type: 'deleted',
      user: 'Current User',
      description: `removed ${item?.productType || 'work item'}`,
      details: 'Work item deleted from vehicle',
      timestamp: new Date()?.toISOString()
    };
    setActionHistory(prev => [newAction, ...prev]);
  };

  const handleExport = async (exportData) => {
    console.log('Exporting data:', exportData);
    
    // Add to action history
    const newAction = {
      id: `AH${Date.now()}`,
      type: 'exported',
      user: 'Current User',
      description: `exported ${exportData?.type} report`,
      details: `${exportData?.format?.toUpperCase()} format generated`,
      timestamp: new Date()?.toISOString()
    };
    setActionHistory(prev => [newAction, ...prev]);
    
    // Simulate file download
    const filename = `vehicle-${vehicleData?.stockNumber}-${exportData?.type}-${new Date()?.toISOString()?.split('T')?.[0]}.${exportData?.format}`;
    console.log(`Download initiated: ${filename}`);
  };

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
    );
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
              <p className="text-muted-foreground mb-4">The requested vehicle could not be found.</p>
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
    );
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
                userRole={userRole}
              />
              
              <ActionHistoryPanel
                vehicleId={vehicleData?.id}
                actionHistory={actionHistory}
              />
              
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
                userRole={userRole}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VehicleDetailWorkstation;