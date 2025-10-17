import { supabase, isSupabaseConfigured, testSupabaseConnection } from '../lib/supabase';

/**
 * Dropdown Service for standardized data source management
 * Provides filtered data sources for users, vendors, and products with exact specifications
 */

// Connection validation helper
const validateConnection = async () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not properly configured. Please check your environment variables.');
  }
  
  // Test connection on first use
  if (!validateConnection?.tested) {
    const isConnected = await testSupabaseConnection();
    if (!isConnected) {
      throw new Error('Cannot connect to Supabase. Please check your configuration and network connection.');
    }
    validateConnection.tested = true;
  }
};

// Enhanced error handling
const handleSupabaseError = (error, operation) => {
  console.error(`Supabase error in ${operation}:`, {
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
    code: error?.code
  });

  // Provide more specific error messages based on error type
  if (error?.message?.includes('Failed to fetch')) {
    throw new Error('Network connection error. Please check your internet connection and try again.');
  } else if (error?.message?.includes('JWT')) {
    throw new Error('Authentication error. Please refresh the page and try again.');
  } else if (error?.code === 'PGRST116') {
    throw new Error('Database table not found. Please contact support.');
  } else {
    throw new Error(`Database error: ${error.message}`);
  }
};

export const dropdownService = {
  /**
   * Get all user profiles with filtering options
   * @param {Object} filters - Filter criteria
   * @param {string|string[]} filters.roles - Single role or array of roles to filter by
   * @param {string|string[]} filters.departments - Single department or array of departments
   * @param {boolean} filters.activeOnly - Only active users (default: true)
   * @param {string} filters.search - Search in full_name or email
   * @param {string} filters.sortBy - Field to sort by (default: 'full_name')
   * @param {string} filters.sortOrder - 'asc' or 'desc' (default: 'asc')
   * @returns {Promise<Array>} Filtered user profiles
   */
  async getUsers(filters = {}) {
    try {
      await validateConnection();

      const {
        roles = null,
        departments = null,
        activeOnly = true,
        search = null,
        sortBy = 'full_name',
        sortOrder = 'asc',
        limit = null
      } = filters;

      let query = supabase?.from('user_profiles')?.select('id, full_name, email, role, department, phone, is_active, vendor_id');

      if (!query) {
        throw new Error('Failed to create query. Supabase client is not available.');
      }

      // Role filtering - supports single role or array of roles
      if (roles) {
        if (Array.isArray(roles)) {
          query = query?.in('role', roles);
        } else {
          query = query?.eq('role', roles);
        }
      }

      // Department filtering - supports single or multiple departments
      if (departments) {
        if (Array.isArray(departments)) {
          query = query?.in('department', departments);
        } else {
          query = query?.eq('department', departments);
        }
      }

      // Active status filtering
      if (activeOnly) {
        query = query?.eq('is_active', true);
      }

      // Search functionality
      if (search?.trim()) {
        const searchTerm = `%${search?.trim()}%`;
        query = query?.or(`full_name.ilike.${searchTerm},email.ilike.${searchTerm}`);
      }

      // Sorting
      if (sortOrder === 'desc') {
        query = query?.order(sortBy, { ascending: false });
      } else {
        query = query?.order(sortBy, { ascending: true });
      }

      // Limit results
      if (limit && typeof limit === 'number' && limit > 0) {
        query = query?.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error, 'getUsers');
      }

      return data || [];
    } catch (error) {
      if (error?.message?.includes('Supabase') || error?.message?.includes('Network') || error?.message?.includes('Authentication')) {
        throw error; // Re-throw our custom errors
      }
      console.error('Error fetching users:', error);
      throw new Error('Failed to fetch users. Please try again later.');
    }
  },

  /**
   * Get user profiles by specific user types with exact specifications
   */
  async getUsersByType() {
    try {
      await validateConnection();

      const [salesConsultants, deliveryCoordinators, managers, admins, vendors] = await Promise.all([
        // Sales Consultants - Staff role in Sales Consultants department
        this.getUsers({
          roles: 'staff',
          departments: 'Sales Consultants',
          activeOnly: true,
          sortBy: 'full_name'
        }),

        // Delivery Coordinators - Admin/Manager role in Delivery Coordinator department
        this.getUsers({
          roles: ['admin', 'manager'],
          departments: 'Delivery Coordinator',
          activeOnly: true,
          sortBy: 'full_name'
        }),

        // Managers - Manager role, any department
        this.getUsers({
          roles: 'manager',
          activeOnly: true,
          sortBy: 'full_name'
        }),

        // Admins - Admin role, any department
        this.getUsers({
          roles: 'admin',
          activeOnly: true,
          sortBy: 'full_name'
        }),

        // Vendor Users - Users with vendor_id assigned
        this.getUsers({
          roles: 'vendor',
          activeOnly: true,
          sortBy: 'full_name'
        })
      ]);

      return {
        salesConsultants,
        deliveryCoordinators,
        managers,
        admins,
        vendors: vendors,
        allStaff: [...salesConsultants, ...deliveryCoordinators, ...managers, ...admins],
        allActive: await this.getUsers({ activeOnly: true })
      };
    } catch (error) {
      console.error('Error fetching users by type:', error);
      // Return empty structure instead of throwing to prevent complete failure
      return {
        salesConsultants: [],
        deliveryCoordinators: [],
        managers: [],
        admins: [],
        vendors: [],
        allStaff: [],
        allActive: []
      };
    }
  },

  /**
   * Get all vendors with filtering options
   * @param {Object} filters - Filter criteria
   * @param {boolean} filters.activeOnly - Only active vendors (default: true)
   * @param {string} filters.search - Search in name, specialty, or contact_person
   * @param {string|string[]} filters.specialties - Filter by specialty
   * @param {number} filters.minRating - Minimum rating filter
   * @param {string} filters.sortBy - Field to sort by (default: 'name')
   * @param {string} filters.sortOrder - 'asc' or 'desc' (default: 'asc')
   * @returns {Promise<Array>} Filtered vendors
   */
  async getVendors(filters = {}) {
    try {
      await validateConnection();

      const {
        activeOnly = true,
        search = null,
        specialties = null,
        minRating = null,
        sortBy = 'name',
        sortOrder = 'asc',
        limit = null
      } = filters;

      let query = supabase?.from('vendors')?.select('id, name, specialty, contact_person, phone, email, address, rating, is_active, notes');

      if (!query) {
        throw new Error('Failed to create query. Supabase client is not available.');
      }

      // Active status filtering
      if (activeOnly) {
        query = query?.eq('is_active', true);
      }

      // Search functionality
      if (search?.trim()) {
        const searchTerm = `%${search?.trim()}%`;
        query = query?.or(`name.ilike.${searchTerm},specialty.ilike.${searchTerm},contact_person.ilike.${searchTerm}`);
      }

      // Specialty filtering
      if (specialties) {
        if (Array.isArray(specialties)) {
          query = query?.in('specialty', specialties);
        } else {
          query = query?.eq('specialty', specialties);
        }
      }

      // Rating filtering
      if (minRating !== null && typeof minRating === 'number') {
        query = query?.gte('rating', minRating);
      }

      // Sorting
      if (sortOrder === 'desc') {
        query = query?.order(sortBy, { ascending: false });
      } else {
        query = query?.order(sortBy, { ascending: true });
      }

      // Limit results
      if (limit && typeof limit === 'number' && limit > 0) {
        query = query?.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error, 'getVendors');
      }

      return data || [];
    } catch (error) {
      if (error?.message?.includes('Supabase') || error?.message?.includes('Network') || error?.message?.includes('Authentication')) {
        throw error;
      }
      console.error('Error fetching vendors:', error);
      throw new Error('Failed to fetch vendors. Please try again later.');
    }
  },

  /**
   * Get vendors by specialty with exact specifications
   */
  async getVendorsBySpecialty() {
    try {
      await validateConnection();

      // Get all unique specialties first
      const { data: specialtyData, error: specialtyError } = await supabase?.from('vendors')?.select('specialty')?.eq('is_active', true)?.not('specialty', 'is', null);

      if (specialtyError) {
        handleSupabaseError(specialtyError, 'getVendorsBySpecialty - specialties');
      }

      const uniqueSpecialties = [...new Set(specialtyData?.map(v => v?.specialty)?.filter(Boolean))];

      // Get vendors grouped by specialty
      const vendorsBySpecialty = {};
      
      for (const specialty of uniqueSpecialties) {
        vendorsBySpecialty[specialty] = await this.getVendors({
          specialties: specialty,
          activeOnly: true,
          sortBy: 'name'
        });
      }

      return {
        all: await this.getVendors({ activeOnly: true }),
        bySpecialty: vendorsBySpecialty,
        specialties: uniqueSpecialties?.sort(),
        topRated: await this.getVendors({ 
          activeOnly: true, 
          minRating: 4, 
          sortBy: 'rating', 
          sortOrder: 'desc' 
        })
      };
    } catch (error) {
      console.error('Error fetching vendors by specialty:', error);
      return {
        all: [],
        bySpecialty: {},
        specialties: [],
        topRated: []
      };
    }
  },

  /**
   * Get all products with filtering options
   * @param {Object} filters - Filter criteria
   * @param {boolean} filters.activeOnly - Only active products (default: true)  
   * @param {string} filters.search - Search in name, description, part_number, or op_code
   * @param {string|string[]} filters.categories - Filter by category
   * @param {string|string[]} filters.brands - Filter by brand
   * @param {number} filters.minPrice - Minimum unit price
   * @param {number} filters.maxPrice - Maximum unit price
   * @param {boolean} filters.inStockOnly - Only products with quantity > 0
   * @param {string} filters.vendorId - Filter by vendor_id
   * @param {string} filters.sortBy - Field to sort by (default: 'name')
   * @param {string} filters.sortOrder - 'asc' or 'desc' (default: 'asc')
   * @returns {Promise<Array>} Filtered products
   */
  async getProducts(filters = {}) {
    try {
      await validateConnection();

      const {
        activeOnly = true,
        search = null,
        categories = null,
        brands = null,
        minPrice = null,
        maxPrice = null,
        inStockOnly = false,
        vendorId = null,
        sortBy = 'name',
        sortOrder = 'asc',
        limit = null
      } = filters;

      let query = supabase?.from('products')?.select(`
          id, name, description, part_number, op_code, category, brand,
          unit_price, cost, quantity_in_stock, minimum_stock_level,
          vendor_id, is_active, created_at, updated_at
        `);

      if (!query) {
        throw new Error('Failed to create query. Supabase client is not available.');
      }

      // Active status filtering
      if (activeOnly) {
        query = query?.eq('is_active', true);
      }

      // Search functionality
      if (search?.trim()) {
        const searchTerm = `%${search?.trim()}%`;
        query = query?.or(`name.ilike.${searchTerm},description.ilike.${searchTerm},part_number.ilike.${searchTerm},op_code.ilike.${searchTerm}`);
      }

      // Category filtering
      if (categories) {
        if (Array.isArray(categories)) {
          query = query?.in('category', categories);
        } else {
          query = query?.eq('category', categories);
        }
      }

      // Brand filtering
      if (brands) {
        if (Array.isArray(brands)) {
          query = query?.in('brand', brands);
        } else {
          query = query?.eq('brand', brands);
        }
      }

      // Price range filtering
      if (minPrice !== null && typeof minPrice === 'number') {
        query = query?.gte('unit_price', minPrice);
      }
      if (maxPrice !== null && typeof maxPrice === 'number') {
        query = query?.lte('unit_price', maxPrice);
      }

      // Stock filtering
      if (inStockOnly) {
        query = query?.gt('quantity_in_stock', 0);
      }

      // Vendor filtering
      if (vendorId) {
        query = query?.eq('vendor_id', vendorId);
      }

      // Sorting
      if (sortOrder === 'desc') {
        query = query?.order(sortBy, { ascending: false });
      } else {
        query = query?.order(sortBy, { ascending: true });
      }

      // Limit results
      if (limit && typeof limit === 'number' && limit > 0) {
        query = query?.limit(limit);
      }

      const { data, error } = await query;

      if (error) {
        handleSupabaseError(error, 'getProducts');
      }

      return data || [];
    } catch (error) {
      if (error?.message?.includes('Supabase') || error?.message?.includes('Network') || error?.message?.includes('Authentication')) {
        throw error;
      }
      console.error('Error fetching products:', error);
      throw new Error('Failed to fetch products. Please try again later.');
    }
  },

  /**
   * Get products grouped by category and brand with exact specifications
   */
  async getProductsByCategory() {
    try {
      await validateConnection();

      // Get all unique categories and brands
      const [categoryData, brandData] = await Promise.all([
        supabase?.from('products')?.select('category')?.eq('is_active', true)?.not('category', 'is', null),
        supabase?.from('products')?.select('brand')?.eq('is_active', true)?.not('brand', 'is', null)
      ]);

      if (categoryData?.error) {
        handleSupabaseError(categoryData?.error, 'getProductsByCategory - categories');
      }
      if (brandData?.error) {
        handleSupabaseError(brandData?.error, 'getProductsByCategory - brands');
      }

      const uniqueCategories = [...new Set(categoryData?.data?.map(p => p?.category)?.filter(Boolean))];
      const uniqueBrands = [...new Set(brandData?.data?.map(p => p?.brand)?.filter(Boolean))];

      // Get products grouped by category
      const productsByCategory = {};
      const productsByBrand = {};

      for (const category of uniqueCategories) {
        productsByCategory[category] = await this.getProducts({
          categories: category,
          activeOnly: true,
          sortBy: 'name'
        });
      }

      for (const brand of uniqueBrands) {
        productsByBrand[brand] = await this.getProducts({
          brands: brand,
          activeOnly: true,
          sortBy: 'name'
        });
      }

      return {
        all: await this.getProducts({ activeOnly: true }),
        byCategory: productsByCategory,
        byBrand: productsByBrand,
        categories: uniqueCategories?.sort(),
        brands: uniqueBrands?.sort(),
        inStock: await this.getProducts({ 
          activeOnly: true, 
          inStockOnly: true,
          sortBy: 'name'
        }),
        lowStock: await this.getProducts({
          activeOnly: true,
          sortBy: 'quantity_in_stock',
          sortOrder: 'asc'
        })?.then(products => 
          products?.filter(p => 
            p?.quantity_in_stock <= (p?.minimum_stock_level || 0)
          )
        )
      };
    } catch (error) {
      console.error('Error fetching products by category:', error);
      return {
        all: [],
        byCategory: {},
        byBrand: {},
        categories: [],
        brands: [],
        inStock: [],
        lowStock: []
      };
    }
  },

  /**
   * Get comprehensive dropdown data for deal forms
   * Optimized single call to get all necessary data
   */
  async getDealFormData() {
    try {
      await validateConnection();

      const [userTypes, vendorTypes, productTypes] = await Promise.all([
        this.getUsersByType(),
        this.getVendorsBySpecialty(), 
        this.getProductsByCategory()
      ]);

      return {
        users: userTypes,
        vendors: vendorTypes,
        products: productTypes,
        // Quick access arrays for dropdowns
        salesConsultants: userTypes?.salesConsultants?.map(user => ({
          id: user?.id,
          name: user?.full_name,
          email: user?.email,
          displayName: `${user?.full_name} (${user?.email})`
        })) || [],
        deliveryCoordinators: userTypes?.deliveryCoordinators?.map(user => ({
          id: user?.id,
          name: user?.full_name,
          email: user?.email,
          displayName: `${user?.full_name} (${user?.email})`
        })) || [],
        activeVendors: vendorTypes?.all?.map(vendor => ({
          id: vendor?.id,
          name: vendor?.name,
          specialty: vendor?.specialty,
          displayName: `${vendor?.name}${vendor?.specialty ? ` (${vendor?.specialty})` : ''}`
        })) || [],
        activeProducts: productTypes?.all?.map(product => ({
          id: product?.id,
          name: product?.name,
          category: product?.category,
          brand: product?.brand,
          unitPrice: product?.unit_price,
          cost: product?.cost,
          displayName: `${product?.name} - $${product?.unit_price}${product?.brand ? ` (${product?.brand})` : ''}`
        })) || []
      };
    } catch (error) {
      console.error('Error fetching deal form data:', error);
      // Return safe fallback structure
      return {
        users: { salesConsultants: [], deliveryCoordinators: [], managers: [], admins: [], vendors: [], allStaff: [], allActive: [] },
        vendors: { all: [], bySpecialty: {}, specialties: [], topRated: [] },
        products: { all: [], byCategory: {}, byBrand: {}, categories: [], brands: [], inStock: [], lowStock: [] },
        salesConsultants: [],
        deliveryCoordinators: [],
        activeVendors: [],
        activeProducts: []
      };
    }
  },

  /**
   * Search across all entity types with unified results
   * @param {string} searchTerm - Search term
   * @param {Object} options - Search options
   * @returns {Promise<Object>} Search results grouped by type
   */
  async globalSearch(searchTerm, options = {}) {
    try {
      await validateConnection();

      const { limit = 10, activeOnly = true } = options;

      if (!searchTerm?.trim()) {
        return { users: [], vendors: [], products: [] };
      }

      const [users, vendors, products] = await Promise.all([
        this.getUsers({ 
          search: searchTerm, 
          activeOnly, 
          limit,
          sortBy: 'full_name'
        }),
        this.getVendors({ 
          search: searchTerm, 
          activeOnly, 
          limit,
          sortBy: 'name'
        }),
        this.getProducts({ 
          search: searchTerm, 
          activeOnly, 
          limit,
          sortBy: 'name'
        })
      ]);

      return {
        users: users?.map(user => ({
          ...user,
          type: 'user',
          displayName: `${user?.full_name} (${user?.role})`
        })),
        vendors: vendors?.map(vendor => ({
          ...vendor,
          type: 'vendor', 
          displayName: `${vendor?.name}${vendor?.specialty ? ` - ${vendor?.specialty}` : ''}`
        })),
        products: products?.map(product => ({
          ...product,
          type: 'product',
          displayName: `${product?.name} - $${product?.unit_price}`
        })),
        totalResults: users?.length + vendors?.length + products?.length
      };
    } catch (error) {
      console.error('Error performing global search:', error);
      return { users: [], vendors: [], products: [], totalResults: 0 };
    }
  }
};

export default dropdownService;