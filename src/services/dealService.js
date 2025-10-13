import { supabase } from '../lib/supabase';

// Deal Service - specialized service for deal/sales transaction management
export const dealService = {
  // Get all deals (alias to jobs with deal context)
  async getAllDeals() {
    try {
      const { data, error } = await supabase
        ?.from('jobs')
        ?.select(`
          *,
          vehicle:vehicles(*),
          vendor:vendors(id, name, specialty, contact_person),
          assigned_to:user_profiles!jobs_assigned_to_fkey(id, full_name, email),
          created_by:user_profiles!jobs_created_by_fkey(id, full_name, email),
          job_parts(
            id,
            quantity_used,
            unit_price,
            total_price,
            product:products(
              id,
              name,
              description,
              category,
              brand,
              unit_price,
              cost
            )
          )
        `)
        ?.order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to fetch deals: ${error?.message}`);
      }

      return data || [];
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        throw new Error('Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.');
      }
      throw error;
    }
  },

  // Get deals (alias for consistency with UI)
  async getDeals(filters = {}) {
    try {
      let query = supabase
        ?.from('jobs')
        ?.select(`
          *,
          vehicle:vehicles(id, make, model, year, license_plate, owner_name, stock_number),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(id, full_name, email),
          vendor:vendors(id, name, contact_person),
          created_by_profile:user_profiles!jobs_created_by_fkey(full_name),
          job_parts(
            id,
            quantity_used,
            unit_price,
            total_price,
            product:products(id, name, category, unit_price, cost)
          )
        `)
        ?.order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query?.eq('job_status', filters?.status);
      }
      
      if (filters?.priority) {
        query = query?.eq('priority', filters?.priority);
      }
      
      if (filters?.assigned_to) {
        query = query?.eq('assigned_to', filters?.assigned_to);
      }

      if (filters?.search) {
        query = query?.or(`job_number.ilike.%${filters?.search}%,title.ilike.%${filters?.search}%,description.ilike.%${filters?.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch deals: ${error?.message}`);
      }

      return data || [];
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        throw new Error('Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.');
      }
      throw error;
    }
  },

  // Get all products
  async getProducts() {
    try {
      const { data, error } = await supabase
        ?.from('products')
        ?.select('*')
        ?.eq('is_active', true)
        ?.order('name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch products: ${error?.message}`);
      }

      return data || [];
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        throw new Error('Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.');
      }
      throw error;
    }
  },

  // Get all vendors
  async getVendors() {
    try {
      const { data, error } = await supabase
        ?.from('vendors')
        ?.select('*')
        ?.eq('is_active', true)
        ?.order('name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch vendors: ${error?.message}`);
      }

      return data || [];
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        throw new Error('Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.');
      }
      throw error;
    }
  },

  // Get staff by department
  async getStaffByDepartment(department) {
    try {
      const { data, error } = await supabase
        ?.from('user_profiles')
        ?.select('*')
        ?.eq('is_active', true)
        ?.ilike('department', `%${department}%`)
        ?.order('full_name', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch staff: ${error?.message}`);
      }

      return data || [];
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        throw new Error('Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.');
      }
      throw error;
    }
  },

  // Create a new deal with line items
  async createDeal(dealData) {
    try {
      // Generate job number
      const { data: jobNumber, error: jobNumberError } = await supabase?.rpc('generate_job_number');
      
      if (jobNumberError) {
        throw new Error(`Failed to generate job number: ${jobNumberError?.message}`);
      }

      // Get current user
      const { data: { user }, error: userError } = await supabase?.auth?.getUser();
      
      if (userError || !user) {
        throw new Error('User not authenticated');
      }

      // Create parent job first
      const jobPayload = {
        job_number: jobNumber,
        title: dealData?.title || 'Sales Transaction',
        description: dealData?.description || 'New deal transaction',
        vehicle_id: dealData?.vehicle_id || null,
        vendor_id: dealData?.vendor_id || null,
        service_type: dealData?.service_type || (dealData?.vendor_id ? 'vendor' : 'in_house'),
        location: dealData?.location || (dealData?.vendor_id ? 'Off-Site' : 'In-House Service Bay'),
        priority: dealData?.priority || 'medium',
        promised_date: dealData?.promised_date || null,
        scheduled_start_time: dealData?.scheduled_start_time || null,
        scheduled_end_time: dealData?.scheduled_end_time || null,
        estimated_cost: dealData?.estimated_cost || 0,
        job_status: dealData?.job_status || 'pending',
        assigned_to: dealData?.assigned_to || null,
        finance_manager_id: dealData?.finance_manager_id || null,
        delivery_coordinator_id: dealData?.delivery_coordinator_id || null,
        customer_needs_loaner: dealData?.customer_needs_loaner || false,
        calendar_notes: dealData?.calendar_notes || null,
        color_code: dealData?.color_code || '#3b82f6',
        created_by: user?.id
      };

      const { data: createdJob, error: jobError } = await supabase
        ?.from('jobs')
        ?.insert([jobPayload])
        ?.select()
        ?.single();

      if (jobError) {
        throw new Error(`Failed to create job: ${jobError?.message}`);
      }

      // Create line items (job_parts) if provided
      if (dealData?.lineItems && dealData?.lineItems?.length > 0) {
        const lineItemsData = dealData?.lineItems?.map(item => ({
          job_id: createdJob?.id,
          product_id: item?.product_id,
          quantity_used: item?.quantity || 1,
          unit_price: parseFloat(item?.unit_price) || 0
        }));

        const { error: lineItemsError } = await supabase?.from('job_parts')?.insert(lineItemsData);

        if (lineItemsError) {
          // Rollback: delete the created job
          await supabase?.from('jobs')?.delete()?.eq('id', createdJob?.id);
          throw new Error(`Failed to create line items: ${lineItemsError?.message}`);
        }
      }

      // Return the complete deal with line items
      return await this.getDealById(createdJob?.id);
    } catch (error) {
      throw error;
    }
  },

  // Update a deal with line items
  async updateDeal(dealId, dealData) {
    if (!dealId) throw new Error('Deal ID is required');
    
    try {
      // Update the main job record
      const { data: jobData, error: jobError } = await supabase?.from('jobs')?.update({
          title: dealData?.title,
          description: dealData?.description,
          vehicle_id: dealData?.vehicle_id,
          vendor_id: dealData?.vendor_id || null,
          service_type: dealData?.vendor_id ? 'vendor' : 'in_house',
          location: dealData?.vendor_id 
            ? `${dealData?.vendorName || 'Vendor'} - Off-Site`
            : 'In-House Service Bay',
          priority: dealData?.priority || 'medium',
          promised_date: dealData?.promised_date,
          scheduled_start_time: dealData?.scheduled_start_time,
          scheduled_end_time: dealData?.scheduled_end_time,
          estimated_cost: dealData?.estimated_cost,
          customer_needs_loaner: dealData?.customer_needs_loaner || false,
          delivery_coordinator_id: dealData?.delivery_coordinator_id,
          assigned_to: dealData?.assigned_to,
          calendar_notes: dealData?.calendar_notes,
          color_code: dealData?.color_code,
          job_status: dealData?.job_status,
          updated_at: new Date()?.toISOString()
        })?.eq('id', dealId)?.select()?.single();

      if (jobError) {
        throw new Error(`Failed to update deal: ${jobError?.message}`);
      }

      // Handle line items updates
      if (dealData?.lineItems !== undefined) {
        // Delete existing line items
        const { error: deleteError } = await supabase?.from('job_parts')?.delete()?.eq('job_id', dealId);
        
        if (deleteError) {
          throw new Error(`Failed to update line items: ${deleteError?.message}`);
        }

        // Insert new line items
        if (dealData?.lineItems?.length > 0) {
          const lineItemsData = dealData?.lineItems?.map(item => ({
            job_id: dealId,
            product_id: item?.product_id,
            quantity_used: item?.quantity || 1,
            unit_price: parseFloat(item?.unit_price) || 0
          }));

          const { error: insertError } = await supabase?.from('job_parts')?.insert(lineItemsData);

          if (insertError) {
            throw new Error(`Failed to update line items: ${insertError?.message}`);
          }
        }
      }

      // Return the updated deal with line items
      return await this.getDealById(dealId);
    } catch (error) {
      throw error;
    }
  },

  // Get deal by ID with full details
  async getDealById(id) {
    if (!id) return null;
    
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicle:vehicles(*),
          vendor:vendors(id, name, specialty, contact_person, phone, email),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(id, full_name, email, role),
          created_by_profile:user_profiles!jobs_created_by_fkey(id, full_name, email),
          delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey(id, full_name, email),
          job_parts(
            id,
            quantity_used,
            unit_price,
            total_price,
            created_at,
            product:products(
              id,
              name,
              description,
              category,
              brand,
              unit_price,
              cost,
              part_number,
              op_code
            )
          )
        `)?.eq('id', id)?.single();

      if (error) {
        if (error?.message?.includes('Failed to fetch')) {
          throw new Error('Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.');
        }
        return null;
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  // Delete a deal and all its line items
  async deleteDeal(dealId) {
    if (!dealId) throw new Error('Deal ID is required');
    
    try {
      // Delete job_parts first (foreign key constraint)
      const { error: lineItemsError } = await supabase?.from('job_parts')?.delete()?.eq('job_id', dealId);
      
      if (lineItemsError) {
        throw new Error(`Failed to delete line items: ${lineItemsError?.message}`);
      }

      // Delete the main job
      const { error: jobError } = await supabase?.from('jobs')?.delete()?.eq('id', dealId);
      
      if (jobError) {
        throw new Error(`Failed to delete deal: ${jobError?.message}`);
      }

      return true;
    } catch (error) {
      throw error;
    }
  },

  // Update deal status
  async updateDealStatus(dealId, status, additionalData = {}) {
    if (!dealId || !status) throw new Error('Deal ID and status are required');
    
    try {
      const updateData = {
        job_status: status,
        updated_at: new Date()?.toISOString(),
        ...additionalData
      };

      // Set completed_at when status is completed
      if (status === 'completed' && !updateData?.completed_at) {
        updateData.completed_at = new Date()?.toISOString();
      }

      const { data, error } = await supabase?.from('jobs')?.update(updateData)?.eq('id', dealId)?.select()?.single();

      if (error) {
        throw new Error(`Failed to update status: ${error?.message}`);
      }

      return data;
    } catch (error) {
      throw error;
    }
  },

  // Calculate deal totals from line items
  calculateDealTotals(jobParts) {
    if (!jobParts || !Array.isArray(jobParts)) {
      return { totalCost: 0, totalPrice: 0, totalProfit: 0, itemCount: 0 };
    }

    const totalCost = jobParts?.reduce((sum, part) => {
      const cost = (part?.product?.cost || 0) * (part?.quantity_used || 1);
      return sum + cost;
    }, 0);

    const totalPrice = jobParts?.reduce((sum, part) => {
      const price = (part?.unit_price || 0) * (part?.quantity_used || 1);
      return sum + price;
    }, 0);

    const totalProfit = totalPrice - totalCost;

    return {
      totalCost: parseFloat(totalCost?.toFixed(2)),
      totalPrice: parseFloat(totalPrice?.toFixed(2)),
      totalProfit: parseFloat(totalProfit?.toFixed(2)),
      itemCount: jobParts?.length
    };
  }
};

export default dealService;