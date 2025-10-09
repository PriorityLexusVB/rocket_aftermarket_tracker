import { supabase } from '../lib/supabase';

class AnalyticsService {
  
  // Get products sold by vehicle type (new vs used)
  async getProductsByVehicleType() {
    try {
      const { data, error } = await supabase?.from('job_parts')?.select(`
          quantity_used,
          total_price,
          products!inner(name, category, brand),
          jobs!inner(
            vehicle_id,
            vehicles!inner(year, make, model, vehicle_status)
          )
        `)?.not('products', 'is', null)?.not('jobs', 'is', null)?.not('jobs.vehicles', 'is', null);

      if (error) {
        console.error('Error fetching products by vehicle type:', error);
        return { new: [], used: [] };
      }

      const currentYear = new Date()?.getFullYear();
      const categorizedData = { new: [], used: [] };

      data?.forEach(item => {
        const vehicleYear = item?.jobs?.vehicles?.year;
        const isNew = vehicleYear >= (currentYear - 3); // Consider vehicles 3 years old or newer as "new"
        const category = isNew ? 'new' : 'used';

        categorizedData?.[category]?.push({
          product_name: item?.products?.name,
          product_category: item?.products?.category,
          product_brand: item?.products?.brand,
          quantity_used: item?.quantity_used,
          total_price: parseFloat(item?.total_price) || 0,
          vehicle_make: item?.jobs?.vehicles?.make,
          vehicle_model: item?.jobs?.vehicles?.model,
          vehicle_year: vehicleYear,
          vehicle_status: item?.jobs?.vehicles?.vehicle_status
        });
      });

      return categorizedData;
    } catch (error) {
      console.error('Service error fetching products by vehicle type:', error);
      return { new: [], used: [] };
    }
  }

  // Get products sold by vehicle model
  async getProductsByVehicleModel() {
    try {
      const { data, error } = await supabase?.from('job_parts')?.select(`
          quantity_used,
          total_price,
          unit_price,
          products!inner(name, category, brand),
          jobs!inner(
            vehicle_id,
            vehicles!inner(make, model, year, vehicle_status)
          )
        `)?.not('products', 'is', null)?.not('jobs', 'is', null)?.not('jobs.vehicles', 'is', null);

      if (error) {
        console.error('Error fetching products by vehicle model:', error);
        return [];
      }

      // Group by vehicle make/model combination
      const modelGroups = {};

      data?.forEach(item => {
        const vehicle = item?.jobs?.vehicles;
        const modelKey = `${vehicle?.make} ${vehicle?.model}`;
        
        if (!modelGroups?.[modelKey]) {
          modelGroups[modelKey] = {
            make: vehicle?.make,
            model: vehicle?.model,
            year_range: { min: vehicle?.year, max: vehicle?.year },
            products_sold: [],
            total_revenue: 0,
            total_quantity: 0
          };
        }

        // Update year range
        modelGroups[modelKey].year_range.min = Math.min(modelGroups?.[modelKey]?.year_range?.min, vehicle?.year);
        modelGroups[modelKey].year_range.max = Math.max(modelGroups?.[modelKey]?.year_range?.max, vehicle?.year);

        // Add product data
        modelGroups?.[modelKey]?.products_sold?.push({
          product_name: item?.products?.name,
          category: item?.products?.category,
          brand: item?.products?.brand,
          quantity: item?.quantity_used,
          price: parseFloat(item?.total_price) || 0
        });

        modelGroups[modelKey].total_revenue += parseFloat(item?.total_price) || 0;
        modelGroups[modelKey].total_quantity += item?.quantity_used || 0;
      });

      return Object.values(modelGroups);
    } catch (error) {
      console.error('Service error fetching products by vehicle model:', error);
      return [];
    }
  }

  // Get average products per deal
  async getProductsPerDealAnalysis() {
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          id,
          job_number,
          title,
          created_at,
          job_parts!inner(
            quantity_used,
            total_price,
            products!inner(name, category)
          ),
          transactions(
            total_amount,
            transaction_status
          ),
          vehicles!inner(make, model, year)
        `)?.not('job_parts', 'is', null);

      if (error) {
        console.error('Error fetching products per deal analysis:', error);
        return { averages: {}, deals: [] };
      }

      const dealAnalysis = [];
      let totalProducts = 0;
      let totalRevenue = 0;
      let dealCount = data?.length || 0;

      data?.forEach(job => {
        const productsInDeal = job?.job_parts?.length || 0;
        const dealRevenue = job?.job_parts?.reduce((sum, part) => 
          sum + (parseFloat(part?.total_price) || 0), 0);

        totalProducts += productsInDeal;
        totalRevenue += dealRevenue;

        dealAnalysis?.push({
          job_id: job?.id,
          job_number: job?.job_number,
          job_title: job?.title,
          created_at: job?.created_at,
          products_count: productsInDeal,
          products_revenue: dealRevenue,
          vehicle_info: `${job?.vehicles?.year} ${job?.vehicles?.make} ${job?.vehicles?.model}`,
          transaction_total: job?.transactions?.[0]?.total_amount || 0,
          products: job?.job_parts?.map(part => ({
            name: part?.products?.name,
            category: part?.products?.category,
            quantity: part?.quantity_used,
            price: parseFloat(part?.total_price) || 0
          }))
        });
      });

      const averages = {
        products_per_deal: dealCount > 0 ? (totalProducts / dealCount)?.toFixed(2) : 0,
        revenue_per_deal: dealCount > 0 ? (totalRevenue / dealCount)?.toFixed(2) : 0,
        total_deals: dealCount,
        total_products_sold: totalProducts,
        total_revenue: totalRevenue?.toFixed(2)
      };

      return { averages, deals: dealAnalysis };
    } catch (error) {
      console.error('Service error fetching products per deal analysis:', error);
      return { averages: {}, deals: [] };
    }
  }

  // Get vendor performance totals
  async getVendorPerformanceData() {
    try {
      const { data, error } = await supabase?.from('vendors')?.select(`
          id,
          name,
          specialty,
          rating,
          is_active,
          products(
            id,
            name,
            unit_price,
            cost,
            job_parts(
              quantity_used,
              total_price
            )
          ),
          jobs(
            id,
            job_status,
            created_at,
            completed_at,
            estimated_cost,
            actual_cost
          )
        `)?.eq('is_active', true);

      if (error) {
        console.error('Error fetching vendor performance data:', error);
        return [];
      }

      const vendorAnalysis = data?.map(vendor => {
        const products = vendor?.products || [];
        const jobs = vendor?.jobs || [];
        
        // Calculate product sales
        const totalProductsSold = products?.reduce((sum, product) => {
          const partsUsed = product?.job_parts?.reduce((partSum, part) => 
            partSum + (part?.quantity_used || 0), 0) || 0;
          return sum + partsUsed;
        }, 0);

        const totalProductRevenue = products?.reduce((sum, product) => {
          const partRevenue = product?.job_parts?.reduce((partSum, part) => 
            partSum + (parseFloat(part?.total_price) || 0), 0) || 0;
          return sum + partRevenue;
        }, 0);

        // Calculate job performance
        const completedJobs = jobs?.filter(job => job?.job_status === 'completed');
        const completionRate = jobs?.length > 0 ? (completedJobs?.length / jobs?.length * 100)?.toFixed(1) : 0;
        
        const totalJobRevenue = jobs?.reduce((sum, job) => 
          sum + (parseFloat(job?.actual_cost) || parseFloat(job?.estimated_cost) || 0), 0);

        return {
          vendor_id: vendor?.id,
          vendor_name: vendor?.name,
          specialty: vendor?.specialty,
          rating: vendor?.rating,
          total_products_count: products?.length,
          total_products_sold: totalProductsSold,
          total_product_revenue: totalProductRevenue?.toFixed(2),
          total_jobs_count: jobs?.length,
          completed_jobs_count: completedJobs?.length,
          completion_rate: parseFloat(completionRate),
          total_job_revenue: totalJobRevenue?.toFixed(2),
          total_revenue: (totalProductRevenue + totalJobRevenue)?.toFixed(2),
          avg_job_value: jobs?.length > 0 ? (totalJobRevenue / jobs?.length)?.toFixed(2) : 0
        };
      });

      return vendorAnalysis;
    } catch (error) {
      console.error('Service error fetching vendor performance data:', error);
      return [];
    }
  }

  // Get product category analysis
  async getProductCategoryAnalysis() {
    try {
      const { data, error } = await supabase?.from('products')?.select(`
          id,
          name,
          category,
          brand,
          unit_price,
          cost,
          job_parts(
            quantity_used,
            total_price,
            created_at
          )
        `)?.eq('is_active', true);

      if (error) {
        console.error('Error fetching product category analysis:', error);
        return [];
      }

      // Group by category
      const categoryGroups = {};

      data?.forEach(product => {
        const category = product?.category || 'Uncategorized';
        
        if (!categoryGroups?.[category]) {
          categoryGroups[category] = {
            category,
            products_count: 0,
            total_quantity_sold: 0,
            total_revenue: 0,
            products: []
          };
        }

        categoryGroups[category].products_count++;
        
        const quantitySold = product?.job_parts?.reduce((sum, part) => 
          sum + (part?.quantity_used || 0), 0) || 0;
        
        const revenue = product?.job_parts?.reduce((sum, part) => 
          sum + (parseFloat(part?.total_price) || 0), 0) || 0;

        categoryGroups[category].total_quantity_sold += quantitySold;
        categoryGroups[category].total_revenue += revenue;
        
        categoryGroups?.[category]?.products?.push({
          name: product?.name,
          brand: product?.brand,
          unit_price: parseFloat(product?.unit_price) || 0,
          quantity_sold: quantitySold,
          revenue: revenue?.toFixed(2)
        });
      });

      return Object.values(categoryGroups)?.map(group => ({
        ...group,
        total_revenue: group?.total_revenue?.toFixed(2),
        avg_price_per_unit: group?.total_quantity_sold > 0 
          ? (group?.total_revenue / group?.total_quantity_sold)?.toFixed(2) 
          : 0
      }));
    } catch (error) {
      console.error('Service error fetching product category analysis:', error);
      return [];
    }
  }

  // Get time-based sales trends
  async getSalesTrends(timeframe = '6months') {
    try {
      let dateFilter;
      const now = new Date();
      
      switch (timeframe) {
        case '1month':
          dateFilter = new Date(now.getFullYear(), now.getMonth(), 1)?.toISOString();
          break;
        case '3months':
          dateFilter = new Date(now.getFullYear(), now.getMonth() - 2, 1)?.toISOString();
          break;
        case '6months':
          dateFilter = new Date(now.getFullYear(), now.getMonth() - 5, 1)?.toISOString();
          break;
        case '1year':
          dateFilter = new Date(now.getFullYear() - 1, now.getMonth(), 1)?.toISOString();
          break;
        default:
          dateFilter = new Date(now.getFullYear(), now.getMonth() - 5, 1)?.toISOString();
      }

      const { data, error } = await supabase?.from('job_parts')?.select(`
          quantity_used,
          total_price,
          created_at,
          products!inner(name, category),
          jobs!inner(
            created_at,
            vehicles!inner(make, model, year)
          )
        `)?.gte('created_at', dateFilter)?.not('products', 'is', null)?.not('jobs', 'is', null)?.order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching sales trends:', error);
        return [];
      }

      // Group by month
      const monthlyData = {};

      data?.forEach(item => {
        const date = new Date(item?.created_at);
        const monthKey = `${date?.getFullYear()}-${String(date?.getMonth() + 1)?.padStart(2, '0')}`;
        
        if (!monthlyData?.[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            month_name: date?.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
            total_quantity: 0,
            total_revenue: 0,
            products_sold: 0,
            categories: {}
          };
        }

        monthlyData[monthKey].total_quantity += item?.quantity_used || 0;
        monthlyData[monthKey].total_revenue += parseFloat(item?.total_price) || 0;
        monthlyData[monthKey].products_sold++;

        const category = item?.products?.category || 'Other';
        if (!monthlyData?.[monthKey]?.categories?.[category]) {
          monthlyData[monthKey].categories[category] = 0;
        }
        monthlyData[monthKey].categories[category] += parseFloat(item?.total_price) || 0;
      });

      return Object.values(monthlyData)?.map(month => ({
        ...month,
        total_revenue: month?.total_revenue?.toFixed(2),
        categories: Object.entries(month?.categories)?.map(([name, value]) => ({
          name,
          value: value?.toFixed(2)
        }))
      }));
    } catch (error) {
      console.error('Service error fetching sales trends:', error);
      return [];
    }
  }

  // Get comprehensive dashboard summary
  async getDashboardSummary() {
    try {
      const [
        vehicleTypeData,
        productsPerDeal,
        vendorData,
        categoryData,
        trendsData
      ] = await Promise.all([
        this.getProductsByVehicleType(),
        this.getProductsPerDealAnalysis(),
        this.getVendorPerformanceData(),
        this.getProductCategoryAnalysis(),
        this.getSalesTrends('6months')
      ]);

      return {
        vehicle_type_analysis: vehicleTypeData,
        products_per_deal: productsPerDeal,
        vendor_performance: vendorData,
        category_analysis: categoryData,
        sales_trends: trendsData,
        summary_stats: {
          total_deals: productsPerDeal?.averages?.total_deals || 0,
          total_products_sold: productsPerDeal?.averages?.total_products_sold || 0,
          total_revenue: productsPerDeal?.averages?.total_revenue || 0,
          active_vendors: vendorData?.length || 0,
          product_categories: categoryData?.length || 0
        }
      };
    } catch (error) {
      console.error('Service error fetching dashboard summary:', error);
      return {
        vehicle_type_analysis: { new: [], used: [] },
        products_per_deal: { averages: {}, deals: [] },
        vendor_performance: [],
        category_analysis: [],
        sales_trends: [],
        summary_stats: {}
      };
    }
  }
}

export default new AnalyticsService();