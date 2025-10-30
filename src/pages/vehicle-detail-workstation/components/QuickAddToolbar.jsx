import React, { useState } from 'react';
import Icon from '../../../components/AppIcon';
import Button from '../../../components/ui/Button';
import Select from '../../../components/ui/Select';

const QuickAddToolbar = ({ onAddProduct, availableVendors }) => {
  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedVendor, setSelectedVendor] = useState('');

  const productCatalog = [
    { value: 'toughguard', label: 'ToughGuard Protection', description: 'Premium paint protection film' },
    { value: 'evernew', label: 'Evernew Coating', description: 'Ceramic coating system' },
    { value: 'windshield', label: 'Windshield Protection', description: 'Glass protection film' },
    { value: 'tint', label: 'Window Tint', description: 'Professional window tinting' },
    { value: 'wraps', label: 'Vehicle Wraps', description: 'Custom vinyl wrapping' }
  ];

  const vendorOptions = availableVendors?.map(vendor => ({
    value: vendor?.id,
    label: vendor?.name,
    description: `${vendor?.specialties?.join(', ')}`
  }));

  const handleQuickAdd = () => {
    if (selectedProduct && selectedVendor) {
      const product = productCatalog?.find(p => p?.value === selectedProduct);
      const vendor = availableVendors?.find(v => v?.id === selectedVendor);
      
      onAddProduct({
        productType: product?.label,
        productDescription: product?.description,
        vendorId: vendor?.id,
        vendorName: vendor?.name,
        status: 'Pending',
        dateAdded: new Date()?.toISOString(),
        estimatedCost: 0,
        salePrice: 0
      });

      setSelectedProduct('');
      setSelectedVendor('');
    }
  };

  const getAutoAssignedVendor = (productType) => {
    const productVendorMap = {
      'toughguard': availableVendors?.find(v => v?.specialties?.includes('Paint Protection')),
      'evernew': availableVendors?.find(v => v?.specialties?.includes('Ceramic Coating')),
      'windshield': availableVendors?.find(v => v?.specialties?.includes('Glass Protection')),
      'tint': availableVendors?.find(v => v?.specialties?.includes('Window Tinting')),
      'wraps': availableVendors?.find(v => v?.specialties?.includes('Vehicle Wraps'))
    };
    return productVendorMap?.[productType];
  };

  const handleProductChange = (value) => {
    setSelectedProduct(value);
    const autoVendor = getAutoAssignedVendor(value);
    if (autoVendor) {
      setSelectedVendor(autoVendor?.id);
    }
  };

  return (
    <div className="bg-card border border-border rounded-lg shadow-elevation-1 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-8 h-8 bg-accent/10 rounded-lg">
            <Icon name="Plus" size={16} className="text-accent" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Quick Add Product</h3>
            <p className="text-xs text-muted-foreground">Add aftermarket products with auto-vendor assignment</p>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1">
          <Select
            label="Product Type"
            placeholder="Select product..."
            options={productCatalog}
            value={selectedProduct}
            onChange={handleProductChange}
            searchable
          />
        </div>

        <div className="lg:col-span-1">
          <Select
            label="Assigned Vendor"
            placeholder="Select vendor..."
            options={vendorOptions}
            value={selectedVendor}
            onChange={setSelectedVendor}
            searchable
          />
        </div>

        <div className="lg:col-span-1 flex items-end">
          <Button
            variant="default"
            onClick={handleQuickAdd}
            disabled={!selectedProduct || !selectedVendor}
            iconName="Plus"
            iconPosition="left"
            className="w-full"
          >
            Add Product
          </Button>
        </div>
      </div>
      {/* Quick Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-border">
        <span className="text-xs text-muted-foreground mr-2">Quick Actions:</span>
        {productCatalog?.slice(0, 3)?.map((product) => (
          <Button
            key={product?.value}
            variant="outline"
            size="xs"
            onClick={() => handleProductChange(product?.value)}
            className="text-xs"
          >
            {product?.label}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default QuickAddToolbar;