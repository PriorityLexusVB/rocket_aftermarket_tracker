// src/services/productService.js
import { supabase } from '../lib/supabaseClient';

export const productService = {
  async getAllActive() {
    const { data, error } = await supabase?.from('products')?.select('*')?.eq('is_active', true)?.order('name', { ascending: true });
    if (error) {
      console.error('Error fetching products:', error);
      return [];
    }
    return data || [];
  }
};
