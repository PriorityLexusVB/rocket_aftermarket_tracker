import { supabase } from '../lib/supabase';

export const vendorService = {
  async getAllVendors() {
    try {
      const { data, error } = await supabase?.from('vendors')?.select('*')?.eq('is_active', true)?.order('name', { ascending: true });

      if (error) {
        console.error('Error fetching vendors:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error fetching vendors:', error);
      return [];
    }
  },

  async getVendorById(id) {
    if (!id) return null;
    
    try {
      const { data, error } = await supabase?.from('vendors')?.select(`
          *,
          products:products(count),
          vendor_hours:vendor_hours(*)
        `)?.eq('id', id)?.single();

      if (error) {
        console.error('Error fetching vendor:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Network error fetching vendor:', error);
      return null;
    }
  },

  async createVendor(vendorData) {
    try {
      const { data, error } = await supabase?.from('vendors')?.insert([{
          name: vendorData?.name,
          email: vendorData?.email || '',
          phone: vendorData?.phone || '',
          address: vendorData?.address || '',
          contact_person: vendorData?.contact_person || '',
          specialty: vendorData?.specialty || '',
          rating: vendorData?.rating || null,
          notes: vendorData?.notes || '',
          is_active: vendorData?.is_active !== undefined ? vendorData?.is_active : true
        }])?.select()?.single();

      if (error) {
        console.error('Error creating vendor:', error);
        throw new Error(`Failed to create vendor: ${error?.message}`);
      }

      return data;
    } catch (error) {
      console.error('Network error creating vendor:', error);
      throw error;
    }
  },

  async updateVendor(id, updates) {
    if (!id) throw new Error('Vendor ID is required');
    
    try {
      const { data, error } = await supabase?.from('vendors')?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })?.eq('id', id)?.select()?.single();

      if (error) {
        console.error('Error updating vendor:', error);
        throw new Error(`Failed to update vendor: ${error?.message}`);
      }

      return data;
    } catch (error) {
      console.error('Network error updating vendor:', error);
      throw error;
    }
  },

  async deleteVendor(id) {
    if (!id) throw new Error('Vendor ID is required');
    
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase?.from('vendors')?.update({ 
          is_active: false,
          updated_at: new Date()?.toISOString()
        })?.eq('id', id);

      if (error) {
        console.error('Error deleting vendor:', error);
        throw new Error(`Failed to delete vendor: ${error?.message}`);
      }

      return true;
    } catch (error) {
      console.error('Network error deleting vendor:', error);
      throw error;
    }
  },

  async searchVendors(searchTerm) {
    if (!searchTerm?.trim()) return [];
    
    try {
      const { data, error } = await supabase?.from('vendors')?.select('*')?.or(`name.ilike.%${searchTerm}%,specialty.ilike.%${searchTerm}%,contact_person.ilike.%${searchTerm}%`)?.eq('is_active', true)?.order('name', { ascending: true })?.limit(50);

      if (error) {
        console.error('Error searching vendors:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error searching vendors:', error);
      return [];
    }
  },

  async getVendorsBySpecialty(specialty) {
    if (!specialty) return [];
    
    try {
      const { data, error } = await supabase?.from('vendors')?.select('*')?.ilike('specialty', `%${specialty}%`)?.eq('is_active', true)?.order('rating', { ascending: false, nullsLast: true })?.order('name', { ascending: true });

      if (error) {
        console.error('Error fetching vendors by specialty:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error fetching vendors by specialty:', error);
      return [];
    }
  },

  async getVendorAvailability(vendorId, startDate, endDate) {
    if (!vendorId || !startDate || !endDate) {
      throw new Error('Vendor ID, start date, and end date are required');
    }
    
    try {
      const { data, error } = await supabase?.rpc('get_vendor_availability', {
        vendor_id: vendorId,
        start_date: startDate,
        end_date: endDate
      });

      if (error) {
        console.error('Error checking vendor availability:', error);
        return false;
      }

      return data || false;
    } catch (error) {
      console.error('Network error checking vendor availability:', error);
      return false;
    }
  },

  async getVendorPerformance(vendorId, dateRange = 30) {
    if (!vendorId) return null;
    
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          id,
          job_status,
          scheduled_start_time,
          scheduled_end_time,
          completed_at,
          actual_cost,
          estimated_cost
        `)?.eq('vendor_id', vendorId)?.gte('created_at', new Date(Date.now() - dateRange * 24 * 60 * 60 * 1000)?.toISOString())?.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching vendor performance:', error);
        return null;
      }

      // Calculate performance metrics
      const jobs = data || [];
      const completedJobs = jobs?.filter(j => j?.job_status === 'completed');
      const onTimeJobs = completedJobs?.filter(j => {
        if (!j?.scheduled_end_time || !j?.completed_at) return false;
        return new Date(j?.completed_at) <= new Date(j?.scheduled_end_time);
      });

      const performance = {
        totalJobs: jobs?.length,
        completedJobs: completedJobs?.length,
        onTimeDelivery: completedJobs?.length > 0 ? (onTimeJobs?.length / completedJobs?.length) * 100 : 0,
        averageCostVariance: 0
      };

      // Calculate cost variance
      if (completedJobs?.length > 0) {
        const costVariances = completedJobs
          ?.filter(j => j?.actual_cost && j?.estimated_cost)
          ?.map(j => ((j?.actual_cost - j?.estimated_cost) / j?.estimated_cost) * 100);
        
        if (costVariances?.length > 0) {
          performance.averageCostVariance = costVariances?.reduce((sum, variance) => sum + variance, 0) / costVariances?.length;
        }
      }

      return performance;
    } catch (error) {
      console.error('Network error fetching vendor performance:', error);
      return null;
    }
  }
};

// Export commonly used functions
export const getVendors = vendorService?.getAllVendors;
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