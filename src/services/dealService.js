// PHASE 2: Deal Service - Enhanced with vehicle creation support
import { supabase } from '../lib/supabase';

class DealService {
  /**
   * List deals with pagination, query, and filters
   */
  async listDeals({ page = 0, limit = 50, query = '', filters = {} }) {
    try {
      let queryBuilder = supabase?.from('jobs')?.select(`
          *,
          vehicles:vehicles!jobs_vehicle_id_fkey (
            id, stock_number, year, make, model, color, vin, 
            owner_name, owner_phone, owner_email
          ),
          vendors (id, name, specialty),
          sales_person:user_profiles!jobs_created_by_fkey (id, full_name, email),
          delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey (id, full_name, email),
          assigned_user:user_profiles!jobs_assigned_to_fkey (id, full_name, email),
          job_parts (
            id, quantity_used, unit_price, total_price,
            products (
              id, name, op_code, unit_price, category, brand, part_number
            )
          ),
          transactions (
            id, created_at, total_amount,
            customer_name, customer_phone, customer_email
          )
        `);

      // Apply search query
      if (query?.trim()) {
        queryBuilder = queryBuilder?.or(`
          title.ilike.%${query}%,
          description.ilike.%${query}%,
          job_number.ilike.%${query}%
        `);
      }

      // Apply status filter
      if (filters?.status && filters?.status !== 'all') {
        queryBuilder = queryBuilder?.eq('job_status', filters?.status);
      }

      // Apply vehicle filter
      if (filters?.vehicleId) {
        queryBuilder = queryBuilder?.eq('vehicle_id', filters?.vehicleId);
      }

      // Apply vendor filter
      if (filters?.vendorId) {
        queryBuilder = queryBuilder?.eq('vendor_id', filters?.vendorId);
      }

      // Apply date range filters
      if (filters?.startDate) {
        queryBuilder = queryBuilder?.gte('created_at', filters?.startDate);
      }
      if (filters?.endDate) {
        queryBuilder = queryBuilder?.lte('created_at', filters?.endDate);
      }

      // Apply pagination and ordering
      const { data, error, count } = await queryBuilder?.order('created_at', { ascending: false })?.range(page * limit, (page + 1) * limit - 1);

      if (error) throw error;

      return {
        data: data || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          hasMore: (count || 0) > (page + 1) * limit
        }
      };
    } catch (error) {
      console.error('Error listing deals:', error);
      throw new Error(`Failed to load deals: ${error?.message}`);
    }
  }

  /**
   * Get single deal by ID with full details
   */
  async getDeal(dealId) {
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicles:vehicles!jobs_vehicle_id_fkey (
            id, stock_number, year, make, model, color, vin, 
            owner_name, owner_phone, owner_email, mileage
          ),
          vendors (id, name, specialty, phone, email),
          sales_person:user_profiles!jobs_created_by_fkey (id, full_name, email),
          delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey (id, full_name, email),
          assigned_user:user_profiles!jobs_assigned_to_fkey (id, full_name, email),
          finance_manager:user_profiles!jobs_finance_manager_id_fkey (id, full_name, email)
        `)?.eq('id', dealId)?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error getting deal:', error);
      throw new Error(`Failed to load deal: ${error?.message}`);
    }
  }

  /**
   * Get deal line items (job_parts) by deal ID
   */
  async getDealItems(dealId) {
    try {
      const { data, error } = await supabase?.from('job_parts')?.select(`
          id, job_id, product_id, quantity_used, unit_price, total_price, created_at,
          products (
            id, name, op_code, unit_price, category, brand, part_number, description, cost
          )
        `)?.eq('job_id', dealId)?.order('created_at', { ascending: true });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting deal items:', error);
      throw new Error(`Failed to load deal items: ${error?.message}`);
    }
  }

  /**
   * PHASE 2: Enhanced createDeal with vehicle creation support - FIXED VIN constraint handling
   */
  async createDeal(payload) {
    try {
      const { vehicle, deal, items = [], transaction } = payload;
      
      let vehicleId = deal?.vehicle_id;

      // Step 1: Create or find vehicle if vehicle data provided
      if (vehicle && (!vehicleId || vehicleId === 'new')) {
        vehicleId = await this._handleVehicleCreation(vehicle, deal?.created_by);
      }

      // PHASE 2 FIX: Clean timestamp fields to prevent PostgreSQL 22007 errors
      const cleanDealData = {
        // FIX: Generate automatic title from vehicle and customer data
        title: this._generateDealTitle(vehicle, customerData, deal),
        description: deal?.description,
        vehicle_id: vehicleId,
        vendor_id: deal?.vendor_id || null,
        created_by: deal?.created_by,
        delivery_coordinator_id: deal?.delivery_coordinator_id,
        assigned_to: deal?.assigned_to, // Sales consultant
        job_status: deal?.job_status || 'pending',
        priority: deal?.priority || 'medium',
        service_type: deal?.service_type || 'in_house',
        customer_needs_loaner: deal?.customer_needs_loaner || false,
        // FIX: Convert empty strings to null for timestamp fields
        promised_date: deal?.promised_date && deal?.promised_date?.trim() !== '' ? deal?.promised_date : null,
        scheduled_start_time: deal?.scheduled_start_time && deal?.scheduled_start_time?.trim() !== '' ? deal?.scheduled_start_time : null,
        scheduled_end_time: deal?.scheduled_end_time && deal?.scheduled_end_time?.trim() !== '' ? deal?.scheduled_end_time : null,
        estimated_cost: deal?.estimated_cost,
        estimated_hours: deal?.estimated_hours,
        location: deal?.location,
        calendar_notes: deal?.calendar_notes
      };

      // Step 2: Create the job (deal) with cleaned data
      const { data: createdDeal, error: dealError } = await supabase?.from('jobs')?.insert(cleanDealData)?.select('id')?.single();

      if (dealError) throw dealError;

      const dealId = createdDeal?.id;

      // Step 3: Create line items if provided
      if (items?.length > 0) {
        const lineItems = items?.map(item => ({
          job_id: dealId,
          product_id: item?.product_id,
          quantity_used: item?.quantity_used || 1,
          unit_price: item?.unit_price
        }));

        const { error: itemsError } = await supabase?.from('job_parts')?.insert(lineItems);

        if (itemsError) throw itemsError;
      }

      // Step 4: Create transaction record if provided
      if (transaction) {
        const { error: transactionError } = await supabase?.from('transactions')?.insert({
            job_id: dealId,
            vehicle_id: vehicleId,
            customer_name: transaction?.customer_name,
            customer_phone: transaction?.customer_phone,
            customer_email: transaction?.customer_email,
            total_amount: transaction?.total_amount || 0,
            subtotal: transaction?.subtotal || 0,
            tax_amount: transaction?.tax_amount || 0,
            transaction_status: 'pending',
            notes: transaction?.notes
          });

        if (transactionError) throw transactionError;
      }

      // Return the created deal with full details
      return await this.getDeal(dealId);
    } catch (error) {
      console.error('Error creating deal:', error);
      throw new Error(`Failed to create deal: ${error?.message}`);
    }
  }

  /**
   * Enhanced vehicle creation with proper duplicate VIN/stock number handling
   * @private
   */
  async _handleVehicleCreation(vehicle, createdBy) {
    try {
      // Step 1: Comprehensive existing vehicle lookup
      let existingVehicle = await this._findExistingVehicle(vehicle);
      
      if (existingVehicle) {
        console.log('Found existing vehicle:', existingVehicle?.id);
        return existingVehicle?.id;
      }

      // Step 2: Prepare vehicle data for creation
      const vehicleData = this._prepareVehicleData(vehicle, createdBy);

      // Step 3: Attempt to create vehicle with constraint violation handling
      try {
        const { data: createdVehicle, error: vehicleError } = await supabase
          ?.from('vehicles')
          ?.insert(vehicleData)
          ?.select('id')
          ?.single();

        if (vehicleError) {
          // Check if this is a constraint violation (duplicate VIN)
          if (vehicleError?.code === '23505' && vehicleError?.message?.includes('vehicles_vin_key')) {
            console.log('VIN constraint violation detected, attempting to find existing vehicle');
            // Try to find the existing vehicle one more time
            existingVehicle = await this._findExistingVehicle(vehicle);
            if (existingVehicle) {
              return existingVehicle?.id;
            }
          }
          throw vehicleError;
        }

        return createdVehicle?.id;
      } catch (constraintError) {
        // Handle race condition where vehicle was created between our check and insert
        if (constraintError?.code === '23505' && constraintError?.message?.includes('vehicles_vin_key')) {
          console.log('Race condition detected, searching for newly created vehicle');
          existingVehicle = await this._findExistingVehicle(vehicle);
          if (existingVehicle) {
            return existingVehicle?.id;
          }
          throw new Error('Vehicle with this VIN already exists but could not be located');
        }
        throw constraintError;
      }
    } catch (error) {
      console.error('Error in _handleVehicleCreation:', error);
      throw error;
    }
  }

  /**
   * Comprehensive vehicle lookup by VIN, stock_number, and vehicle details
   * @private
   */
  async _findExistingVehicle(vehicle) {
    try {
      let existingVehicle = null;

      // Primary lookup: VIN (most reliable)
      if (vehicle?.vin?.trim()) {
        const { data: vinCheck } = await supabase
          ?.from('vehicles')
          ?.select('id')
          ?.eq('vin', vehicle?.vin?.trim())
          ?.single();
        existingVehicle = vinCheck;
      }

      // Secondary lookup: Stock number
      if (!existingVehicle && vehicle?.stock_number?.trim()) {
        const { data: stockCheck } = await supabase
          ?.from('vehicles')
          ?.select('id')
          ?.eq('stock_number', vehicle?.stock_number?.trim())
          ?.single();
        existingVehicle = stockCheck;
      }

      // Tertiary lookup: Exact vehicle match (year, make, model, owner combination)
      if (!existingVehicle && vehicle?.year && vehicle?.make && vehicle?.model) {
        let query = supabase
          ?.from('vehicles')
          ?.select('id')
          ?.eq('year', vehicle?.year)
          ?.ilike('make', vehicle?.make?.trim())
          ?.ilike('model', vehicle?.model?.trim());

        // Add owner filters if available
        if (vehicle?.owner_name?.trim()) {
          query = query?.ilike('owner_name', vehicle?.owner_name?.trim());
        }
        if (vehicle?.owner_phone?.trim()) {
          query = query?.eq('owner_phone', vehicle?.owner_phone?.trim());
        }
        if (vehicle?.owner_email?.trim()) {
          query = query?.ilike('owner_email', vehicle?.owner_email?.trim());
        }

        const { data: exactMatch } = await query?.single();
        existingVehicle = exactMatch;
      }

      return existingVehicle;
    } catch (error) {
      // Single record queries throw errors when no match, which is expected
      if (error?.code === 'PGRST116') {
        return null; // No match found
      }
      console.error('Error in _findExistingVehicle:', error);
      throw error;
    }
  }

  /**
   * Prepare and validate vehicle data for database insertion
   * @private
   */
  _prepareVehicleData(vehicle, createdBy) {
    return {
      year: vehicle?.year || null,
      make: vehicle?.make?.trim() || null,
      model: vehicle?.model?.trim() || null,
      color: vehicle?.color?.trim() || null,
      vin: vehicle?.vin?.trim() || null, // Handle empty VIN properly
      mileage: vehicle?.mileage || null,
      stock_number: vehicle?.stock_number?.trim() || null,
      owner_name: vehicle?.owner_name?.trim() || null,
      owner_phone: vehicle?.owner_phone?.trim() || null,
      owner_email: vehicle?.owner_email?.trim() || null,
      created_by: createdBy
    };
  }

  /**
   * Generate automatic deal title from available data
   * @private
   */
  _generateDealTitle(vehicle, customerData, deal) {
    try {
      // Extract customer name from various sources
      let customerName = '';
      if (customerData?.customer_first_name && customerData?.customer_last_name) {
        customerName = `${customerData?.customer_first_name} ${customerData?.customer_last_name}`;
      } else if (vehicle?.owner_name) {
        customerName = vehicle?.owner_name;
      } else if (deal?.customer_name) {
        customerName = deal?.customer_name;
      } else {
        customerName = 'Customer';
      }

      // Extract vehicle description
      let vehicleDesc = '';
      if (vehicle?.year && vehicle?.make && vehicle?.model) {
        vehicleDesc = `${vehicle?.year} ${vehicle?.make} ${vehicle?.model}`;
      } else if (vehicle?.make && vehicle?.model) {
        vehicleDesc = `${vehicle?.make} ${vehicle?.model}`;
      } else if (vehicle?.stock_number) {
        vehicleDesc = `Stock #${vehicle?.stock_number}`;
      } else {
        vehicleDesc = 'Vehicle';
      }

      // Generate comprehensive title
      const title = `${customerName} - ${vehicleDesc}`;
      
      // Ensure title doesn't exceed reasonable length (PostgreSQL text fields can handle this but keep it clean)
      return title?.length > 100 ? title?.substring(0, 97) + '...' : title;
    } catch (error) {
      console.error('Error generating deal title:', error);
      // Fallback title to ensure we never return null/undefined
      return `Deal - ${new Date()?.toISOString()?.slice(0, 10)}`;
    }
  }

  /**
   * Update existing deal with partial data - FIXED timestamp validation
   */
  async updateDeal(dealId, patch) {
    try {
      // Filter out undefined values and system-generated fields
      const cleanPatch = Object.fromEntries(
        Object.entries(patch)?.filter(([_, value]) => value !== undefined)
      );

      // Remove read-only fields
      delete cleanPatch?.id;
      delete cleanPatch?.created_at;
      delete cleanPatch?.updated_at;
      delete cleanPatch?.job_number;

      // PHASE 2 FIX: Clean timestamp fields to prevent PostgreSQL 22007 errors
      if ('promised_date' in cleanPatch) {
        cleanPatch.promised_date = cleanPatch?.promised_date && cleanPatch?.promised_date?.trim() !== '' ? cleanPatch?.promised_date : null;
      }
      if ('scheduled_start_time' in cleanPatch) {
        cleanPatch.scheduled_start_time = cleanPatch?.scheduled_start_time && cleanPatch?.scheduled_start_time?.trim() !== '' ? cleanPatch?.scheduled_start_time : null;
      }
      if ('scheduled_end_time' in cleanPatch) {
        cleanPatch.scheduled_end_time = cleanPatch?.scheduled_end_time && cleanPatch?.scheduled_end_time?.trim() !== '' ? cleanPatch?.scheduled_end_time : null;
      }

      const { data, error } = await supabase?.from('jobs')?.update(cleanPatch)?.eq('id', dealId)?.select('id')?.single();

      if (error) throw error;

      // Return updated deal with full details
      return await this.getDeal(dealId);
    } catch (error) {
      console.error('Error updating deal:', error);
      throw new Error(`Failed to update deal: ${error?.message}`);
    }
  }

  /**
   * Mutate deal line items with insert/update/delete operations
   */
  async mutateItems(dealId, mutations) {
    try {
      const { insert = [], update = [], delete: deleteIds = [] } = mutations;

      // Delete items first
      if (deleteIds?.length > 0) {
        const { error: deleteError } = await supabase?.from('job_parts')?.delete()?.in('id', deleteIds)?.eq('job_id', dealId);

        if (deleteError) throw deleteError;
      }

      // Insert new items
      if (insert?.length > 0) {
        const newItems = insert?.map(item => ({
          job_id: dealId,
          product_id: item?.product_id,
          quantity_used: item?.quantity_used || 1,
          unit_price: item?.unit_price
        }));

        const { error: insertError } = await supabase?.from('job_parts')?.insert(newItems);

        if (insertError) throw insertError;
      }

      // Update existing items
      if (update?.length > 0) {
        for (const item of update) {
          const { id, ...updateData } = item;
          
          // Remove system fields
          delete updateData?.created_at;
          delete updateData?.total_price; // Auto-generated
          
          const { error: updateError } = await supabase?.from('job_parts')?.update(updateData)?.eq('id', id)?.eq('job_id', dealId);

          if (updateError) throw updateError;
        }
      }

      // Return updated line items
      return await this.getDealItems(dealId);
    } catch (error) {
      console.error('Error mutating deal items:', error);
      throw new Error(`Failed to update deal items: ${error?.message}`);
    }
  }

  /**
   * Delete deal and associated data
   */
  async deleteDeal(dealId) {
    try {
      // Delete associated records first (explicit cascading)
      await supabase?.from('job_parts')?.delete()?.eq('job_id', dealId);
      await supabase?.from('transactions')?.delete()?.eq('job_id', dealId);
      await supabase?.from('communications')?.delete()?.eq('job_id', dealId);

      // Delete the main deal
      const { error } = await supabase?.from('jobs')?.delete()?.eq('id', dealId);

      if (error) throw error;

      return { success: true };
    } catch (error) {
      console.error('Error deleting deal:', error);
      throw new Error(`Failed to delete deal: ${error?.message}`);
    }
  }

  /**
   * Get deal statistics and metrics
   */
  async getDealStats(filters = {}) {
    try {
      let queryBuilder = supabase?.from('jobs')?.select('id, job_status, estimated_cost, created_at');

      // Apply filters
      if (filters?.startDate) {
        queryBuilder = queryBuilder?.gte('created_at', filters?.startDate);
      }
      if (filters?.endDate) {
        queryBuilder = queryBuilder?.lte('created_at', filters?.endDate);
      }
      if (filters?.vendorId) {
        queryBuilder = queryBuilder?.eq('vendor_id', filters?.vendorId);
      }

      const { data, error } = await queryBuilder;

      if (error) throw error;

      // Calculate statistics
      const stats = {
        total: data?.length || 0,
        pending: data?.filter(d => d?.job_status === 'pending')?.length || 0,
        inProgress: data?.filter(d => d?.job_status === 'in_progress')?.length || 0,
        completed: data?.filter(d => d?.job_status === 'completed')?.length || 0,
        scheduled: data?.filter(d => d?.job_status === 'scheduled')?.length || 0,
        totalValue: data?.reduce((sum, d) => sum + (parseFloat(d?.estimated_cost) || 0), 0) || 0
      };

      return stats;
    } catch (error) {
      console.error('Error getting deal stats:', error);
      throw new Error(`Failed to get deal statistics: ${error?.message}`);
    }
  }

  /**
   * Get staff members by department for dropdown population
   * Fixed to query by department instead of role since all users have role='staff'
   */
  async getStaffByRole(department) {
    try {
      let query = supabase
        ?.from('user_profiles')
        ?.select('id, full_name, department')
        ?.eq('is_active', true)
        ?.order('full_name');

      // Map common department requests to actual database department values
      const departmentMapping = {
        'sales': '%Sales%',
        'finance': '%Finance%', 
        'delivery_coordinator': '%Delivery%',
        'delivery': '%Delivery%'
      };

      // Use ILIKE pattern matching for department since departments have full names
      if (departmentMapping?.[department?.toLowerCase()]) {
        query = query?.ilike('department', departmentMapping?.[department?.toLowerCase()]);
      } else {
        // Fallback: try direct department match or pattern match
        query = query?.or(`department.ilike.%${department}%,department.ilike.%${department?.toLowerCase()}%`);
      }

      const { data, error } = await query;

      if (error) throw new Error(`Error fetching staff for department ${department}: ${error?.message}`);

      console.log(`Fetched ${data?.length || 0} users for department: ${department}`, data);
      return data || [];
    } catch (error) {
      console.error('Get staff by department failed:', error);
      return []; // Return an empty array on failure
    }
  }

  /**
   * Simple getDeals method for backward compatibility
   * This method provides a simple interface for getting all deals
   */
  async getDeals(options = {}) {
    try {
      // Use the existing listDeals method with default parameters
      const result = await this.listDeals({
        page: 0,
        limit: options?.limit || 100,
        query: options?.query || '',
        filters: options?.filters || {}
      });

      // Return just the data array for simple usage
      return result?.data || [];
    } catch (error) {
      console.error('Error in getDeals:', error);
      throw new Error(`Failed to get deals: ${error?.message}`);
    }
  }
}

// Export singleton instance
export const dealService = new DealService();
export default dealService;