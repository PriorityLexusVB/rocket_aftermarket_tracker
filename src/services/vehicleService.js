import { supabase } from '../lib/supabase';

export const vehicleService = {
  // Get all vehicles with optional filtering
  async getVehicles(filters = {}) {
    try {
      let query = supabase
        ?.from('vehicles')
        ?.select(`
          *,
          created_by_profile:user_profiles!vehicles_created_by_fkey(full_name, email)
        `)
        ?.order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query?.eq('vehicle_status', filters?.status);
      }
      
      if (filters?.make) {
        query = query?.eq('make', filters?.make);
      }
      
      if (filters?.year) {
        query = query?.eq('year', filters?.year);
      }

      if (filters?.search) {
        query = query?.or(`vin.ilike.%${filters?.search}%,make.ilike.%${filters?.search}%,model.ilike.%${filters?.search}%,license_plate.ilike.%${filters?.search}%,owner_name.ilike.%${filters?.search}%,owner_phone.ilike.%${filters?.search}%,owner_email.ilike.%${filters?.search}%,stock_number.ilike.%${filters?.search}%`);
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
      return { data: null, error: { message: 'Failed to load vehicles' } };
    }
  },

  // Get single vehicle by ID
  async getVehicleById(id) {
    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.select(`
          *,
          created_by_profile:user_profiles!vehicles_created_by_fkey(full_name, email),
          jobs(
            id,
            job_number,
            title,
            job_status,
            priority,
            estimated_cost,
            actual_cost,
            created_at,
            assigned_to_profile:user_profiles!jobs_assigned_to_fkey(full_name)
          )
        `)
        ?.eq('id', id)
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
      return { data: null, error: { message: 'Failed to load vehicle details' } };
    }
  },

  // Create new vehicle
  async createVehicle(vehicleData) {
    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.insert([{
          ...vehicleData,
          created_by: (await supabase?.auth?.getUser())?.data?.user?.id
        }])
        ?.select(`
          *,
          created_by_profile:user_profiles!vehicles_created_by_fkey(full_name, email)
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
      return { data: null, error: { message: 'Failed to create vehicle' } };
    }
  },

  async create(vehicleData) {
    try {
      const { data, error } = await supabase?.from('vehicles')?.insert([vehicleData])?.select()?.single();

      if (error) {
        console.error('Vehicle creation error:', error);
        throw new Error(error.message || 'Failed to create vehicle');
      }

      console.log('Vehicle created successfully:', data);
      return data;
    } catch (error) {
      console.error('Error in vehicleService.create:', error);
      throw error;
    }
  },

  async createVehicleWithProducts(vehicleData) {
    try {
      console.log('Creating vehicle with products:', vehicleData);
      
      // In a real implementation, this would:
      // 1. Create the vehicle record in the vehicles table
      // 2. Create vehicle_products records for each selected product
      // 3. Optionally create initial job records if vendor is assigned
      // 4. Return the created vehicle with all relationships
      
      // Mock implementation for now
      const mockVehicleId = `vehicle_${Date.now()}`;
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful response
      const createdVehicle = {
        id: mockVehicleId,
        ...vehicleData,
        created_at: new Date()?.toISOString(),
        initial_products_count: vehicleData?.initial_products?.length || 0,
        estimated_aftermarket_value: vehicleData?.total_initial_product_value || 0
      };
      
      console.log('Vehicle created successfully:', createdVehicle);
      return createdVehicle;
      
    } catch (error) {
      console.error('Error creating vehicle with products:', error);
      throw error;
    }
  },

  async checkStockNumberExists(stockNumber) {
    if (!stockNumber?.trim()) return false;
    
    try {
      const { data, error } = await supabase?.from('vehicles')?.select('id')?.eq('stock_number', stockNumber?.trim())?.maybeSingle();

      if (error) {
        console.error('Stock number check error:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking stock number:', error);
      return false;
    }
  },

  async checkVinExists(vin) {
    if (!vin?.trim()) return false;
    
    try {
      const { data, error } = await supabase?.from('vehicles')?.select('id')?.eq('vin', vin?.trim())?.maybeSingle();

      if (error) {
        console.error('VIN check error:', error);
        return false;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking VIN:', error);
      return false;
    }
  },

  // Update vehicle
  async updateVehicle(id, updates) {
    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })
        ?.eq('id', id)
        ?.select(`
          *,
          created_by_profile:user_profiles!vehicles_created_by_fkey(full_name, email)
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
      return { data: null, error: { message: 'Failed to update vehicle' } };
    }
  },

  // Delete vehicle
  async deleteVehicle(id) {
    try {
      const { error } = await supabase
        ?.from('vehicles')
        ?.delete()
        ?.eq('id', id);

      if (error) {
        return { error: { message: error?.message } };
      }

      return { error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { error: { message: 'Failed to delete vehicle' } };
    }
  },

  // Get vehicle statistics
  async getVehicleStats() {
    try {
      const { data, error } = await supabase
        ?.from('vehicles')
        ?.select('vehicle_status');

      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      const stats = {
        total: data?.length || 0,
        active: data?.filter(v => v?.vehicle_status === 'active')?.length || 0,
        maintenance: data?.filter(v => v?.vehicle_status === 'maintenance')?.length || 0,
        retired: data?.filter(v => v?.vehicle_status === 'retired')?.length || 0,
        sold: data?.filter(v => v?.vehicle_status === 'sold')?.length || 0
      };

      return { data: stats, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to load vehicle statistics' } };
    }
  },

  // Get all vehicles (alias for getVehicles for consistent API usage)
  async getAllVehicles(filters = {}) {
    return await this.getVehicles(filters);
  }
};

// Add vendor-aware vehicle fetching
export const getVehicles = async (options = {}) => {
  try {
    let query = supabase?.from('vehicles')?.select(`
      *,
      jobs:jobs!vehicles_vehicle_id_fkey(
        id,
        job_number,
        title,
        job_status,
        vendor_id,
        assigned_to
      )
    `);

    // Apply filters if provided
    if (options?.status) {
      query = query?.eq('vehicle_status', options?.status);
    }

    if (options?.search) {
      query = query?.or(`
        make.ilike.%${options?.search}%,
        model.ilike.%${options?.search}%,
        vin.ilike.%${options?.search}%,
        license_plate.ilike.%${options?.search}%
      `);
    }

    const { data, error } = await query?.order('created_at', { ascending: false });
    
    if (error) {
      throw error;
    }
    
    return data || [];
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    throw error;
  }
};

// Vendor-specific vehicle access function
export const getVendorAccessibleVehicles = async (vendorId) => {
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
function createVehicleWithProducts(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: createVehicleWithProducts is not implemented yet.', args);
  return null;
}

export { createVehicleWithProducts };