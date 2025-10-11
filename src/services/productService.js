import { supabase } from '../lib/supabase';

export const productService = {
  async getAllProducts() {
    try {
      const { data, error } = await supabase?.from('products')?.select(`
          *,
          vendor:vendors(id, name, specialty)
        `)?.eq('is_active', true)?.order('category', { ascending: true })?.order('name', { ascending: true });

      if (error) {
        console.error('Error fetching products:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error fetching products:', error);
      return [];
    }
  },

  async getProductById(id) {
    if (!id) return null;
    
    try {
      const { data, error } = await supabase?.from('products')?.select(`
          *,
          vendor:vendors(id, name, specialty, contact_person)
        `)?.eq('id', id)?.single();

      if (error) {
        console.error('Error fetching product:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Network error fetching product:', error);
      return null;
    }
  },

  async createProduct(productData) {
    try {
      const { data, error } = await supabase?.from('products')?.insert([{
          name: productData?.name,
          description: productData?.description || '',
          category: productData?.category || 'Other',
          unit_price: productData?.unit_price || 0,
          cost: productData?.cost || 0,
          brand: productData?.brand || '',
          part_number: productData?.part_number || null,
          vendor_id: productData?.vendor_id || null,
          quantity_in_stock: productData?.quantity_in_stock || 0,
          minimum_stock_level: productData?.minimum_stock_level || 0,
          is_active: productData?.is_active !== undefined ? productData?.is_active : true
        }])?.select()?.single();

      if (error) {
        console.error('Error creating product:', error);
        throw new Error(`Failed to create product: ${error?.message}`);
      }

      return data;
    } catch (error) {
      console.error('Network error creating product:', error);
      throw error;
    }
  },

  async updateProduct(id, updates) {
    if (!id) throw new Error('Product ID is required');
    
    try {
      const { data, error } = await supabase?.from('products')?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })?.eq('id', id)?.select()?.single();

      if (error) {
        console.error('Error updating product:', error);
        throw new Error(`Failed to update product: ${error?.message}`);
      }

      return data;
    } catch (error) {
      console.error('Network error updating product:', error);
      throw error;
    }
  },

  async deleteProduct(id) {
    if (!id) throw new Error('Product ID is required');
    
    try {
      // Soft delete by setting is_active to false
      const { error } = await supabase?.from('products')?.update({ 
          is_active: false,
          updated_at: new Date()?.toISOString()
        })?.eq('id', id);

      if (error) {
        console.error('Error deleting product:', error);
        throw new Error(`Failed to delete product: ${error?.message}`);
      }

      return true;
    } catch (error) {
      console.error('Network error deleting product:', error);
      throw error;
    }
  },

  async getProductsByCategory(category) {
    if (!category) return [];
    
    try {
      const { data, error } = await supabase?.from('products')?.select(`
          *,
          vendor:vendors(id, name, specialty)
        `)?.eq('category', category)?.eq('is_active', true)?.order('name', { ascending: true });

      if (error) {
        console.error('Error fetching products by category:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error fetching products by category:', error);
      return [];
    }
  },

  async searchProducts(searchTerm) {
    if (!searchTerm?.trim()) return [];
    
    try {
      const { data, error } = await supabase?.from('products')?.select(`
          *,
          vendor:vendors(id, name, specialty)
        `)?.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,category.ilike.%${searchTerm}%,part_number.ilike.%${searchTerm}%`)?.eq('is_active', true)?.order('name', { ascending: true })?.limit(50);

      if (error) {
        console.error('Error searching products:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error searching products:', error);
      return [];
    }
  },

  async getCategories() {
    try {
      const { data, error } = await supabase?.from('products')?.select('category')?.eq('is_active', true)?.not('category', 'is', null);

      if (error) {
        console.error('Error fetching categories:', error);
        return [];
      }

      // Extract unique categories
      const categories = [...new Set(data?.map(item => item?.category)?.filter(Boolean))];
      return categories?.sort();
    } catch (error) {
      console.error('Network error fetching categories:', error);
      return [];
    }
  },

  async updateStock(productId, quantityUsed) {
    if (!productId || quantityUsed === undefined) {
      throw new Error('Product ID and quantity are required');
    }
    
    try {
      const { error } = await supabase?.rpc('update_product_stock', {
        product_id: productId,
        quantity_used: quantityUsed
      });

      if (error) {
        console.error('Error updating stock:', error);
        throw new Error(`Failed to update stock: ${error?.message}`);
      }

      return true;
    } catch (error) {
      console.error('Network error updating stock:', error);
      throw error;
    }
  }
};