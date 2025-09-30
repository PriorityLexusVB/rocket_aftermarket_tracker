import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../../components/ui/Header';
import Sidebar from '../../components/ui/Sidebar';
import Icon from '../../components/AppIcon';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import VehicleLookupPanel from './components/VehicleLookupPanel';
import ProductSelectionGrid from './components/ProductSelectionGrid';
import TransactionSummary from './components/TransactionSummary';

const SalesTransactionInterface = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Customer & Form state
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [notes, setNotes] = useState('');

  const handleCustomerChange = (field, value) => {
    setCustomerData(prev => ({ ...prev, [field]: value }));
  };

  const handleVehicleSelect = (vehicle) => {
    setSelectedVehicle(vehicle);
  };

  const handleServiceToggle = (serviceId, isSelected, serviceData = null) => {
    if (isSelected && serviceData) {
      setSelectedServices(prev => [...prev, serviceData]);
    } else {
      setSelectedServices(prev => prev?.filter(s => s?.id !== serviceId));
    }
  };

  const handleServiceUpdate = (serviceId, field, value) => {
    setSelectedServices(prev =>
      prev?.map(service =>
        service?.id === serviceId
          ? { ...service, [field]: value }
          : service
      )
    );
  };

  const calculateTotals = () => {
    const totalCost = selectedServices?.reduce((sum, service) => sum + (parseFloat(service?.cost) || 0), 0);
    const totalPrice = selectedServices?.reduce((sum, service) => sum + (parseFloat(service?.price) || 0), 0);
    const totalProfit = totalPrice - totalCost;
    
    return { totalCost, totalPrice, totalProfit };
  };

  const handleSaveTransaction = async (additionalData) => {
    setIsSaving(true);
    
    try {
      const { totalCost, totalPrice, totalProfit } = calculateTotals();
      
      // Build comprehensive transaction data
      const transactionData = {
        id: `TXN-${new Date()?.getFullYear()}-${String(Date.now())?.slice(-6)}`,
        customer: customerData,
        vehicle: selectedVehicle,
        services: selectedServices,
        totals: {
          cost: totalCost,
          price: totalPrice,
          profit: totalProfit
        },
        notes: notes,
        timestamp: new Date()?.toISOString(),
        ...additionalData
      };

      // Mock save operation
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log('Complete Sale Transaction Saved:', transactionData);
      
      // Show success message
      alert(`Sale saved successfully!\nTransaction ID: ${transactionData?.id}\nTotal: $${totalPrice?.toFixed(2)}`);
      
      // Reset form
      handleResetForm();
    } catch (error) {
      console.error('Error saving transaction:', error);
      alert('Error saving transaction. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetForm = () => {
    setCustomerData({ name: '', email: '', phone: '' });
    setSelectedVehicle(null);
    setSelectedServices([]);
    setNotes('');
  };

  const canSave = customerData?.name && selectedVehicle && selectedServices?.length > 0;

  useEffect(() => {
    document.title = 'Add New Sale - Rocket Aftermarket Tracker';
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className={`transition-all duration-300 pt-16 ${isSidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}>
        <div className="p-6">
          {/* Page Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-foreground">Add New Sale</h1>
                <p className="text-muted-foreground mt-1">
                  Complete sale transaction with customer, vehicle, and service details
                </p>
              </div>
              <div className="flex items-center space-x-3">
                <Button
                  variant="outline"
                  onClick={handleResetForm}
                  iconName="RotateCcw"
                  iconPosition="left"
                >
                  Reset Form
                </Button>
                <Button
                  variant="default"
                  onClick={() => handleSaveTransaction({})}
                  loading={isSaving}
                  disabled={!canSave}
                  iconName="Save"
                  iconPosition="left"
                >
                  {isSaving ? 'Saving...' : 'Save Sale'}
                </Button>
              </div>
            </div>

            {/* Progress Indicator */}
            <div className="flex items-center space-x-4 text-sm">
              <div className={`flex items-center space-x-2 ${customerData?.name ? 'text-success' : 'text-muted-foreground'}`}>
                <Icon name={customerData?.name ? "CheckCircle" : "User"} size={16} />
                <span>Customer</span>
              </div>
              <Icon name="ChevronRight" size={14} className="text-muted-foreground" />
              <div className={`flex items-center space-x-2 ${selectedVehicle ? 'text-success' : 'text-muted-foreground'}`}>
                <Icon name={selectedVehicle ? "CheckCircle" : "Car"} size={16} />
                <span>Vehicle</span>
              </div>
              <Icon name="ChevronRight" size={14} className="text-muted-foreground" />
              <div className={`flex items-center space-x-2 ${selectedServices?.length > 0 ? 'text-success' : 'text-muted-foreground'}`}>
                <Icon name={selectedServices?.length > 0 ? "CheckCircle" : "Wrench"} size={16} />
                <span>Services ({selectedServices?.length})</span>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="mb-6 bg-card border border-border rounded-lg p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 bg-primary/10 rounded-lg">
                <Icon name="User" size={20} className="text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-foreground">Customer Information</h3>
                <p className="text-sm text-muted-foreground">Enter customer details for this sale</p>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Input
                label="Customer Name *"
                type="text"
                required
                value={customerData?.name}
                onChange={(e) => handleCustomerChange('name', e?.target?.value)}
                placeholder="John Smith"
              />
              <Input
                label="Email"
                type="email"
                value={customerData?.email}
                onChange={(e) => handleCustomerChange('email', e?.target?.value)}
                placeholder="customer@email.com"
              />
              <Input
                label="Phone"
                type="tel"
                value={customerData?.phone}
                onChange={(e) => handleCustomerChange('phone', e?.target?.value)}
                placeholder="(555) 123-4567"
              />
            </div>
          </div>

          {/* Main Content */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            {/* Left Column - Form Sections */}
            <div className="xl:col-span-2 space-y-6">
              {/* Vehicle Selection */}
              <VehicleLookupPanel
                onVehicleSelect={handleVehicleSelect}
                selectedVehicle={selectedVehicle}
              />

              {/* Service Selection */}
              <ProductSelectionGrid
                selectedProducts={selectedServices}
                onProductToggle={handleServiceToggle}
                onProductUpdate={handleServiceUpdate}
              />

              {/* Additional Notes */}
              <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="flex items-center justify-center w-10 h-10 bg-secondary/10 rounded-lg">
                    <Icon name="FileText" size={20} className="text-secondary" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-foreground">Additional Notes</h3>
                    <p className="text-sm text-muted-foreground">Any special instructions or comments</p>
                  </div>
                </div>
                
                <textarea
                  className="w-full h-24 px-3 py-2 border border-border rounded-lg bg-background text-foreground placeholder-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Enter any special instructions, customer requests, or additional notes for this sale..."
                  value={notes}
                  onChange={(e) => setNotes(e?.target?.value)}
                />
              </div>
            </div>

            {/* Right Column - Summary */}
            <div className="space-y-6">
              {/* Transaction Summary */}
              <TransactionSummary
                customerData={customerData}
                selectedVehicle={selectedVehicle}
                selectedProducts={selectedServices}
                onSave={handleSaveTransaction}
                isSaving={isSaving}
                canSave={canSave}
              />

              {/* Quick Actions */}
              <div className="bg-card border border-border rounded-lg p-4">
                <h4 className="text-sm font-medium text-foreground mb-3">Quick Actions</h4>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/vehicle-management-hub')}
                    iconName="Car"
                    iconPosition="left"
                    className="w-full justify-start"
                  >
                    Vehicle Management
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/administrative-configuration-center')}
                    iconName="Users"
                    iconPosition="left"
                    className="w-full justify-start"
                  >
                    Manage Vendors
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate('/sales-tracker')}
                    iconName="TrendingUp"
                    iconPosition="left"
                    className="w-full justify-start"
                  >
                    Sales Tracker
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Floating Save Button */}
          <div className="fixed bottom-6 right-6">
            <Button
              variant="default"
              size="lg"
              onClick={() => handleSaveTransaction({})}
              loading={isSaving}
              disabled={!canSave}
              iconName="Save"
              iconPosition="left"
              className="shadow-elevation-3"
            >
              {isSaving ? 'Saving Sale...' : 'Save Sale'}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SalesTransactionInterface;