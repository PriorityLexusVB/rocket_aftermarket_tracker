// src/services/vendorService.js
import { supabase } from '../lib/supabaseClient';

export const vendorService = {
  async getAll() {
    const { data, error } = await supabase?.from('vendors')?.select('*')?.eq('is_active', true)?.order('name', { ascending: true });
    if (error) {
      console.error('Error fetching vendors:', error);
      return [];
    }
    return data || [];
  },

  async search(term) {
    if (!term?.trim()) return this.getAll();
    const { data, error } = await supabase?.from('vendors')?.select('*')?.or(`name.ilike.%${term}%,specialty.ilike.%${term}%,contact_person.ilike.%${term}%`)?.eq('is_active', true)?.order('name', { ascending: true })?.limit(50);
    if (error) {
      console.error('Error searching vendors:', error);
      return [];
    }
    return data || [];
  },

  async getById(id) {
    if (!id) return null;
    const { data, error } = await supabase?.from('vendors')?.select(`*, vendor_hours:vendor_hours(*), products:products(count)`)?.eq('id', id)?.single();
    if (error) {
      console.error('Error fetching vendor:', error);
      return null;
    }
    return data;
  }
};

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
function getVendors(...args) {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: getVendors is not implemented yet.', args);
  return null;
}

export { getVendors };