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
   * PHASE 2: Enhanced createDeal with vehicle creation support - FIXED timestamp validation
   */
  async createDeal(payload) {
    try {
      const { vehicle, deal, items = [], transaction } = payload;
      
      let vehicleId = deal?.vehicle_id;

      // Step 1: Create or find vehicle if vehicle data provided
      if (vehicle && (!vehicleId || vehicleId === 'new')) {
        // Check if vehicle exists by stock_number or VIN
        let existingVehicle = null;
        
        if (vehicle?.stock_number) {
          const { data: stockCheck } = await supabase
            ?.from('vehicles')
            ?.select('id')
            ?.eq('stock_number', vehicle?.stock_number)
            ?.single();
          existingVehicle = stockCheck;
        }
        
        if (!existingVehicle && vehicle?.vin) {
          const { data: vinCheck } = await supabase
            ?.from('vehicles')
            ?.select('id')
            ?.eq('vin', vehicle?.vin)
            ?.single();
          existingVehicle = vinCheck;
        }

        if (existingVehicle) {
          vehicleId = existingVehicle?.id;
        } else {
          // Create new vehicle
          const { data: createdVehicle, error: vehicleError } = await supabase
            ?.from('vehicles')
            ?.insert({
              year: vehicle?.year,
              make: vehicle?.make,
              model: vehicle?.model,
              color: vehicle?.color,
              vin: vehicle?.vin,
              mileage: vehicle?.mileage,
              stock_number: vehicle?.stock_number,
              owner_name: vehicle?.owner_name,
              owner_phone: vehicle?.owner_phone,
              owner_email: vehicle?.owner_email,
              created_by: deal?.created_by
            })
            ?.select('id')
            ?.single();

          if (vehicleError) throw vehicleError;
          vehicleId = createdVehicle?.id;
        }
      }

      // PHASE 2 FIX: Clean timestamp fields to prevent PostgreSQL 22007 errors
      const cleanDealData = {
        title: deal?.title,
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
}

// Export singleton instance
export const dealService = new DealService();
export default dealService;