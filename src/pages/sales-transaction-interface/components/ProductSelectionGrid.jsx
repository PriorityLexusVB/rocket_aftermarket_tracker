import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { vendorService } from '../../../services/vendorService';

const ProductSelectionGrid = ({ selectedProducts, onProductToggle, onProductUpdate }) => {
  const [customService, setCustomService] = useState({ name: '', category: 'Other' });
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [vendors, setVendors] = useState([]);

  // Mock service catalog
  const serviceCatalog = [
    {
      id: 'rustguard',
      name: 'RUSTGUARD Protection',
      category: 'Rust Protection',
      basePrice: 599.99,
      baseCost: 300.00,
      description: 'Premium rust protection coating for undercarriage',
      icon: 'Shield',
      popular: true,
      estimatedTime: '2-3 hours',
      vendorSpecialties: ['Rust Prevention', 'Undercoating']
    },
    {
      id: 'ppf',
      name: 'Paint Protection Film (PPF)',
      category: 'Paint Protection',
      basePrice: 1299.99,
      baseCost: 650.00,
      description: 'Clear protective film for paint surface protection',
      icon: 'Shield',
      popular: true,
      estimatedTime: '4-6 hours',
      vendorSpecialties: ['Paint Protection', 'Film Installation']
    },
    {
      id: 'coating',
      name: 'Ceramic Coating',
      category: 'Paint Protection',
      basePrice: 899.99,
      baseCost: 450.00,
      description: 'Long-lasting ceramic coating for paint protection',
      icon: 'Sparkles',
      popular: true,
      estimatedTime: '3-4 hours',
      vendorSpecialties: ['Ceramic Coating', 'Paint Protection']
    },
    {
      id: 'windshield',
      name: 'Windshield Protection',
      category: 'Glass Protection',
      basePrice: 299.99,
      baseCost: 150.00,
      description: 'Clear protective film for windshield chip prevention',
      icon: 'Eye',
      popular: false,
      estimatedTime: '1-2 hours',
      vendorSpecialties: ['Glass Work', 'Installation']
    },
    {
      id: 'tint',
      name: 'Window Tinting',
      category: 'Window Film',
      basePrice: 449.99,
      baseCost: 225.00,
      description: 'Professional window tinting for privacy and UV protection',
      icon: 'Sun',
      popular: true,
      estimatedTime: '2-3 hours',
      vendorSpecialties: ['Window Tinting', 'Installation']
    },
    {
      id: 'wraps',
      name: 'Vehicle Wraps',
      category: 'Vinyl Wraps',
      basePrice: 2499.99,
      baseCost: 1250.00,
      description: 'Custom vinyl wraps for vehicle personalization',
      icon: 'Palette',
      popular: false,
      estimatedTime: '8-12 hours',
      vendorSpecialties: ['Vinyl Installation', 'Custom Graphics']
    }
  ];

  // Load vendors
  useEffect(() => {
    const loadVendors = async () => {
      try {
        const vendorData = await vendorService?.getAllVendors();
        setVendors(vendorData || []);
      } catch (error) {
        console.error('Error loading vendors:', error);
        setVendors([]);
      }
    };
    loadVendors();
  }, []);

  const categories = [...new Set(serviceCatalog.map(s => s.category))];

  const handleServiceSelect = (service) => {
    const isSelected = selectedProducts?.some(p => p?.id === service?.id);
    
    if (isSelected) {
      onProductToggle(service?.id, false);
    } else {
      const serviceWithDefaults = {
        ...service,
        cost: service?.baseCost,
        price: service?.basePrice,
        vendorId: '',
        isInHouse: true,
        startDate: '',
        daysToComplete: '',
        endDate: '',
        notes: ''
      };
      onProductToggle(service?.id, true, serviceWithDefaults);
    }
  };

  const handleCustomServiceAdd = () => {
    if (customService?.name?.trim()) {
      const newService = {
        id: `custom_${Date.now()}`,
        name: customService?.name,
        category: customService?.category,
        basePrice: 0,
        baseCost: 0,
        description: 'Custom service',
        icon: 'Wrench',
        popular: false,
        estimatedTime: 'TBD',
        vendorSpecialties: ['General'],
        cost: 0,
        price: 0,
        vendorId: '',
        isInHouse: true,
        startDate: '',
        daysToComplete: '',
        endDate: '',
        notes: '',
        isCustom: true
      };
      
      onProductToggle(newService?.id, true, newService);
      setCustomService({ name: '', category: 'Other' });
      setShowCustomForm(false);
    }
  };

  const calculateEndDate = (startDate, days) => {
    if (!startDate || !days) return '';
    
    const start = new Date(startDate);
    const end = new Date(start);
    end?.setDate(start?.getDate() + parseInt(days));
    
    return end?.toISOString()?.split('T')?.[0];
  };

  const handleServiceFieldUpdate = (serviceId, field, value) => {
    if (field === 'startDate' || field === 'daysToComplete') {
      const service = selectedProducts?.find(p => p?.id === serviceId);
      const startDate = field === 'startDate' ? value : service?.startDate;
      const days = field === 'daysToComplete' ? value : service?.daysToComplete;
      const endDate = calculateEndDate(startDate, days);
      
      onProductUpdate(serviceId, field, value);
      if (endDate) {
        onProductUpdate(serviceId, 'endDate', endDate);
      }
    } else if (field === 'vendorId') {
      onProductUpdate(serviceId, field, value);
      onProductUpdate(serviceId, 'isInHouse', !value);
    } else {
      onProductUpdate(serviceId, field, value);
    }
  };

  const calculateProfit = (cost, price) => {
    const costNum = parseFloat(cost) || 0;
    const priceNum = parseFloat(price) || 0;
    return priceNum - costNum;
  };

  const getVendorDisplayName = (vendorId) => {
    if (!vendorId) return 'In House';
    const vendor = vendors?.find(v => v?.id === vendorId);
    return vendor?.name || 'Unknown Vendor';
  };

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-accent/10 rounded-lg">
            <Icon name="Wrench" size={20} className="text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Service Line Items</h3>
            <p className="text-sm text-muted-foreground">Select services with pricing, vendors, and timeline</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">
            {selectedProducts?.length} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCustomForm(!showCustomForm)}
            iconName="Plus"
            iconPosition="left"
            className=""
          >
            Add Custom Service
          </Button>
        </div>
      </div>

      {/* Custom Service Form */}
      {showCustomForm && (
        <div className="mb-6 p-4 bg-muted/50 border border-border rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-3">Add Custom Service</h4>
          <div className="flex space-x-3">
            <Input
              type="text"
              placeholder="Service name"
              value={customService?.name}
              onChange={(e) => setCustomService(prev => ({ ...prev, name: e?.target?.value }))}
              className="flex-1"
            />
            <Input
              type="text"
              placeholder="Category"
              value={customService?.category}
              onChange={(e) => setCustomService(prev => ({ ...prev, category: e?.target?.value }))}
              className="w-32"
            />
            <Button
              variant="default"
              onClick={handleCustomServiceAdd}
              iconName="Plus"
              disabled={!customService?.name?.trim()}
              className=""
            >
              Add
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowCustomForm(false)}
              iconName="X"
              className=""
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Service Selection Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {serviceCatalog?.map((service) => {
          const isSelected = selectedProducts?.some(p => p?.id === service?.id);
          
          return (
            <div
              key={service?.id}
              className={`relative p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-elevation-1 ${
                isSelected
                  ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50'
              }`}
              onClick={() => handleServiceSelect(service)}
            >
              {service?.popular && (
                <div className="absolute -top-2 -right-2 px-2 py-1 bg-accent text-accent-foreground text-xs font-medium rounded-full">
                  Popular
                </div>
              )}
              <div className="flex items-start space-x-3 mb-3">
                <div className={`flex items-center justify-center w-10 h-10 rounded-lg ${
                  isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                }`}>
                  <Icon name={service?.icon} size={20} />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-foreground truncate">{service?.name}</h4>
                  <p className="text-xs text-muted-foreground">{service?.category}</p>
                </div>
                {isSelected && (
                  <Icon name="CheckCircle" size={20} className="text-primary flex-shrink-0" />
                )}
              </div>
              <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                {service?.description}
              </p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Base Price:</span>
                  <span className="font-medium text-foreground">${service?.basePrice?.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Est. Time:</span>
                  <span className="text-muted-foreground">{service?.estimatedTime}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Selected Services Configuration */}
      {selectedProducts?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Icon name="Settings" size={16} className="text-muted-foreground" />
            <h4 className="text-sm font-medium text-foreground">Configure Selected Services</h4>
          </div>
          
          {selectedProducts?.map((service) => (
            <div key={service?.id} className="p-4 bg-muted/30 border border-border rounded-lg">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <Icon name={service?.icon} size={16} className="text-primary" />
                  <span className="font-medium text-foreground">{service?.name}</span>
                  {service?.isCustom && (
                    <span className="px-2 py-1 text-xs bg-secondary text-secondary-foreground rounded-full">
                      Custom
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onProductToggle(service?.id, false)}
                  className="w-6 h-6"
                >
                  <Icon name="X" size={14} />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Cost */}
                <Input
                  label="Cost *"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={service?.cost}
                  onChange={(e) => handleServiceFieldUpdate(service?.id, 'cost', parseFloat(e?.target?.value) || 0)}
                  placeholder="0.00"
                />

                {/* Price */}
                <Input
                  label="Price *"
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  value={service?.price}
                  onChange={(e) => handleServiceFieldUpdate(service?.id, 'price', parseFloat(e?.target?.value) || 0)}
                  placeholder="0.00"
                />

                {/* Profit Display */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-foreground mb-2">Profit</label>
                  <div className={`flex items-center justify-center h-10 px-3 border border-border rounded-lg font-medium ${
                    calculateProfit(service?.cost, service?.price) >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'
                  }`}>
                    ${calculateProfit(service?.cost, service?.price)?.toFixed(2)}
                  </div>
                </div>

                {/* Vendor Assignment */}
                <div>
                  <label className="text-sm font-medium text-foreground mb-2">Vendor *</label>
                  <div className="space-y-2">
                    <Select
                      value={service?.vendorId || ''}
                      onChange={(value) => handleServiceFieldUpdate(service?.id, 'vendorId', value)}
                      required
                    >
                      <option value="">In House</option>
                      {vendors?.map(vendor => (
                        <option key={vendor?.id} value={vendor?.id}>
                          {vendor?.name} - {vendor?.specialty}
                        </option>
                      ))}
                      <option value="add-new">+ Add New Vendor</option>
                    </Select>
                    <span className={`text-xs px-2 py-1 rounded-full ${
                      service?.isInHouse ? 'bg-success/10 text-success' : 'bg-orange/10 text-orange'
                    }`}>
                      {getVendorDisplayName(service?.vendorId)}
                    </span>
                  </div>
                </div>

                {/* Start Date */}
                <Input
                  label="Start Date *"
                  type="date"
                  required
                  value={service?.startDate}
                  onChange={(e) => handleServiceFieldUpdate(service?.id, 'startDate', e?.target?.value)}
                  placeholder=""
                />

                {/* Days to Complete */}
                <Input
                  label="Days to Complete *"
                  type="number"
                  min="1"
                  required
                  value={service?.daysToComplete}
                  onChange={(e) => handleServiceFieldUpdate(service?.id, 'daysToComplete', e?.target?.value)}
                  placeholder="5"
                />

                {/* Auto-calculated End Date */}
                <div className="flex flex-col">
                  <label className="text-sm font-medium text-foreground mb-2">End Date (Auto)</label>
                  <div className="flex items-center h-10 px-3 border border-border rounded-lg bg-muted">
                    <span className="text-sm text-muted-foreground">
                      {service?.endDate || 'Set start date & days'}
                    </span>
                  </div>
                </div>

                {/* Notes */}
                <div className="md:col-span-2">
                  <Input
                    label="Notes"
                    type="text"
                    value={service?.notes}
                    onChange={(e) => handleServiceFieldUpdate(service?.id, 'notes', e?.target?.value)}
                    placeholder="Special instructions or notes..."
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductSelectionGrid;