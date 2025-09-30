import { supabase } from '../lib/supabase';
import logger, { ACTION_TYPES, ENTITY_TYPES } from '../utils/logger';

class ProductService {
  // Get all products with vendor info
  async getAllProducts() {
    try {
      await logger?.info(
        'api_call',
        ENTITY_TYPES?.SYSTEM,
        'product-api',
        'Fetching all products from database',
        { endpoint: 'getAllProducts', timestamp: new Date()?.toISOString() }
      );

      const { data: products, error } = await supabase
        ?.from('products')
        ?.select(`
          *,
          vendor:vendors(name, specialty, contact_person),
          created_by_user:user_profiles!products_created_by_fkey(full_name)
        `)
        ?.order('created_at', { ascending: false });

      if (error) throw error;

      const productData = products?.map(product => ({
        ...product,
        vendor_name: product?.vendor?.name || 'Unknown Vendor',
        vendor_specialty: product?.vendor?.specialty,
        vendor_contact: product?.vendor?.contact_person,
        created_by_name: product?.created_by_user?.full_name || 'Unknown',
        stock_status: product?.quantity_in_stock <= product?.minimum_stock_level ? 'low' : 'normal'
      })) || [];

      await logger?.success(
        'products_data_fetched',
        ENTITY_TYPES?.PRODUCT,
        'bulk',
        `Successfully fetched ${productData?.length} product records`,
        { 
          recordCount: productData?.length,
          fetchTime: new Date()?.toISOString()
        }
      );

      return productData;
    } catch (error) {
      await logger?.error(
        'product_fetch_error',
        ENTITY_TYPES?.SYSTEM,
        'product-api',
        `Failed to fetch products: ${error?.message}`,
        { 
          error: error?.message,
          stack: error?.stack
        }
      );
      
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  // Create new product
  async createProduct(productData) {
    try {
      await logger?.info(
        'product_creation_initiated',
        ENTITY_TYPES?.PRODUCT,
        'new',
        `Creating new product: ${productData?.name}`,
        { 
          productData,
          initiatedAt: new Date()?.toISOString()
        }
      );

      const { data: newProduct, error } = await supabase
        ?.from('products')
        ?.insert([{
          name: productData?.name,
          brand: productData?.brand,
          category: productData?.category,
          description: productData?.description,
          part_number: productData?.part_number,
          unit_price: parseFloat(productData?.unit_price),
          quantity_in_stock: parseInt(productData?.quantity_in_stock) || 0,
          minimum_stock_level: parseInt(productData?.minimum_stock_level) || 0,
          vendor_id: productData?.vendor_id,
          is_active: productData?.is_active !== undefined ? productData?.is_active : true
        }])
        ?.select()
        ?.single();

      if (error) throw error;

      await logger?.success(
        'product_created',
        ENTITY_TYPES?.PRODUCT,
        newProduct?.id,
        `Product successfully created: ${newProduct?.name}`,
        {
          productData: newProduct,
          completedAt: new Date()?.toISOString()
        }
      );

      return newProduct;
    } catch (error) {
      await logger?.error(
        'product_creation_failed',
        ENTITY_TYPES?.PRODUCT,
        'failed',
        `Failed to create product: ${error?.message}`,
        {
          error: error?.message,
          productData,
          stack: error?.stack
        }
      );
      
      console.error('Error creating product:', error);
      throw error;
    }
  }

  // Update product
  async updateProduct(productId, updates) {
    try {
      await logger?.info(
        'product_update_initiated',
        ENTITY_TYPES?.PRODUCT,
        productId,
        `Updating product ${productId}`,
        { productId, updates }
      );

      // Get current product data for change tracking
      const { data: currentProduct } = await supabase
        ?.from('products')
        ?.select('*')
        ?.eq('id', productId)
        ?.single();

      const updateData = {
        ...updates,
        updated_at: new Date()?.toISOString()
      };

      // Handle numeric fields
      if (updates?.unit_price !== undefined) {
        updateData.unit_price = parseFloat(updates?.unit_price);
      }
      if (updates?.quantity_in_stock !== undefined) {
        updateData.quantity_in_stock = parseInt(updates?.quantity_in_stock);
      }
      if (updates?.minimum_stock_level !== undefined) {
        updateData.minimum_stock_level = parseInt(updates?.minimum_stock_level);
      }

      const { data: updatedProduct, error } = await supabase
        ?.from('products')
        ?.update(updateData)
        ?.eq('id', productId)
        ?.select()
        ?.single();

      if (error) throw error;

      await logger?.success(
        'product_updated',
        ENTITY_TYPES?.PRODUCT,
        productId,
        `Product successfully updated: ${updatedProduct?.name}`,
        {
          oldData: currentProduct,
          newData: updatedProduct,
          changes: updates
        }
      );

      return updatedProduct;
    } catch (error) {
      await logger?.error(
        'product_update_failed',
        ENTITY_TYPES?.PRODUCT,
        productId,
        `Failed to update product: ${error?.message}`,
        {
          error: error?.message,
          productId,
          updates
        }
      );
      
      console.error('Error updating product:', error);
      throw error;
    }
  }

  // Delete product
  async deleteProduct(productId) {
    try {
      await logger?.info(
        'product_deletion_initiated',
        ENTITY_TYPES?.PRODUCT,
        productId,
        `Initiating deletion of product ${productId}`,
        { productId }
      );

      // Get product data before deletion
      const { data: productToDelete } = await supabase
        ?.from('products')
        ?.select('*')
        ?.eq('id', productId)
        ?.single();

      const { error } = await supabase
        ?.from('products')
        ?.delete()
        ?.eq('id', productId);

      if (error) throw error;

      await logger?.success(
        'product_deleted',
        ENTITY_TYPES?.PRODUCT,
        productId,
        `Product successfully deleted: ${productToDelete?.name}`,
        {
          deletedProduct: productToDelete,
          deletedAt: new Date()?.toISOString()
        }
      );

      return true;
    } catch (error) {
      await logger?.error(
        'product_deletion_failed',
        ENTITY_TYPES?.PRODUCT,
        productId,
        `Failed to delete product: ${error?.message}`,
        {
          error: error?.message,
          productId
        }
      );
      
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  // Get products by vendor
  async getProductsByVendor(vendorId) {
    try {
      const { data: products, error } = await supabase
        ?.from('products')
        ?.select(`
          *,
          vendor:vendors(name, contact_person)
        `)
        ?.eq('vendor_id', vendorId)
        ?.eq('is_active', true)
        ?.order('name');

      if (error) throw error;
      return products || [];
    } catch (error) {
      console.error('Error fetching products by vendor:', error);
      throw error;
    }
  }

  // Get products by category
  async getProductsByCategory(category) {
    try {
      const { data: products, error } = await supabase
        ?.from('products')
        ?.select(`
          *,
          vendor:vendors(name, contact_person)
        `)
        ?.ilike('category', `%${category}%`)
        ?.eq('is_active', true)
        ?.order('name');

      if (error) throw error;
      return products || [];
    } catch (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }
  }

  // Get low stock products
  async getLowStockProducts() {
    try {
      const { data: products, error } = await supabase
        ?.from('products')
        ?.select(`
          *,
          vendor:vendors(name, contact_person)
        `)
        ?.filter('quantity_in_stock', 'lte', 'minimum_stock_level')
        ?.eq('is_active', true)
        ?.order('quantity_in_stock');

      if (error) throw error;
      return products || [];
    } catch (error) {
      console.error('Error fetching low stock products:', error);
      throw error;
    }
  }

  // Bulk update products
  async bulkUpdateProducts(productIds, updates) {
    try {
      await logger?.info(
        'product_bulk_update_initiated',
        ENTITY_TYPES?.PRODUCT,
        'bulk',
        `Initiating bulk update for ${productIds?.length} products`,
        { productIds, updates }
      );

      const { data: updatedProducts, error } = await supabase
        ?.from('products')
        ?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })
        ?.in('id', productIds)
        ?.select();

      if (error) throw error;

      await logger?.success(
        'product_bulk_updated',
        ENTITY_TYPES?.PRODUCT,
        'bulk',
        `Successfully updated ${updatedProducts?.length} products`,
        {
          productIds,
          updates,
          updatedCount: updatedProducts?.length
        }
      );

      return updatedProducts;
    } catch (error) {
      await logger?.error(
        'product_bulk_update_failed',
        ENTITY_TYPES?.PRODUCT,
        'bulk',
        `Failed to bulk update products: ${error?.message}`,
        {
          error: error?.message,
          productIds,
          updates
        }
      );
      
      console.error('Error bulk updating products:', error);
      throw error;
    }
  }
}

// Export singleton instance
const productService = new ProductService();
export default productService;