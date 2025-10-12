import React, { useState, useEffect } from 'react';
import { Button, Input, Select } from '../../components/ui';
import dealService from '../../services/dealService';

const DealForm = ({ deal, onSave, onCancel }) => {
  const [formData, setFormData] = useState({
    customer_name: '',
    vehicle: '',
    sales_person_id: '',
    finance_manager_id: '',
    product_id: ''
  });

  const [salesPeople, setSalesPeople] = useState([]);
  const [financeManagers, setFinanceManagers] = useState([]);
  const [products, setProducts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (deal) {
      setFormData({
        customer_name: deal?.customer_name || '',
        vehicle: deal?.vehicle || '',
        sales_person_id: deal?.sales_person_id || '',
        finance_manager_id: deal?.finance_manager_id || '',
        product_id: deal?.product_id || ''
      });
    }
  }, [deal]);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      const [salesData, financeData, productData] = await Promise.all([
        dealService?.getStaffByRole('sales'),
        dealService?.getStaffByRole('finance'),
        dealService?.getProducts()
      ]);
      setSalesPeople(salesData);
      setFinanceManagers(financeData);
      setProducts(productData);
      setIsLoading(false);
    };
    fetchData();
  }, []);

  const handleChange = (name, value) => {
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    onSave(formData);
  };

  const toOptions = (items, labelKey = 'full_name', valueKey = 'id') =>
    items?.map(item => ({ label: item?.[labelKey], value: item?.[valueKey] }));

  return (
    <div className="p-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Customer Name"
          name="customer_name"
          value={formData?.customer_name}
          onChange={(e) => handleChange('customer_name', e?.target?.value)}
          placeholder="Enter customer name"
          helperText=""
          maxLength={100}
          style={{}}
          required
        />
        
        <Input
          label="Vehicle"
          name="vehicle"
          value={formData?.vehicle}
          onChange={(e) => handleChange('vehicle', e?.target?.value)}
          placeholder="Enter vehicle details"
          helperText=""
          maxLength={100}
          style={{}}
          required
        />
        
        <Select
          label="Sales Person"
          name="sales_person_id"
          value={formData?.sales_person_id}
          onChange={(value) => handleChange('sales_person_id', value)}
          options={toOptions(salesPeople)}
          placeholder={isLoading ? "Loading..." : "Select a sales person"}
          loading={isLoading}
          required
        />
        
        <Select
          label="Finance Manager"
          name="finance_manager_id"
          value={formData?.finance_manager_id}
          onChange={(value) => handleChange('finance_manager_id', value)}
          options={toOptions(financeManagers)}
          placeholder={isLoading ? "Loading..." : "Select a finance manager"}
          loading={isLoading}
          required
        />
        
        <Select
          label="Products"
          name="product_id"
          value={formData?.product_id}
          onChange={(value) => handleChange('product_id', value)}
          options={toOptions(products, 'name', 'id')}
          placeholder={isLoading ? "Loading..." : "Select a product"}
          loading={isLoading}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button 
            type="button" 
            onClick={onCancel} 
            variant="secondary"
            className=""
          >
            Cancel
          </Button>
          <Button 
            type="submit"
            className=""
            onClick={() => {}}
          >
            Save Deal
          </Button>
        </div>
      </form>
    </div>
  );
};

export default DealForm;