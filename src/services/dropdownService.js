import { supabase } from '../lib/supabaseClient';

// Enhanced connection validation and error handling with authentication bypass for demo
const validateConnection = async () => {
  try {
    const { error } = await supabase?.from('user_profiles')?.select('id')?.limit(1);
    return !error;
  } catch (e) {
    console.error('Supabase connection validation failed:', e);
    return false;
  }
};

// Enhanced delivery coordinators with better error handling
export async function getDeliveryCoordinators() {
  try {
    // First try with authentication bypass for demo/preview mode
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.select('id, full_name, email, department')
      ?.eq('is_active', true)
      ?.eq('department', 'Delivery Coordinator')
      ?.order('full_name', { ascending: true });

    if (error) {
      console.error('Failed to fetch delivery coordinators:', error);
      // Return empty array instead of throwing - allows UI to show appropriate message
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.error('Failed to fetch delivery coordinators:', e);
    return [];
  }
}

// Enhanced sales consultants with better error handling  
export async function getSalesConsultants() {
  try {
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.select('id, full_name, email, department')
      ?.eq('is_active', true)
      ?.eq('department', 'Sales Consultants')
      ?.order('full_name', { ascending: true });

    if (error) {
      console.error('Failed to fetch sales consultants:', error);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.error('Failed to fetch sales consultants:', e);
    return [];
  }
}

// Enhanced finance managers with better error handling
export async function getFinanceManagers() {
  try {
    const { data, error } = await supabase
      ?.from('user_profiles')
      ?.select('id, full_name, email, department')
      ?.eq('is_active', true)
      ?.eq('department', 'Finance Manager')
      ?.order('full_name', { ascending: true });

    if (error) {
      console.error('Failed to fetch finance managers:', error);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.error('Failed to fetch finance managers:', e);
    return [];
  }
}

// Enhanced products service with proper formatting for dropdown
export async function getProducts(options = {}) {
  try {
    const { activeOnly = true } = options;
    
    let query = supabase
      ?.from('products')
      ?.select('id, name, category, unit_price, cost, brand, op_code, is_active');

    if (activeOnly) {
      query = query?.eq('is_active', true);
    }

    query = query?.order('name', { ascending: true });

    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to fetch products:', error);
      return [];
    }
    
    // Format for dropdowns
    return (data || [])?.map(product => ({
      id: product?.id,
      value: product?.id,
      label: `${product?.name} - ${product?.brand || 'Generic'}`,
      name: product?.name,
      category: product?.category,
      unitPrice: product?.unit_price,
      unit_price: product?.unit_price,
      cost: product?.cost,
      brand: product?.brand,
      op_code: product?.op_code
    }));
  } catch (e) {
    console.error('Failed to fetch products:', e);
    return [];
  }
}

// Get all user profiles with filtering options
export async function getUserProfiles(options = {}) {
  try {
    const { roles = [], departments = [], activeOnly = true } = options;
    
    let query = supabase
      ?.from('user_profiles')
      ?.select('id, full_name, role, department, email, is_active');

    if (activeOnly) {
      query = query?.eq('is_active', true);
    }

    if (roles?.length > 0) {
      query = query?.in('role', roles);
    }

    if (departments?.length > 0) {
      query = query?.in('department', departments);
    }

    query = query?.order('full_name', { ascending: true });

    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to fetch user profiles:', error);
      return [];
    }
    
    return data || [];
  } catch (e) {
    console.error('Failed to fetch user profiles:', e);
    return [];
  }
}

// Enhanced vendors service with proper formatting
export async function getVendors(options = {}) {
  try {
    const { activeOnly = true } = options;
    
    let query = supabase
      ?.from('vendors')
      ?.select('id, name, specialty, email, phone, is_active, contact_person');

    if (activeOnly) {
      query = query?.eq('is_active', true);
    }

    query = query?.order('name', { ascending: true });

    const { data, error } = await query;
    
    if (error) {
      console.error('Failed to fetch vendors:', error);
      return [];
    }
    
    // Format for dropdowns
    return (data || [])?.map(vendor => ({
      id: vendor?.id,
      value: vendor?.id,
      label: `${vendor?.name} - ${vendor?.specialty || 'General'}`,
      name: vendor?.name,
      specialty: vendor?.specialty,
      email: vendor?.email,
      phone: vendor?.phone,
      contact_person: vendor?.contact_person
    }));
  } catch (e) {
    console.error('Failed to fetch vendors:', e);
    return [];
  }
}

// Global search across users and vendors
export async function globalSearch(searchTerm) {
  try {
    if (!searchTerm?.trim()) return { users: [], vendors: [] };

    const term = searchTerm?.toLowerCase()?.trim();
    
    // Search users with error handling
    let users = [];
    try {
      const { data: userData, error: userError } = await supabase
        ?.from('user_profiles')
        ?.select('id, full_name, role, department, email')
        ?.eq('is_active', true)
        ?.or(`full_name.ilike.%${term}%,email.ilike.%${term}%,department.ilike.%${term}%`);

      if (!userError) {
        users = userData || [];
      }
    } catch (e) {
      console.error('User search failed:', e);
    }

    // Search vendors with error handling
    let vendors = [];
    try {
      const { data: vendorData, error: vendorError } = await supabase
        ?.from('vendors')
        ?.select('id, name, specialty, email')
        ?.eq('is_active', true)
        ?.or(`name.ilike.%${term}%,specialty.ilike.%${term}%,email.ilike.%${term}%`);

      if (!vendorError) {
        vendors = vendorData || [];
      }
    } catch (e) {
      console.error('Vendor search failed:', e);
    }

    return {
      users,
      vendors
    };
  } catch (e) {
    console.error('Global search failed:', e);
    return { users: [], vendors: [] };
  }
}