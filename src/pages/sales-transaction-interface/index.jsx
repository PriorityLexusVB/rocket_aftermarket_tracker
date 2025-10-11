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
import { jobService } from '../../services/jobService';

const SalesTransactionInterface = () => {
  const navigate = useNavigate();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dealNumber, setDealNumber] = useState('');

  // Customer & Form state
  const [customerData, setCustomerData] = useState({
    name: '',
    email: '',
    phone: ''
  });
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [selectedServices, setSelectedServices] = useState([]);
  const [notes, setNotes] = useState('');

  // Generate deal number on load
  useEffect(() => {
    const generateDealNumber = () => {
      const today = new Date();
      const year = today?.getFullYear();
      const timestamp = Date.now()?.toString()?.slice(-6);
      return `DEAL-${year}-${timestamp}`;
    };
    
    setDealNumber(generateDealNumber());
    document.title = 'Add New Sale - Rocket Aftermarket Tracker';
  }, []);

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
    const totalCost = selectedServices?.reduce((sum, service) => sum + (parseFloat(service?.cost || 0) * (service?.quantity || 1)), 0);
    const totalPrice = selectedServices?.reduce((sum, service) => sum + (parseFloat(service?.price || 0) * (service?.quantity || 1)), 0);
    const totalProfit = totalPrice - totalCost;
    
    return { totalCost, totalPrice, totalProfit };
  };

  const handleSaveTransaction = async (additionalData) => {
    setIsSaving(true);
    
    try {
      const { totalCost, totalPrice, totalProfit } = calculateTotals();
      
      // Find off-site services that require scheduling
      const offSiteServices = selectedServices?.filter(s => s?.isOffsite && s?.requiresSchedule);
      const hasScheduledServices = offSiteServices?.length > 0;
      
      // Get the first scheduled service for main scheduling data
      const primaryScheduledService = offSiteServices?.[0];
      
      // Build comprehensive deal data for Supabase
      const dealData = {
        // Basic deal information
        title: `${selectedVehicle?.year || ''} ${selectedVehicle?.make || ''} ${selectedVehicle?.model || ''}`?.trim() || 'New Deal',
        description: `Deal for ${customerData?.name} - ${selectedServices?.length} services`,
        
        // Vehicle and customer
        vehicle_id: selectedVehicle?.id,
        
        // Vendor and service type (use first vendor if multiple off-site services)
        vendor_id: primaryScheduledService?.vendorId || null,
        service_type: primaryScheduledService?.vendorId ? 'vendor' : 'in_house',
        
        // Location based on service type
        location: primaryScheduledService?.vendorId 
          ? `${primaryScheduledService?.vendorName || 'Vendor'} - Off-Site` 
          : 'In-House Service Bay',
        
        // Scheduling information
        promised_date: primaryScheduledService?.startDate ? new Date(primaryScheduledService.startDate)?.toISOString() : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)?.toISOString(),
        scheduled_start_time: primaryScheduledService?.startDate ? new Date(primaryScheduledService.startDate)?.toISOString() : null,
        scheduled_end_time: primaryScheduledService?.endDate ? new Date(primaryScheduledService.endDate)?.toISOString() : null,
        
        // Financial data
        estimated_cost: totalPrice,
        
        // Additional options
        customer_needs_loaner: selectedServices?.some(s => s?.requiresLoaner) || false,
        
        // Priority and status
        priority: hasScheduledServices ? 'high' : 'medium',
        job_status: hasScheduledServices ? 'scheduled' : 'pending',
        
        // Calendar integration
        calendar_notes: `Customer: ${customerData?.name}\nServices: ${selectedServices?.map(s => s?.name)?.join(', ')}\n${notes ? `Notes: ${notes}` : ''}`,
        color_code: primaryScheduledService?.vendorId ? '#f97316' : '#22c55e',
        
        // Line items for job_parts table
        lineItems: selectedServices?.map(service => ({
          product_id: service?.id,
          quantity: service?.quantity || 1,
          unit_price: parseFloat(service?.price || 0)
        })),
        
        ...additionalData
      };

      console.log('Creating deal with data:', dealData);
      
      // Create deal with line items using jobService
      const result = await jobService?.createDealWithLineItems(dealData);
      
      if (result) {
        // Show success message
        const successMessage = `
Deal saved successfully!
Deal ID: ${result?.job_number || 'Generated'}
Customer: ${customerData?.name}
Vehicle: ${selectedVehicle?.year} ${selectedVehicle?.make} ${selectedVehicle?.model}
Services: ${selectedServices?.length} items
Total: $${totalPrice?.toFixed(2)}
Profit: $${totalProfit?.toFixed(2)}
${hasScheduledServices ? `\nScheduled: ${primaryScheduledService?.startDate}` : ''}
        `;
        
        alert(successMessage);
        
        // Reset form
        handleResetForm();
        
        // Optional: navigate to deals list
        // navigate('/deals');
      }
    } catch (error) {
      console.error('Error saving deal:', error);
      alert(`Error saving deal: ${error?.message || 'Please try again.'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetForm = () => {
    setCustomerData({ name: '', email: '', phone: '' });
    setSelectedVehicle(null);
    setSelectedServices([]);
    setNotes('');
    
    // Generate new deal number
    const today = new Date();
    const year = today?.getFullYear();
    const timestamp = Date.now()?.toString()?.slice(-6);
    setDealNumber(`DEAL-${year}-${timestamp}`);
  };

  const canSave = customerData?.name && selectedVehicle && selectedServices?.length > 0;
  const todayFormatted = new Date()?.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });

  return (
    <div className="min-h-screen bg-background">
      <Header onMenuToggle={() => setIsSidebarOpen(!isSidebarOpen)} isMenuOpen={isSidebarOpen} />
      <Sidebar isOpen={isSidebarOpen} setIsOpen={setIsSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
      <main className={`transition-all duration-300 pt-16 ${isSidebarOpen ? 'lg:ml-60' : 'lg:ml-16'}`}>
        <div className="p-6">
          {/* Enhanced Page Header with Date and Deal Number */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-6">
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
                  className="flex items-center space-x-2"
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
                  className="flex items-center space-x-2"
                >
                  {isSaving ? 'Saving...' : 'Save Sale'}
                </Button>
              </div>
            </div>

            {/* Prominent Date and Deal Number Display */}
            <div className="flex items-center justify-between p-4 bg-card border border-primary/20 rounded-lg mb-4">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Icon name="Calendar" size={20} className="text-primary" />
                  <div>
                    <p className="text-sm font-medium text-primary">Today's Date</p>
                    <p className="text-lg font-semibold text-foreground">{todayFormatted}</p>
                  </div>
                </div>
                <div className="h-12 w-px bg-border"></div>
                <div className="flex items-center space-x-2">
                  <Icon name="Hash" size={20} className="text-success" />
                  <div>
                    <p className="text-sm font-medium text-success">Deal Number</p>
                    <p className="text-lg font-semibold text-foreground font-mono">{dealNumber}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                  canSave ? 'bg-success/10 text-success' : 'bg-muted text-muted-foreground'
                }`}>
                  {canSave ? 'Ready to Save' : 'Incomplete'}
                </span>
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
                helperText=""
                maxLength={100}
                style={{}}
              />
              <Input
                label="Email"
                type="email"
                value={customerData?.email}
                onChange={(e) => handleCustomerChange('email', e?.target?.value)}
                placeholder="customer@email.com"
                helperText=""
                maxLength={100}
                style={{}}
              />
              <Input
                label="Phone"
                type="tel"
                value={customerData?.phone}
                onChange={(e) => handleCustomerChange('phone', e?.target?.value)}
                placeholder="(555) 123-4567"
                helperText=""
                maxLength={20}
                style={{}}
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

              {/* Service Selection - Enhanced ProductSelectionGrid */}
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
                dealNumber={dealNumber}
                totals={calculateTotals()}
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
                    onClick={() => navigate('/deals')}
                    iconName="FileText"
                    iconPosition="left"
                    className="w-full justify-start"
                  >
                    View All Deals
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