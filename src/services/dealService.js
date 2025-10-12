// PHASE 2: Deal Service - Enhanced with vehicle creation support
import { supabase } from '../lib/supabase';

const dealService = {
  // Get all deals - for backward compatibility
  async getDeals() {
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicles:vehicles!jobs_vehicle_id_fkey (
            id, stock_number, year, make, model, color, vin, 
            owner_name, owner_phone, owner_email
          ),
          vendors (id, name, specialty),
          sales_person:user_profiles!jobs_created_by_fkey (id, full_name, email),
          delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey (id, full_name, email),
          assigned_user:user_profiles!jobs_assigned_to_fkey (id, full_name, email),
          transactions (
            id, created_at, total_amount,
            customer_name, customer_phone, customer_email
          )
        `)?.order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error getting deals:', error);
      throw new Error(`Failed to load deals: ${error.message}`);
    }
  },

  // Create new deal
  async createDeal(dealData) {
    try {
      const { data, error } = await supabase?.from('jobs')?.insert({
          title: `${dealData?.customer_name} - ${dealData?.vehicle}`,
          description: `Deal for ${dealData?.customer_name}`,
          customer_name: dealData?.customer_name,
          vehicle: dealData?.vehicle,
          sales_person_id: dealData?.sales_person_id,
          finance_manager_id: dealData?.finance_manager_id,
          product_id: dealData?.product_id,
          job_status: 'pending',
          estimated_cost: 0
        })?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error creating deal:', error);
      throw new Error(`Failed to create deal: ${error.message}`);
    }
  },

  // Update existing deal
  async updateDeal(dealId, dealData) {
    try {
      const { data, error } = await supabase?.from('jobs')?.update({
          title: `${dealData?.customer_name} - ${dealData?.vehicle}`,
          customer_name: dealData?.customer_name,
          vehicle: dealData?.vehicle,
          sales_person_id: dealData?.sales_person_id,
          finance_manager_id: dealData?.finance_manager_id,
          product_id: dealData?.product_id
        })?.eq('id', dealId)?.select()?.single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error updating deal:', error);
      throw new Error(`Failed to update deal: ${error.message}`);
    }
  },

  // Delete deal
  async deleteDeal(dealId) {
    try {
      const { error } = await supabase?.from('jobs')?.delete()?.eq('id', dealId);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      console.error('Error deleting deal:', error);
      throw new Error(`Failed to delete deal: ${error.message}`);
    }
  },

  // Get staff by role/department
  async getStaffByRole(role) {
    try {
      let query = supabase?.from('user_profiles')?.select('id, full_name, department')?.eq('is_active', true)?.order('full_name');

      // Map role to department patterns
      const departmentMapping = {
        'sales': '%Sales%',
        'finance': '%Finance%'
      };

      if (departmentMapping?.[role?.toLowerCase()]) {
        query = query?.ilike('department', departmentMapping?.[role?.toLowerCase()]);
      }

      const { data, error } = await query;

      if (error) throw new Error(`Error fetching staff for role ${role}: ${error.message}`);
      
      console.log(`Fetched ${data?.length} users with role: ${role}`);
      return data || [];
    } catch (error) {
      console.error('Get staff by role failed:', error);
      return [];
    }
  },

  // Get products
  async getProducts() {
    try {
      const { data, error } = await supabase?.from('products')?.select('id, name, unit_price')?.eq('is_active', true)?.order('name');

      if (error) throw new Error(`Error fetching products: ${error.message}`);
      
      console.log(`Fetched ${data?.length} products.`);
      return data || [];
    } catch (error) {
      console.error('Get products failed:', error);
      return [];
    }
  }
};

export default dealService;