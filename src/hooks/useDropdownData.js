import { useState, useEffect, useCallback } from 'react';
import { dropdownService } from '../services/dropdownService';

/**
 * Custom hook for managing dropdown data with caching and filtering
 * @param {Object} options - Configuration options
 * @param {boolean} options.loadOnMount - Load data when component mounts
 * @param {number} options.cacheTime - Cache time in milliseconds (default: 5 minutes)
 * @param {Object} options.filters - Default filters to apply
 * @returns {Object} Hook state and functions
 */
export const useDropdownData = (options = {}) => {
  const {
    loadOnMount = true,
    cacheTime = 5 * 60 * 1000, // 5 minutes
    filters = {}
  } = options;

  const [state, setState] = useState({
    // Data states
    users: [],
    vendors: [],
    products: [],
    dealFormData: null,
    searchResults: null,
    
    // Loading states
    loading: false,
    usersLoading: false,
    vendorsLoading: false,
    productsLoading: false,
    dealFormLoading: false,
    
    // Error states
    error: null,
    usersError: null,
    vendorsError: null,
    productsError: null,
    
    // Cache info
    lastFetch: null,
    cacheValid: false
  });

  // Check if cache is valid
  const isCacheValid = useCallback(() => {
    if (!state?.lastFetch) return false;
    return Date.now() - state?.lastFetch < cacheTime;
  }, [state?.lastFetch, cacheTime]);

  // Generic error handler
  const handleError = useCallback((error, type) => {
    console.error(`Dropdown data error (${type}):`, error);
    setState(prev => ({
      ...prev,
      error: error?.message || 'Failed to load data',
      [`${type}Error`]: error?.message || 'Failed to load data',
      [`${type}Loading`]: false,
      loading: false
    }));
  }, []);

  // Load users with filtering
  const loadUsers = useCallback(async (userFilters = {}) => {
    try {
      setState(prev => ({ ...prev, usersLoading: true, usersError: null }));
      
      const users = await dropdownService?.getUsers({
        ...filters,
        ...userFilters
      });
      
      setState(prev => ({
        ...prev,
        users,
        usersLoading: false,
        usersError: null,
        lastFetch: Date.now(),
        cacheValid: true
      }));
      
      return users;
    } catch (error) {
      handleError(error, 'users');
      return [];
    }
  }, [filters, handleError]);

  // Load vendors with filtering  
  const loadVendors = useCallback(async (vendorFilters = {}) => {
    try {
      setState(prev => ({ ...prev, vendorsLoading: true, vendorsError: null }));
      
      const vendors = await dropdownService?.getVendors({
        ...filters,
        ...vendorFilters
      });
      
      setState(prev => ({
        ...prev,
        vendors,
        vendorsLoading: false,
        vendorsError: null,
        lastFetch: Date.now(),
        cacheValid: true
      }));
      
      return vendors;
    } catch (error) {
      handleError(error, 'vendors');
      return [];
    }
  }, [filters, handleError]);

  // Load products with filtering
  const loadProducts = useCallback(async (productFilters = {}) => {
    try {
      setState(prev => ({ ...prev, productsLoading: true, productsError: null }));
      
      const products = await dropdownService?.getProducts({
        ...filters,
        ...productFilters
      });
      
      setState(prev => ({
        ...prev,
        products,
        productsLoading: false,
        productsError: null,
        lastFetch: Date.now(),
        cacheValid: true
      }));
      
      return products;
    } catch (error) {
      handleError(error, 'products');
      return [];
    }
  }, [filters, handleError]);

  // Load all deal form data (optimized single call)
  const loadDealFormData = useCallback(async (forceRefresh = false) => {
    try {
      // Use cache if valid and not forcing refresh
      if (!forceRefresh && state?.dealFormData && isCacheValid()) {
        return state?.dealFormData;
      }

      setState(prev => ({ ...prev, dealFormLoading: true, error: null }));
      
      const dealFormData = await dropdownService?.getDealFormData();
      
      setState(prev => ({
        ...prev,
        dealFormData,
        dealFormLoading: false,
        error: null,
        lastFetch: Date.now(),
        cacheValid: true
      }));
      
      return dealFormData;
    } catch (error) {
      handleError(error, 'dealForm');
      return null;
    }
  }, [state?.dealFormData, isCacheValid, handleError]);

  // Perform global search
  const globalSearch = useCallback(async (searchTerm, searchOptions = {}) => {
    try {
      if (!searchTerm?.trim()) {
        setState(prev => ({ ...prev, searchResults: null }));
        return null;
      }

      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const searchResults = await dropdownService?.globalSearch(searchTerm, {
        ...filters,
        ...searchOptions
      });
      
      setState(prev => ({
        ...prev,
        searchResults,
        loading: false,
        error: null
      }));
      
      return searchResults;
    } catch (error) {
      handleError(error, 'search');
      return null;
    }
  }, [filters, handleError]);

  // Clear search results
  const clearSearch = useCallback(() => {
    setState(prev => ({ ...prev, searchResults: null }));
  }, []);

  // Refresh all data
  const refreshAll = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, loading: true, error: null }));
      
      const [users, vendors, products, dealFormData] = await Promise.all([
        dropdownService?.getUsers(filters),
        dropdownService?.getVendors(filters),
        dropdownService?.getProducts(filters),
        dropdownService?.getDealFormData()
      ]);
      
      setState(prev => ({
        ...prev,
        users,
        vendors,
        products,
        dealFormData,
        loading: false,
        error: null,
        lastFetch: Date.now(),
        cacheValid: true
      }));
      
      return { users, vendors, products, dealFormData };
    } catch (error) {
      handleError(error, 'refresh');
      return null;
    }
  }, [filters, handleError]);

  // Clear cache and reload
  const invalidateCache = useCallback(() => {
    setState(prev => ({
      ...prev,
      lastFetch: null,
      cacheValid: false,
      dealFormData: null,
      searchResults: null
    }));
  }, []);

  // Load initial data on mount
  useEffect(() => {
    if (loadOnMount) {
      loadDealFormData();
    }
  }, [loadOnMount, loadDealFormData]);

  // Helper getters for common data patterns
  const getters = {
    // Get formatted options for SearchableSelect
    getUserOptions: (userFilters = {}) => {
      const filteredUsers = state?.users?.filter(user => {
        if (userFilters?.roles && !userFilters?.roles?.includes(user?.role)) return false;
        if (userFilters?.departments && !userFilters?.departments?.includes(user?.department)) return false;
        if (userFilters?.activeOnly && !user?.is_active) return false;
        return true;
      });

      return filteredUsers?.map(user => ({
        id: user?.id,
        name: user?.full_name,
        displayName: `${user?.full_name} (${user?.role})`,
        email: user?.email,
        role: user?.role,
        department: user?.department,
        category: user?.role
      })) || [];
    },

    getVendorOptions: (vendorFilters = {}) => {
      const filteredVendors = state?.vendors?.filter(vendor => {
        if (vendorFilters?.specialties && !vendorFilters?.specialties?.includes(vendor?.specialty)) return false;
        if (vendorFilters?.activeOnly && !vendor?.is_active) return false;
        if (vendorFilters?.minRating && vendor?.rating < vendorFilters?.minRating) return false;
        return true;
      });

      return filteredVendors?.map(vendor => ({
        id: vendor?.id,
        name: vendor?.name,
        displayName: `${vendor?.name}${vendor?.specialty ? ` (${vendor?.specialty})` : ''}`,
        specialty: vendor?.specialty,
        rating: vendor?.rating,
        category: vendor?.specialty
      })) || [];
    },

    getProductOptions: (productFilters = {}) => {
      const filteredProducts = state?.products?.filter(product => {
        if (productFilters?.categories && !productFilters?.categories?.includes(product?.category)) return false;
        if (productFilters?.brands && !productFilters?.brands?.includes(product?.brand)) return false;
        if (productFilters?.activeOnly && !product?.is_active) return false;
        if (productFilters?.inStockOnly && product?.quantity_in_stock <= 0) return false;
        return true;
      });

      return filteredProducts?.map(product => ({
        id: product?.id,
        name: product?.name,
        displayName: `${product?.name} - $${product?.unit_price}${product?.brand ? ` (${product?.brand})` : ''}`,
        category: product?.category,
        brand: product?.brand,
        unitPrice: product?.unit_price,
        cost: product?.cost,
        inStock: product?.quantity_in_stock > 0
      })) || [];
    },

    // Quick access to deal form data
    getSalesConsultants: () => state?.dealFormData?.salesConsultants || [],
    getDeliveryCoordinators: () => state?.dealFormData?.deliveryCoordinators || [],
    getActiveVendors: () => state?.dealFormData?.activeVendors || [],
    getActiveProducts: () => state?.dealFormData?.activeProducts || []
  };

  return {
    // Data states
    ...state,
    
    // Actions
    loadUsers,
    loadVendors,
    loadProducts,
    loadDealFormData,
    globalSearch,
    clearSearch,
    refreshAll,
    invalidateCache,
    
    // Helper getters
    ...getters,
    
    // Computed states
    hasData: Boolean(state?.users?.length || state?.vendors?.length || state?.products?.length),
    isLoading: state?.loading || state?.usersLoading || state?.vendorsLoading || state?.productsLoading || state?.dealFormLoading,
    hasError: Boolean(state?.error || state?.usersError || state?.vendorsError || state?.productsError),
    isCacheValid: isCacheValid()
  };
};

/**
 * Specialized hook for deal form dropdown data
 * Pre-configured for deal creation/editing workflows
 */
export const useDealFormDropdowns = () => {
  const {
    dealFormData,
    loadDealFormData,
    dealFormLoading,
    getSalesConsultants,
    getDeliveryCoordinators,
    getActiveVendors,
    getActiveProducts,
    ...rest
  } = useDropdownData({
    loadOnMount: true,
    cacheTime: 10 * 60 * 1000 // 10 minutes for deal forms
  });

  return {
    // Deal-specific data
    salesConsultants: getSalesConsultants(),
    deliveryCoordinators: getDeliveryCoordinators(),
    vendors: getActiveVendors(),
    products: getActiveProducts(),
    
    // Loading state
    loading: dealFormLoading,
    
    // Actions
    refresh: () => loadDealFormData(true),
    
    // Full data access
    fullData: dealFormData,
    
    // Pass through other functionality
    ...rest
  };
};

/**
 * Specialized hook for user management dropdown data
 */
export const useUserDropdowns = (userFilters = {}) => {
  const {
    users,
    loadUsers,
    usersLoading,
    usersError,
    getUserOptions,
    ...rest
  } = useDropdownData({
    loadOnMount: true,
    filters: userFilters
  });

  return {
    users: getUserOptions(),
    loading: usersLoading,
    error: usersError,
    refresh: () => loadUsers(userFilters),
    ...rest
  };
};

export default useDropdownData;