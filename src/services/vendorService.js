import { supabase } from '../lib/supabase';

export const vendorService = {
  // Get all vendors with optional filtering including phone search
  async getVendors(filters = {}) {
    try {
      let query = supabase
        ?.from('vendors')
        ?.select(`
          *,
          created_by_profile:user_profiles!vendors_created_by_fkey(full_name, email)
        `)
        ?.order('created_at', { ascending: false });

      // Apply filters
      if (filters?.is_active !== undefined) {
        query = query?.eq('is_active', filters?.is_active);
      }
      
      if (filters?.specialty) {
        query = query?.eq('specialty', filters?.specialty);
      }

      // Enhanced search to include phone numbers
      if (filters?.search) {
        query = query?.or(`name.ilike.%${filters?.search}%,specialty.ilike.%${filters?.search}%,contact_person.ilike.%${filters?.search}%,email.ilike.%${filters?.search}%,phone.ilike.%${filters?.search}%,notes.ilike.%${filters?.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      return { data: data || [], error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to load vendors' } };
    }
  },

  // Create new vendor
  async createVendor(vendorData) {
    try {
      const { data, error } = await supabase
        ?.from('vendors')
        ?.insert([{
          ...vendorData,
          created_by: (await supabase?.auth?.getUser())?.data?.user?.id
        }])
        ?.select(`
          *,
          created_by_profile:user_profiles!vendors_created_by_fkey(full_name, email)
        `)
        ?.single();

      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to create vendor' } };
    }
  },

  // Update vendor
  async updateVendor(id, updates) {
    try {
      const { data, error } = await supabase
        ?.from('vendors')
        ?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })
        ?.eq('id', id)
        ?.select(`
          *,
          created_by_profile:user_profiles!vendors_created_by_fkey(full_name, email)
        `)
        ?.single();

      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to update vendor' } };
    }
  }
};

// Export commonly used functions
export const getVendors = vendorService?.getVendors;
export const createVendor = vendorService?.createVendor;
export const updateVendor = vendorService?.updateVendor;
function getVendorVehicles(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: getVendorVehicles is not implemented yet.', args);
  return null;
}

export { getVendorVehicles };
function getVendorJobs(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: getVendorJobs is not implemented yet.', args);
  return null;
}

export { getVendorJobs };