import React, { useState, useEffect } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { productService } from '../../../services/productService';
import { vendorService } from '../../../services/vendorService';

const ProductSelectionGrid = ({ selectedProducts, onProductToggle, onProductUpdate }) => {
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customService, setCustomService] = useState({ name: '', category: 'Other' });
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Load data from Supabase
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        const [productsData, vendorsData] = await Promise.all([
          productService?.getAllProducts(),
          vendorService?.getAllVendors()
        ]);
        
        setProducts(productsData || []);
        setVendors(vendorsData || []);
      } catch (error) {
        console.error('Error loading data:', error);
        setProducts([]);
        setVendors([]);
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, []);

  const categories = [...new Set(products?.map(p => p?.category)?.filter(Boolean))];

  const filteredProducts = selectedCategory === 'all' 
    ? products 
    : products?.filter(p => p?.category === selectedCategory);

  const handleServiceSelect = (product) => {
    const isSelected = selectedProducts?.some(p => p?.id === product?.id);
    
    if (isSelected) {
      onProductToggle(product?.id, false);
    } else {
      const serviceWithDefaults = {
        ...product,
        cost: product?.cost || 0,
        price: product?.unit_price || 0,
        vendorId: product?.vendor_id || '',
        vendorName: product?.vendor?.name || '',
        isOffsite: !!product?.vendor_id,
        requiresSchedule: false,
        startDate: '',
        daysToComplete: '3',
        endDate: '',
        notes: '',
        quantity: 1,
        requiresLoaner: false
      };
      onProductToggle(product?.id, true, serviceWithDefaults);
    }
  };

  const handleCustomServiceAdd = async () => {
    if (customService?.name?.trim()) {
      try {
        const newService = await productService?.createProduct({
          name: customService?.name,
          category: customService?.category,
          cost: 0,
          unit_price: 0,
          description: 'Custom service',
          is_active: true
        });

        const serviceWithDefaults = {
          ...newService,
          cost: 0,
          price: 0,
          vendorId: '',
          vendorName: '',
          isOffsite: false,
          requiresSchedule: false,
          startDate: '',
          daysToComplete: '3',
          endDate: '',
          notes: '',
          quantity: 1,
          requiresLoaner: false
        };
        
        onProductToggle(newService?.id, true, serviceWithDefaults);
        setProducts(prev => [...prev, newService]);
        setCustomService({ name: '', category: 'Other' });
        setShowCustomForm(false);
      } catch (error) {
        console.error('Error creating custom service:', error);
      }
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
      const selectedVendor = vendors?.find(v => v?.id === value);
      onProductUpdate(serviceId, field, value);
      onProductUpdate(serviceId, 'vendorName', selectedVendor?.name || '');
      onProductUpdate(serviceId, 'isOffsite', !!value);
      // Auto-enable scheduling for off-site services
      if (value) {
        onProductUpdate(serviceId, 'requiresSchedule', true);
      }
    } else {
      onProductUpdate(serviceId, field, value);
    }
  };

  const calculateProfit = (cost, price, quantity = 1) => {
    const costNum = parseFloat(cost) || 0;
    const priceNum = parseFloat(price) || 0;
    const qty = parseInt(quantity) || 1;
    return (priceNum - costNum) * qty;
  };

  const getVendorDisplayName = (vendorId) => {
    if (!vendorId) return 'In-House Service';
    const vendor = vendors?.find(v => v?.id === vendorId);
    return vendor?.name || 'Unknown Vendor';
  };

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center justify-center py-8">
          <div className="flex items-center space-x-3">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="text-muted-foreground">Loading services...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-accent/10 rounded-lg">
            <Icon name="Wrench" size={20} className="text-accent" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">Service Line Items</h3>
            <p className="text-sm text-muted-foreground">
              Select and configure services for this vehicle
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          <span className="text-sm text-muted-foreground">
            {selectedProducts?.length} selected
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowCustomForm(!showCustomForm)}
            iconName="Plus"
            iconPosition="left"
            className="flex-shrink-0"
          >
            Add Custom
          </Button>
        </div>
      </div>

      {/* Category Filter */}
      {categories?.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-foreground">Category:</span>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory('all')}
                className="h-8"
              >
                All ({products?.length})
              </Button>
              {categories?.map(category => {
                const count = products?.filter(p => p?.category === category)?.length;
                return (
                  <Button
                    key={category}
                    variant={selectedCategory === category ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setSelectedCategory(category)}
                    className="h-8"
                  >
                    {category} ({count})
                  </Button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Custom Service Form */}
      {showCustomForm && (
        <div className="mb-6 p-4 bg-muted/50 border border-border rounded-lg">
          <h4 className="text-sm font-medium text-foreground mb-3">Create Custom Service</h4>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2">
              <Input
                type="text"
                placeholder="Service name"
                value={customService?.name}
                onChange={(e) => setCustomService(prev => ({ ...prev, name: e?.target?.value }))}
                helperText=""
                maxLength={255}
                style={{}}
              />
            </div>
            <Input
              type="text"
              placeholder="Category"
              value={customService?.category}
              onChange={(e) => setCustomService(prev => ({ ...prev, category: e?.target?.value }))}
              helperText=""
              maxLength={255}
              style={{}}
            />
            <div className="flex space-x-2">
              <Button
                variant="default"
                onClick={handleCustomServiceAdd}
                iconName="Plus"
                disabled={!customService?.name?.trim()}
                className="flex-1"
              >
                Add
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowCustomForm(false)}
                iconName="X"
                className="px-3"
              />
            </div>
          </div>
        </div>
      )}

      {/* Service Selection Grid */}
      {filteredProducts?.length === 0 ? (
        <div className="text-center py-8">
          <Icon name="Package" size={48} className="text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No services available in this category</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
          {filteredProducts?.map((product) => {
            const isSelected = selectedProducts?.some(p => p?.id === product?.id);
            const hasVendor = !!product?.vendor_id;
            
            return (
              <div
                key={product?.id}
                className={`relative p-4 border rounded-lg cursor-pointer transition-all duration-200 hover:shadow-elevation-1 ${
                  isSelected
                    ? 'border-primary bg-primary/5 shadow-elevation-1' 
                    : 'border-border hover:border-primary/50'
                }`}
                onClick={() => handleServiceSelect(product)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start space-x-3 flex-1">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-lg flex-shrink-0 ${
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                    }`}>
                      <Icon name={hasVendor ? "MapPin" : "Wrench"} size={18} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">{product?.name}</h4>
                      <p className="text-xs text-muted-foreground">{product?.category}</p>
                      {hasVendor && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Icon name="MapPin" size={12} className="text-orange" />
                          <span className="text-xs text-orange font-medium">Off-Site Service</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {isSelected && (
                    <Icon name="CheckCircle" size={20} className="text-primary flex-shrink-0" />
                  )}
                </div>
                
                {product?.description && (
                  <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                    {product?.description}
                  </p>
                )}
                
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Price:</span>
                    <span className="font-medium text-foreground">
                      ${parseFloat(product?.unit_price || 0)?.toFixed(2)}
                    </span>
                  </div>
                  {product?.cost > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Profit:</span>
                      <span className={`font-medium ${
                        (product?.unit_price - product?.cost) >= 0 ? 'text-success' : 'text-error'
                      }`}>
                        ${((product?.unit_price || 0) - (product?.cost || 0))?.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {hasVendor && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Vendor:</span>
                      <span className="text-orange font-medium truncate ml-2">
                        {getVendorDisplayName(product?.vendor_id)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Selected Services Configuration */}
      {selectedProducts?.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-border">
            <Icon name="Settings" size={16} className="text-muted-foreground" />
            <h4 className="text-sm font-medium text-foreground">Configure Selected Services</h4>
            <span className="text-xs text-muted-foreground">({selectedProducts?.length} items)</span>
          </div>
          
          {selectedProducts?.map((service, index) => {
            const isOffsite = !!service?.vendorId || service?.isOffsite;
            
            return (
              <div key={service?.id} className="p-4 bg-muted/20 border border-border rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-lg">
                      <Icon name={isOffsite ? "MapPin" : "Wrench"} size={14} className="text-primary" />
                    </div>
                    <div>
                      <span className="font-medium text-foreground">{service?.name}</span>
                      {isOffsite && (
                        <div className="flex items-center space-x-1 mt-1">
                          <Icon name="MapPin" size={12} className="text-orange" />
                          <span className="text-xs text-orange">Off-Site Service</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onProductToggle(service?.id, false)}
                    className="w-8 h-8 text-muted-foreground hover:text-error"
                    iconName="X"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {/* Quantity */}
                  <Input
                    label="Quantity"
                    type="number"
                    min="1"
                    value={service?.quantity || 1}
                    onChange={(e) => handleServiceFieldUpdate(service?.id, 'quantity', parseInt(e?.target?.value) || 1)}
                    placeholder=""
                    helperText=""
                    maxLength={10}
                    style={{}}
                  />

                  {/* Unit Price (Your Cost) */}
                  <Input
                    label="Your Cost"
                    type="number"
                    step="0.01"
                    min="0"
                    value={service?.cost || 0}
                    onChange={(e) => handleServiceFieldUpdate(service?.id, 'cost', parseFloat(e?.target?.value) || 0)}
                    placeholder=""
                    helperText=""
                    maxLength={10}
                    style={{}}
                  />

                  {/* Unit Price */}
                  <Input
                    label="Unit Price"
                    type="number"
                    step="0.01"
                    min="0"
                    value={service?.price || 0}
                    onChange={(e) => handleServiceFieldUpdate(service?.id, 'price', parseFloat(e?.target?.value) || 0)}
                    placeholder=""
                    helperText=""
                    maxLength={10}
                    style={{}}
                  />

                  {/* Profit Display */}
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-foreground mb-2">Total Profit</label>
                    <div className={`flex items-center justify-center h-10 px-3 border border-border rounded-lg font-medium text-sm ${
                      calculateProfit(service?.cost, service?.price, service?.quantity) >= 0 
                        ? 'bg-success/10 text-success border-success/20' :'bg-error/10 text-error border-error/20'
                    }`}>
                      ${calculateProfit(service?.cost, service?.price, service?.quantity)?.toFixed(2)}
                    </div>
                  </div>

                  {/* Vendor Assignment */}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2">
                      Vendor {isOffsite && <Icon name="MapPin" size={12} className="inline text-orange ml-1" />}
                    </label>
                    <div className="space-y-2">
                      <Select
                        value={service?.vendorId || ''}
                        onChange={(value) => handleServiceFieldUpdate(service?.id, 'vendorId', value)}
                      >
                        <option value="">In-House Service</option>
                        {vendors?.map(vendor => (
                          <option key={vendor?.id} value={vendor?.id}>
                            {vendor?.name} - {vendor?.specialty}
                          </option>
                        ))}
                      </Select>
                      <div className="flex items-center space-x-1">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          service?.isOffsite 
                            ? 'bg-orange/10 text-orange' : 'bg-success/10 text-success'
                        }`}>
                          {getVendorDisplayName(service?.vendorId)}
                        </span>
                        {isOffsite && service?.requiresSchedule && (
                          <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                            Requires Schedule
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Additional Options - Loaner Vehicle */}
                  <div className="flex flex-col">
                    <label className="text-sm font-medium text-foreground mb-2">Loaner Vehicle Required</label>
                    <div className="flex items-center h-10">
                      <input
                        type="checkbox"
                        id={`loaner-${service?.id}`}
                        checked={service?.requiresLoaner || false}
                        onChange={(e) => handleServiceFieldUpdate(service?.id, 'requiresLoaner', e?.target?.checked)}
                        className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                      />
                      <label 
                        htmlFor={`loaner-${service?.id}`}
                        className="ml-2 text-sm text-foreground cursor-pointer"
                      >
                        Customer needs replacement vehicle
                      </label>
                    </div>
                  </div>
                </div>

                {/* Scheduling Requirements - Only for off-site services */}
                {isOffsite && (
                  <div className="mt-4 pt-4 border-t border-border">
                    <h5 className="text-sm font-medium text-foreground mb-3 flex items-center space-x-2">
                      <Icon name="Calendar" size={14} />
                      <span>Scheduling Requirements</span>
                    </h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-foreground mb-2">Requires Scheduling</label>
                        <div className="flex items-center h-10">
                          <input
                            type="checkbox"
                            id={`schedule-${service?.id}`}
                            checked={service?.requiresSchedule || false}
                            onChange={(e) => handleServiceFieldUpdate(service?.id, 'requiresSchedule', e?.target?.checked)}
                            className="w-4 h-4 text-primary bg-background border-border rounded focus:ring-primary"
                          />
                          <label 
                            htmlFor={`schedule-${service?.id}`}
                            className="ml-2 text-sm text-foreground cursor-pointer"
                          >
                            Service requires scheduling
                          </label>
                        </div>
                      </div>

                      <div className="flex flex-col">
                        <label className="text-sm font-medium text-foreground mb-2">Off-Site Service</label>
                        <div className="flex items-center h-10">
                          <input
                            type="checkbox"
                            checked={isOffsite}
                            disabled
                            className="w-4 h-4 text-orange bg-background border-border rounded"
                          />
                          <span className="ml-2 text-sm text-muted-foreground">
                            Work performed at vendor location
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Configuration - Only show if requires schedule */}
                    {service?.requiresSchedule && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <Input
                          label="Start Date"
                          type="date"
                          value={service?.startDate || ''}
                          onChange={(e) => handleServiceFieldUpdate(service?.id, 'startDate', e?.target?.value)}
                          placeholder=""
                          helperText=""
                          maxLength={20}
                          style={{}}
                        />
                        <Input
                          label="Days to Complete"
                          type="number"
                          min="1"
                          value={service?.daysToComplete || ''}
                          onChange={(e) => handleServiceFieldUpdate(service?.id, 'daysToComplete', e?.target?.value)}
                          placeholder="3"
                          helperText=""
                          maxLength={10}
                          style={{}}
                        />
                        <div className="flex flex-col">
                          <label className="text-sm font-medium text-foreground mb-2">Completion Date</label>
                          <div className="flex items-center h-10 px-3 border border-border rounded-lg bg-muted">
                            <span className="text-sm text-muted-foreground">
                              {service?.endDate || 'Auto-calculated'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Notes */}
                <div className="mt-4">
                  <Input
                    label="Service Notes"
                    type="text"
                    value={service?.notes || ''}
                    onChange={(e) => handleServiceFieldUpdate(service?.id, 'notes', e?.target?.value)}
                    placeholder="Special instructions, warranty details, or additional notes..."
                    helperText=""
                    maxLength={500}
                    style={{}}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProductSelectionGrid;