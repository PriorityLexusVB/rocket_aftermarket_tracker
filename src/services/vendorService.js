import { supabase } from '../lib/supabase';
import logger, { ACTION_TYPES, ENTITY_TYPES } from '../utils/logger';

class VendorService {
  // Get all vendors with logging
  async getAllVendors() {
    try {
      await logger?.info(
        'api_call',
        ENTITY_TYPES?.SYSTEM,
        'vendor-api',
        'Fetching all vendors from database',
        { endpoint: 'getAllVendors', timestamp: new Date()?.toISOString() }
      );

      const { data: vendors, error } = await supabase
        ?.from('vendors')
        ?.select(`
          *,
          created_by_user:user_profiles!vendors_created_by_fkey(full_name),
          products:products(count)
        `)
        ?.order('created_at', { ascending: false });

      if (error) throw error;

      const vendorData = vendors?.map(vendor => ({
        ...vendor,
        created_by_name: vendor?.created_by_user?.full_name || 'Unknown',
        product_count: vendor?.products?.[0]?.count || 0
      })) || [];

      await logger?.success(
        'vendors_data_fetched',
        ENTITY_TYPES?.VENDOR,
        'bulk',
        `Successfully fetched ${vendorData?.length} vendor records`,
        { 
          recordCount: vendorData?.length,
          fetchTime: new Date()?.toISOString()
        }
      );

      return vendorData;
    } catch (error) {
      await logger?.error(
        'vendor_fetch_error',
        ENTITY_TYPES?.SYSTEM,
        'vendor-api',
        `Failed to fetch vendors: ${error?.message}`,
        { 
          error: error?.message,
          stack: error?.stack
        }
      );
      
      console.error('Error fetching vendors:', error);
      throw error;
    }
  }

  // Create new vendor
  async createVendor(vendorData) {
    try {
      await logger?.info(
        'vendor_creation_initiated',
        ENTITY_TYPES?.VENDOR,
        'new',
        `Creating new vendor: ${vendorData?.name}`,
        { 
          vendorData,
          initiatedAt: new Date()?.toISOString()
        }
      );

      const { data: newVendor, error } = await supabase
        ?.from('vendors')
        ?.insert([{
          name: vendorData?.name,
          contact_person: vendorData?.contact_person,
          email: vendorData?.email,
          phone: vendorData?.phone,
          address: vendorData?.address,
          specialty: vendorData?.specialty,
          rating: vendorData?.rating || null,
          notes: vendorData?.notes || null,
          is_active: vendorData?.is_active !== undefined ? vendorData?.is_active : true
        }])
        ?.select()
        ?.single();

      if (error) throw error;

      await logger?.success(
        'vendor_created',
        ENTITY_TYPES?.VENDOR,
        newVendor?.id,
        `Vendor successfully created: ${newVendor?.name}`,
        {
          vendorData: newVendor,
          completedAt: new Date()?.toISOString()
        }
      );

      return newVendor;
    } catch (error) {
      await logger?.error(
        'vendor_creation_failed',
        ENTITY_TYPES?.VENDOR,
        'failed',
        `Failed to create vendor: ${error?.message}`,
        {
          error: error?.message,
          vendorData,
          stack: error?.stack
        }
      );
      
      console.error('Error creating vendor:', error);
      throw error;
    }
  }

  // Update vendor
  async updateVendor(vendorId, updates) {
    try {
      await logger?.info(
        'vendor_update_initiated',
        ENTITY_TYPES?.VENDOR,
        vendorId,
        `Updating vendor ${vendorId}`,
        { vendorId, updates }
      );

      // Get current vendor data for change tracking
      const { data: currentVendor } = await supabase
        ?.from('vendors')
        ?.select('*')
        ?.eq('id', vendorId)
        ?.single();

      const { data: updatedVendor, error } = await supabase
        ?.from('vendors')
        ?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })
        ?.eq('id', vendorId)
        ?.select()
        ?.single();

      if (error) throw error;

      await logger?.success(
        'vendor_updated',
        ENTITY_TYPES?.VENDOR,
        vendorId,
        `Vendor successfully updated: ${updatedVendor?.name}`,
        {
          oldData: currentVendor,
          newData: updatedVendor,
          changes: updates
        }
      );

      return updatedVendor;
    } catch (error) {
      await logger?.error(
        'vendor_update_failed',
        ENTITY_TYPES?.VENDOR,
        vendorId,
        `Failed to update vendor: ${error?.message}`,
        {
          error: error?.message,
          vendorId,
          updates
        }
      );
      
      console.error('Error updating vendor:', error);
      throw error;
    }
  }

  // Delete vendor
  async deleteVendor(vendorId) {
    try {
      await logger?.info(
        'vendor_deletion_initiated',
        ENTITY_TYPES?.VENDOR,
        vendorId,
        `Initiating deletion of vendor ${vendorId}`,
        { vendorId }
      );

      // Get vendor data before deletion
      const { data: vendorToDelete } = await supabase
        ?.from('vendors')
        ?.select('*')
        ?.eq('id', vendorId)
        ?.single();

      const { error } = await supabase
        ?.from('vendors')
        ?.delete()
        ?.eq('id', vendorId);

      if (error) throw error;

      await logger?.success(
        'vendor_deleted',
        ENTITY_TYPES?.VENDOR,
        vendorId,
        `Vendor successfully deleted: ${vendorToDelete?.name}`,
        {
          deletedVendor: vendorToDelete,
          deletedAt: new Date()?.toISOString()
        }
      );

      return true;
    } catch (error) {
      await logger?.error(
        'vendor_deletion_failed',
        ENTITY_TYPES?.VENDOR,
        vendorId,
        `Failed to delete vendor: ${error?.message}`,
        {
          error: error?.message,
          vendorId
        }
      );
      
      console.error('Error deleting vendor:', error);
      throw error;
    }
  }

  // Bulk operations
  async bulkUpdateVendors(vendorIds, updates) {
    try {
      await logger?.info(
        'vendor_bulk_update_initiated',
        ENTITY_TYPES?.VENDOR,
        'bulk',
        `Initiating bulk update for ${vendorIds?.length} vendors`,
        { vendorIds, updates }
      );

      const { data: updatedVendors, error } = await supabase
        ?.from('vendors')
        ?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })
        ?.in('id', vendorIds)
        ?.select();

      if (error) throw error;

      await logger?.success(
        'vendor_bulk_updated',
        ENTITY_TYPES?.VENDOR,
        'bulk',
        `Successfully updated ${updatedVendors?.length} vendors`,
        {
          vendorIds,
          updates,
          updatedCount: updatedVendors?.length
        }
      );

      return updatedVendors;
    } catch (error) {
      await logger?.error(
        'vendor_bulk_update_failed',
        ENTITY_TYPES?.VENDOR,
        'bulk',
        `Failed to bulk update vendors: ${error?.message}`,
        {
          error: error?.message,
          vendorIds,
          updates
        }
      );
      
      console.error('Error bulk updating vendors:', error);
      throw error;
    }
  }

  // Get vendor by ID with products
  async getVendorById(vendorId) {
    try {
      const { data: vendor, error } = await supabase
        ?.from('vendors')
        ?.select(`
          *,
          created_by_user:user_profiles!vendors_created_by_fkey(full_name),
          products:products(*)
        `)
        ?.eq('id', vendorId)
        ?.single();

      if (error) throw error;

      return {
        ...vendor,
        created_by_name: vendor?.created_by_user?.full_name || 'Unknown'
      };
    } catch (error) {
      console.error('Error fetching vendor:', error);
      throw error;
    }
  }

  // Get vendors by specialty
  async getVendorsBySpecialty(specialty) {
    try {
      const { data: vendors, error } = await supabase
        ?.from('vendors')
        ?.select('*')
        ?.ilike('specialty', `%${specialty}%`)
        ?.eq('is_active', true)
        ?.order('name');

      if (error) throw error;
      return vendors || [];
    } catch (error) {
      console.error('Error fetching vendors by specialty:', error);
      throw error;
    }
  }
}

// Export singleton instance
const vendorService = new VendorService();
export default vendorService;

// Add vendor-specific functions for accessing assigned vehicles
export const getVendorVehicles = async (vendorId = null) => {
  try {
    const { data, error } = await supabase?.rpc('get_vendor_vehicles', {
      vendor_uuid: vendorId
    });
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching vendor vehicles:', error);
    throw error;
  }
};

export const getVendorJobs = async (vendorId = null) => {
  try {
    const { data, error } = await supabase?.rpc('get_vendor_jobs', {
      vendor_uuid: vendorId
    });
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching vendor jobs:', error);
    throw error;
  }
};

// Check if current user can access specific vehicle
export const canAccessVehicle = async (vehicleId) => {
  try {
    const { data, error } = await supabase?.rpc('vendor_can_access_vehicle', {
      vehicle_uuid: vehicleId
    });
    
    if (error) {
      throw error;
    }
    
    return data || false;
  } catch (error) {
    console.error('Error checking vehicle access:', error);
    return false;
  }
};

// Check if current user can access specific job
export const canAccessJob = async (jobId) => {
  try {
    const { data, error } = await supabase?.rpc('vendor_can_access_job', {
      job_uuid: jobId
    });
    
    if (error) {
      throw error;
    }
    
    return data || false;
  } catch (error) {
    console.error('Error checking job access:', error);
    return false;
  }
};
function getVendors(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: getVendors is not implemented yet.', args);
  return null;
}

export { getVendors };