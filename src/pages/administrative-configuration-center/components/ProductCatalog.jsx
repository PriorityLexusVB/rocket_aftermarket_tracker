import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLogger } from '../../../hooks/useLogger';
import Button from '../../../components/ui/Button';
import Input from '../../../components/ui/Input';
import Select from '../../../components/ui/Select';
import productService from '../../../services/productService';
import vendorService from '../../../services/vendorService';

const ProductCatalog = () => {
  const { userProfile } = useAuth();
  const logger = useLogger();
  const [products, setProducts] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('add');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterVendor, setFilterVendor] = useState('');

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    brand: '',
    category: '',
    description: '',
    part_number: '',
    unit_price: '',
    quantity_in_stock: '',
    minimum_stock_level: '',
    vendor_id: '',
    is_active: true
  });

  const categories = [
    'Braking System',
    'Engine Components',
    'Suspension',
    'Electrical',
    'Body Parts',
    'Exhaust Systems',
    'Transmission',
    'Accessories',
    'Performance Parts',
    'Maintenance Items'
  ];

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [productData, vendorData] = await Promise.all([
        productService?.getAllProducts(),
        vendorService?.getAllVendors()
      ]);
      
      setProducts(productData);
      setVendors(vendorData?.filter(v => v?.is_active));
      
      await logger?.logInfo(
        'products_loaded',
        'PRODUCT',
        'list',
        `Loaded ${productData?.length} products for catalog management`,
        { productCount: productData?.length }
      );
    } catch (error) {
      console.error('Error loading data:', error);
      await logger?.logError(
        'product_load_error',
        'SYSTEM',
        'product-catalog',
        `Failed to load products: ${error?.message}`,
        { error: error?.message }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e?.preventDefault();
    
    try {
      if (formMode === 'add') {
        const newProduct = await productService?.createProduct(formData);
        setProducts(prev => [newProduct, ...prev]);
        
        await logger?.logSuccess(
          'product_added',
          'PRODUCT',
          newProduct?.id,
          `New product added: ${newProduct?.name}`,
          { productData: newProduct }
        );
      } else {
        const updatedProduct = await productService?.updateProduct(selectedProduct?.id, formData);
        setProducts(prev => prev?.map(p => p?.id === updatedProduct?.id ? updatedProduct : p));
        
        await logger?.logSuccess(
          'product_updated',
          'PRODUCT',
          updatedProduct?.id,
          `Product updated: ${updatedProduct?.name}`,
          { productData: updatedProduct }
        );
      }
      
      resetForm();
    } catch (error) {
      console.error('Error saving product:', error);
      await logger?.logError(
        'product_save_error',
        'PRODUCT',
        formMode === 'edit' ? selectedProduct?.id : 'new',
        `Failed to ${formMode} product: ${error?.message}`,
        { error: error?.message, formData }
      );
    }
  };

  const handleEditProduct = (product) => {
    setSelectedProduct(product);
    setFormData({
      name: product?.name || '',
      brand: product?.brand || '',
      category: product?.category || '',
      description: product?.description || '',
      part_number: product?.part_number || '',
      unit_price: product?.unit_price || '',
      quantity_in_stock: product?.quantity_in_stock || '',
      minimum_stock_level: product?.minimum_stock_level || '',
      vendor_id: product?.vendor_id || '',
      is_active: product?.is_active !== undefined ? product?.is_active : true
    });
    setFormMode('edit');
    setShowForm(true);
  };

  const handleDeleteProduct = async (productId) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    
    try {
      await productService?.deleteProduct(productId);
      setProducts(prev => prev?.filter(p => p?.id !== productId));
      
      await logger?.logSuccess(
        'product_deleted',
        'PRODUCT',
        productId,
        `Product deleted successfully`,
        { productId }
      );
    } catch (error) {
      console.error('Error deleting product:', error);
      await logger?.logError(
        'product_delete_error',
        'PRODUCT',
        productId,
        `Failed to delete product: ${error?.message}`,
        { error: error?.message, productId }
      );
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      brand: '',
      category: '',
      description: '',
      part_number: '',
      unit_price: '',
      quantity_in_stock: '',
      minimum_stock_level: '',
      vendor_id: '',
      is_active: true
    });
    setSelectedProduct(null);
    setShowForm(false);
    setFormMode('add');
  };

  const filteredProducts = products?.filter(product => {
    const matchesSearch = product?.name?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         product?.part_number?.toLowerCase()?.includes(searchTerm?.toLowerCase()) ||
                         product?.brand?.toLowerCase()?.includes(searchTerm?.toLowerCase());
    
    const matchesCategory = filterCategory === '' || product?.category === filterCategory;
    const matchesVendor = filterVendor === '' || product?.vendor_id === filterVendor;
    
    return matchesSearch && matchesCategory && matchesVendor;
  });

  if (loading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading product catalog...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Input
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e?.target?.value)}
            className="w-64"
          />
          
          <Select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e?.target?.value)}
            className="w-48"
          >
            <option value="">All Categories</option>
            {categories?.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </Select>

          <Select
            value={filterVendor}
            onChange={(e) => setFilterVendor(e?.target?.value)}
            className="w-48"
          >
            <option value="">All Vendors</option>
            {vendors?.map(vendor => (
              <option key={vendor?.id} value={vendor?.id}>{vendor?.name}</option>
            ))}
          </Select>
        </div>

        <Button
          onClick={() => {
            setFormMode('add');
            setShowForm(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          Add New Product
        </Button>
      </div>

      {/* Product Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-6">
        {filteredProducts?.map((product) => (
          <div key={product?.id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <h3 className="font-medium text-gray-900 truncate">{product?.name}</h3>
                <p className="text-sm text-gray-500">{product?.brand}</p>
                <p className="text-xs text-gray-400">{product?.part_number}</p>
              </div>
              <div className="flex items-center space-x-1">
                <span className={`w-2 h-2 rounded-full ${
                  product?.stock_status === 'low' ? 'bg-red-500' : 'bg-green-500'
                }`}></span>
                <span className={`text-xs ${
                  product?.is_active ? 'text-green-600' : 'text-red-600'
                }`}>
                  {product?.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
            </div>

            <div className="space-y-2 mb-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Price:</span>
                <span className="font-medium">${product?.unit_price}</span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Stock:</span>
                <span className={`font-medium ${
                  product?.stock_status === 'low' ? 'text-red-600' : 'text-gray-900'
                }`}>
                  {product?.quantity_in_stock}
                </span>
              </div>
              
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Vendor:</span>
                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                  {product?.vendor_name}
                </span>
              </div>

              {product?.category && (
                <div className="text-xs bg-gray-100 text-gray-800 px-2 py-1 rounded text-center">
                  {product?.category}
                </div>
              )}
            </div>

            <div className="flex space-x-2">
              <Button
                onClick={() => handleEditProduct(product)}
                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700 text-white"
              >
                Edit
              </Button>
              <Button
                onClick={() => handleDeleteProduct(product?.id)}
                className="text-xs bg-red-600 hover:bg-red-700 text-white px-3"
              >
                Delete
              </Button>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts?.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-6xl mb-4">📦</div>
          <p>No products found matching your criteria.</p>
        </div>
      )}

      {/* Product Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900">
                {formMode === 'add' ? 'Add New Product' : 'Edit Product'}
              </h3>
              <Button
                onClick={resetForm}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </Button>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Product Name *
                  </label>
                  <Input
                    value={formData?.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e?.target?.value }))}
                    required
                    placeholder="Enter product name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Brand
                  </label>
                  <Input
                    value={formData?.brand}
                    onChange={(e) => setFormData(prev => ({ ...prev, brand: e?.target?.value }))}
                    placeholder="Enter brand name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Category
                  </label>
                  <Select
                    value={formData?.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e?.target?.value }))}
                  >
                    <option value="">Select category</option>
                    {categories?.map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Part Number
                  </label>
                  <Input
                    value={formData?.part_number}
                    onChange={(e) => setFormData(prev => ({ ...prev, part_number: e?.target?.value }))}
                    placeholder="Enter part number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Unit Price *
                  </label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData?.unit_price}
                    onChange={(e) => setFormData(prev => ({ ...prev, unit_price: e?.target?.value }))}
                    required
                    placeholder="Enter price"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vendor *
                  </label>
                  <Select
                    value={formData?.vendor_id}
                    onChange={(e) => setFormData(prev => ({ ...prev, vendor_id: e?.target?.value }))}
                    required
                  >
                    <option value="">Select vendor</option>
                    {vendors?.map(vendor => (
                      <option key={vendor?.id} value={vendor?.id}>{vendor?.name}</option>
                    ))}
                  </Select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quantity in Stock
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData?.quantity_in_stock}
                    onChange={(e) => setFormData(prev => ({ ...prev, quantity_in_stock: e?.target?.value }))}
                    placeholder="Enter quantity"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Minimum Stock Level
                  </label>
                  <Input
                    type="number"
                    min="0"
                    value={formData?.minimum_stock_level}
                    onChange={(e) => setFormData(prev => ({ ...prev, minimum_stock_level: e?.target?.value }))}
                    placeholder="Enter minimum level"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData?.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e?.target?.value }))}
                  placeholder="Enter product description"
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData?.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e?.target?.checked }))}
                  className="rounded"
                />
                <label className="ml-2 text-sm text-gray-700">
                  Active Product
                </label>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  {formMode === 'add' ? 'Add Product' : 'Update Product'}
                </Button>
                <Button
                  type="button"
                  onClick={resetForm}
                  className="px-6 bg-gray-500 hover:bg-gray-600 text-white"
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProductCatalog;