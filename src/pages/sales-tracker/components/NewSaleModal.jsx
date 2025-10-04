import React, { useState, useEffect } from 'react';
import { X, User, Car, DollarSign, Plus, Trash2, Calendar } from 'lucide-react';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import { vendorService } from '../../../services/vendorService';
import productService from '../../../services/productService';

const NewSaleModal = ({ isOpen, onClose, onSubmit, staffMembers }) => {
  const [formData, setFormData] = useState({
    saleDate: new Date()?.toISOString()?.split('T')?.[0],
    needsLoaner: false,
    salesRepresentative: '',
    customerName: '',
    customerEmail: '',
    customerPhone: '',
    vehicle: {
      stockNumber: '',
      make: '',
      model: '',
      year: '',
      color: ''
    },
    itemsSold: [
      {
        id: Date.now(),
        itemName: '',
        isCustomItem: false,
        cost: '',
        price: '',
        processingType: 'in-house',
        vendorId: '',
        vendorDate: '',
        etaReturn: '',
        notes: ''
      }
    ],
    assignedTo: '',
    deliveryCoordinator: '',
    notes: ''
  });
  
  const [loading, setLoading] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [availableServices, setAvailableServices] = useState([]);

  // Load vendors and services
  useEffect(() => {
    const loadData = async () => {
      try {
        const [vendorData, serviceData] = await Promise.all([
          vendorService?.getAllVendors(),
          productService?.getAllProducts()
        ]);
        setVendors(vendorData || []);
        setAvailableServices(serviceData || []);
      } catch (error) {
        console.error('Error loading data:', error);
        setVendors([]);
        setAvailableServices([]);
      }
    };
    
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  const handleInputChange = (field, value) => {
    if (field?.includes('.')) {
      const [parent, child] = field?.split('.');
      setFormData(prev => ({
        ...prev,
        [parent]: {
          ...prev?.[parent],
          [child]: value
        }
      }));
    } else {
      setFormData(prev => ({ ...prev, [field]: value }));
    }
  };

  const handleLineItemChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      itemsSold: prev?.itemsSold?.map((item, i) => {
        if (i === index) {
          const updatedItem = { ...item, [field]: value };
          
          // Clear vendor fields when switching to in-house
          if (field === 'processingType') {
            if (value === 'in-house') {
              updatedItem.vendorId = '';
              updatedItem.vendorDate = '';
              updatedItem.etaReturn = '';
            }
          }
          
          // Handle custom item creation
          if (field === 'itemName' && value === 'add-new') {
            updatedItem.isCustomItem = true;
            updatedItem.itemName = '';
            return updatedItem;
          }
          
          // Reset custom item flag when selecting predefined item
          if (field === 'itemName' && value !== 'add-new') {
            updatedItem.isCustomItem = false;
          }
          
          // If selecting a predefined service/item, populate its data
          if (field === 'itemName' && value && !updatedItem?.isCustomItem && value !== 'add-new') {
            const selectedService = availableServices?.find(service => service?.id === value);
            if (selectedService) {
              updatedItem.cost = selectedService?.unit_price?.toString() || '';
              updatedItem.price = (selectedService?.unit_price * 1.3)?.toFixed(2)?.toString();
            }
          }
          
          return updatedItem;
        }
        return item;
      })
    }));
  };

  const addLineItem = () => {
    setFormData(prev => ({
      ...prev,
      itemsSold: [
        ...prev?.itemsSold,
        {
          id: Date.now(),
          itemName: '',
          isCustomItem: false,
          cost: '',
          price: '',
          processingType: 'in-house',
          vendorId: '',
          vendorDate: '',
          etaReturn: '',
          notes: ''
        }
      ]
    }));
  };

  const removeLineItem = (index) => {
    if (formData?.itemsSold?.length > 1) {
      setFormData(prev => ({
        ...prev,
        itemsSold: prev?.itemsSold?.filter((_, i) => i !== index)
      }));
    }
  };

  const calculateLineItemProfit = (cost, price) => {
    const costNum = parseFloat(cost) || 0;
    const priceNum = parseFloat(price) || 0;
    return priceNum - costNum;
  };

  const calculateTotals = () => {
    const totalCost = formData?.itemsSold?.reduce((sum, item) => sum + (parseFloat(item?.cost) || 0), 0);
    const totalPrice = formData?.itemsSold?.reduce((sum, item) => sum + (parseFloat(item?.price) || 0), 0);
    const totalProfit = totalPrice - totalCost;
    
    return { totalCost, totalPrice, totalProfit };
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    setLoading(true);

    try {
      const { totalCost, totalPrice } = calculateTotals();
      
      // Build items sold with all required data
      const processedItemsSold = formData?.itemsSold?.map(item => ({
        item_name: item?.isCustomItem ? item?.itemName : 
          availableServices?.find(s => s?.id === item?.itemName)?.name || item?.itemName,
        item_id: item?.isCustomItem ? null : item?.itemName,
        cost: parseFloat(item?.cost) || 0,
        price: parseFloat(item?.price) || 0,
        profit: calculateLineItemProfit(item?.cost, item?.price),
        vendor_id: item?.processingType === 'vendor' ? item?.vendorId : null,
        is_in_house: item?.processingType === 'in-house',
        vendor_date: item?.vendorDate || null,
        eta_return: item?.etaReturn || null,
        notes: item?.notes || null
      }));

      const saleData = {
        saleDate: formData?.saleDate,
        needsLoaner: formData?.needsLoaner,
        salesRepresentative: formData?.salesRepresentative,
        customerName: formData?.customerName,
        customerEmail: formData?.customerEmail,
        customerPhone: formData?.customerPhone,
        vehicle: formData?.vehicle?.make ? formData?.vehicle : null,
        itemsSold: processedItemsSold,
        subtotal: totalCost,
        totalAmount: totalPrice,
        assignedTo: formData?.assignedTo || null,
        deliveryCoordinator: formData?.deliveryCoordinator || null,
        notes: formData?.notes
      };

      await onSubmit?.(saleData);
    } catch (error) {
      console.error('Error submitting form:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const { totalCost, totalPrice, totalProfit } = calculateTotals();

  // Prepare options for dropdowns
  const salesRepOptions = [
    { value: '', label: 'Select sales representative' },
    ...(staffMembers?.map(staff => ({
      value: staff?.id,
      label: staff?.full_name
    })) || []),
    { value: 'add-new', label: 'Add New' }
  ];

  const itemNameOptions = [
    { value: '', label: 'Select Item' },
    ...(availableServices?.map(service => ({
      value: service?.id,
      label: `${service?.name} - $${service?.unit_price}`
    })) || []),
    { value: 'add-new', label: 'Add New' }
  ];

  const processingTypeOptions = [
    { value: 'in-house', label: 'In House' },
    { value: 'vendor', label: 'Vendor' },
    { value: 'add-new', label: 'Add New' }
  ];

  const vendorOptions = [
    { value: '', label: 'Select Vendor' },
    ...(vendors?.map(vendor => ({
      value: vendor?.id,
      label: vendor?.name
    })) || []),
    { value: 'add-new', label: 'Add New' }
  ];

  const staffOptions = [
    { value: '', label: 'Select staff member' },
    ...(staffMembers?.map(staff => ({
      value: staff?.id,
      label: staff?.full_name
    })) || []),
    { value: 'add-new', label: 'Add New' }
  ];

  const coordinatorOptions = [
    { value: '', label: 'Select coordinator' },
    ...(staffMembers?.map(staff => ({
      value: staff?.id,
      label: staff?.full_name
    })) || []),
    { value: 'add-new', label: 'Add New' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add New Sale</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
            disabled={loading}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Sale Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900">Sale Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sale Date *
                </label>
                <Input
                  type="date"
                  required
                  value={formData?.saleDate}
                  onChange={(e) => handleInputChange('saleDate', e?.target?.value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sales Representative *
                </label>
                <Select
                  options={salesRepOptions}
                  value={formData?.salesRepresentative}
                  onChange={(value) => handleInputChange('salesRepresentative', value)}
                  required
                />
              </div>
              <div className="flex items-center">
                <div className="flex items-center h-5">
                  <input
                    id="needsLoaner"
                    type="checkbox"
                    checked={formData?.needsLoaner}
                    onChange={(e) => handleInputChange('needsLoaner', e?.target?.checked)}
                    className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
                  />
                </div>
                <div className="ml-3 text-sm">
                  <label htmlFor="needsLoaner" className="font-medium text-gray-700">
                    Customer Needs Loaner Vehicle
                  </label>
                  <p className="text-gray-500">Check if customer requires a temporary vehicle</p>
                </div>
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <User className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900">Customer Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <Input
                  type="text"
                  required
                  value={formData?.customerName}
                  onChange={(e) => handleInputChange('customerName', e?.target?.value)}
                  placeholder="Enter customer name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={formData?.customerEmail}
                  onChange={(e) => handleInputChange('customerEmail', e?.target?.value)}
                  placeholder="customer@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <Input
                  type="tel"
                  value={formData?.customerPhone}
                  onChange={(e) => handleInputChange('customerPhone', e?.target?.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
            </div>
          </div>

          {/* Vehicle Information */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Car className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900">Vehicle Information</h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Stock Number
                </label>
                <Input
                  type="text"
                  value={formData?.vehicle?.stockNumber}
                  onChange={(e) => handleInputChange('vehicle.stockNumber', e?.target?.value)}
                  placeholder="STK-2024-001"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Year *
                </label>
                <Input
                  type="number"
                  min="1980"
                  max="2025"
                  required
                  value={formData?.vehicle?.year}
                  onChange={(e) => handleInputChange('vehicle.year', e?.target?.value)}
                  placeholder="2020"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Make *
                </label>
                <Input
                  type="text"
                  required
                  value={formData?.vehicle?.make}
                  onChange={(e) => handleInputChange('vehicle.make', e?.target?.value)}
                  placeholder="Honda, Toyota, Ford, etc."
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Model *
                </label>
                <Input
                  type="text"
                  required
                  value={formData?.vehicle?.model}
                  onChange={(e) => handleInputChange('vehicle.model', e?.target?.value)}
                  placeholder="Civic, Camry, F-150, etc."
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Color
                </label>
                <Input
                  type="text"
                  value={formData?.vehicle?.color}
                  onChange={(e) => handleInputChange('vehicle.color', e?.target?.value)}
                  placeholder="Red, Blue, White, Silver, etc."
                />
              </div>
            </div>
          </div>

          {/* Items Sold */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900">Items Sold</h3>
            </div>

            <div className="space-y-3">
              {formData?.itemsSold?.map((item, index) => (
                <div key={item?.id} className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {/* Row 1: Item Name, Cost, Price, Profit */}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Item #{index + 1} - Item Name *
                      </label>
                      <div className="space-y-2">
                        <Select
                          options={itemNameOptions}
                          value={item?.isCustomItem ? 'add-new' : item?.itemName}
                          onChange={(value) => handleLineItemChange(index, 'itemName', value)}
                          required
                        />
                        
                        {item?.isCustomItem && (
                          <Input
                            type="text"
                            placeholder="Enter custom item name"
                            value={item?.itemName}
                            onChange={(e) => handleLineItemChange(index, 'itemName', e?.target?.value)}
                            required
                          />
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Cost *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={item?.cost}
                        onChange={(e) => handleLineItemChange(index, 'cost', e?.target?.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Price *
                      </label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        required
                        value={item?.price}
                        onChange={(e) => handleLineItemChange(index, 'price', e?.target?.value)}
                        placeholder="0.00"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Profit
                      </label>
                      <div className="h-10 px-3 border border-gray-300 rounded-md flex items-center bg-gray-100">
                        <span className={`text-sm font-medium ${
                          calculateLineItemProfit(item?.cost, item?.price) >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${calculateLineItemProfit(item?.cost, item?.price)?.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Row 2: Processing Type, Vendor Selection, Date for Vendor, ETA Return, Remove Button */}
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Processing Type *
                      </label>
                      <Select
                        options={processingTypeOptions}
                        value={item?.processingType}
                        onChange={(value) => handleLineItemChange(index, 'processingType', value)}
                        required
                      />
                    </div>

                    <div className={item?.processingType !== 'vendor' ? "opacity-50" : ""}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Vendor {item?.processingType === 'vendor' && '*'}
                      </label>
                      <Select
                        options={vendorOptions}
                        value={item?.vendorId || ''}
                        onChange={(value) => handleLineItemChange(index, 'vendorId', value)}
                        required={item?.processingType === 'vendor'}
                        disabled={item?.processingType !== 'vendor'}
                      />
                    </div>

                    <div className={item?.processingType !== 'vendor' ? "opacity-50" : ""}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date for Vendor {item?.processingType === 'vendor' && '*'}
                      </label>
                      <Input
                        type="date"
                        required={item?.processingType === 'vendor'}
                        disabled={item?.processingType !== 'vendor'}
                        value={item?.vendorDate}
                        onChange={(e) => handleLineItemChange(index, 'vendorDate', e?.target?.value)}
                      />
                    </div>

                    <div className={item?.processingType !== 'vendor' ? "opacity-50" : ""}>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        ETA Return {item?.processingType === 'vendor' && '*'}
                      </label>
                      <Input
                        type="date"
                        required={item?.processingType === 'vendor'}
                        disabled={item?.processingType !== 'vendor'}
                        value={item?.etaReturn}
                        onChange={(e) => handleLineItemChange(index, 'etaReturn', e?.target?.value)}
                      />
                    </div>

                    <div className="flex items-end">
                      {formData?.itemsSold?.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLineItem(index)}
                          className="text-red-500 hover:text-red-700 p-2"
                          title="Remove Item"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              
              {/* Add Item Button */}
              <div className="flex justify-start pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={addLineItem}
                  className="flex items-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Another Item</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Summary & Assignment */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-gray-400" />
              <h3 className="text-lg font-medium text-gray-900">Summary & Assignment</h3>
            </div>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Cost
                </label>
                <div className="h-10 px-3 border border-gray-300 rounded-md flex items-center bg-gray-50">
                  <span className="text-sm font-medium text-gray-600">
                    ${totalCost?.toFixed(2)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Price
                </label>
                <div className="h-10 px-3 border border-gray-300 rounded-md flex items-center bg-gray-50">
                  <span className="text-sm font-medium text-gray-600">
                    ${totalPrice?.toFixed(2)}
                  </span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Profit
                </label>
                <div className="h-10 px-3 border border-gray-300 rounded-md flex items-center bg-gray-50">
                  <span className={`text-sm font-medium ${totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${totalProfit?.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned To
                </label>
                <Select
                  options={staffOptions}
                  value={formData?.assignedTo}
                  onChange={(value) => handleInputChange('assignedTo', value)}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Delivery Coordinator
                </label>
                <Select
                  options={coordinatorOptions}
                  value={formData?.deliveryCoordinator}
                  onChange={(value) => handleInputChange('deliveryCoordinator', value)}
                />
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Notes
              </label>
              <textarea
                className="w-full h-20 px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any additional notes or special instructions for this sale..."
                value={formData?.notes}
                onChange={(e) => handleInputChange('notes', e?.target?.value)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-4 pt-6 border-t border-gray-200">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center space-x-2"
            >
              {loading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{loading ? 'Adding...' : 'Add Sale'}</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NewSaleModal;