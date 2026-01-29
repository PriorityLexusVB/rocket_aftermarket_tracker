import { supabase } from '@/lib/supabase'
import { getAllDeals } from '@/services/dealService'
import { calculateDealKPIs } from '@/utils/dealKpis'

// Utility function to safely handle numeric values and prevent NaN
const safeNumber = (value, defaultValue = 0) => {
  if (value === null || value === undefined || value === '') return defaultValue
  const parsed = parseFloat(value)
  return isNaN(parsed) ? defaultValue : parsed
}

// Utility function to safely calculate percentages
const safePercentage = (numerator, denominator, defaultValue = 0) => {
  const num = safeNumber(numerator)
  const den = safeNumber(denominator)
  if (den === 0) return defaultValue
  const result = (num / den) * 100
  return isNaN(result) ? defaultValue : parseFloat(result?.toFixed(1))
}

// Utility function to safely calculate averages
const safeAverage = (total, count, defaultValue = 0) => {
  const totalNum = safeNumber(total)
  const countNum = safeNumber(count)
  if (countNum === 0) return defaultValue
  const result = totalNum / countNum
  return isNaN(result) ? defaultValue : parseFloat(result?.toFixed(2))
}

class AnalyticsService {
  // Get products sold by vehicle type (new vs used)
  async getProductsByVehicleType(orgId = null) {
    try {
      let q = supabase
        ?.from('job_parts')
        ?.select(
          `
          quantity_used,
          total_price,
          products!inner(name, category, brand),
          jobs!inner(
            vehicle_id,
            vehicles!inner(year, make, model, vehicle_status)
          )
        `
        )
        ?.not('products', 'is', null)
        ?.not('jobs', 'is', null)
        ?.not('jobs.vehicles', 'is', null)
      if (orgId) q = q?.eq('jobs.dealer_id', orgId)
      const { data } = await q.throwOnError()

      const currentYear = new Date()?.getFullYear()
      const categorizedData = { new: [], used: [] }

      data?.forEach((item) => {
        const vehicleYear = safeNumber(item?.jobs?.vehicles?.year, currentYear)
        const isNew = vehicleYear >= currentYear - 3 // Consider vehicles 3 years old or newer as "new"
        const category = isNew ? 'new' : 'used'

        categorizedData?.[category]?.push({
          product_name: item?.products?.name || 'Unknown Product',
          product_category: item?.products?.category || 'Uncategorized',
          product_brand: item?.products?.brand || 'Unknown Brand',
          quantity_used: safeNumber(item?.quantity_used),
          total_price: safeNumber(item?.total_price),
          vehicle_make: item?.jobs?.vehicles?.make || 'Unknown Make',
          vehicle_model: item?.jobs?.vehicles?.model || 'Unknown Model',
          vehicle_year: vehicleYear,
          vehicle_status: item?.jobs?.vehicles?.vehicle_status || 'unknown',
        })
      })

      return categorizedData
    } catch (error) {
      console.error('Service error fetching products by vehicle type:', error)
      return { new: [], used: [] }
    }
  }

  // Get products sold by vehicle model
  async getProductsByVehicleModel(orgId = null) {
    try {
      let q = supabase
        ?.from('job_parts')
        ?.select(
          `
          quantity_used,
          total_price,
          unit_price,
          products!inner(name, category, brand),
          jobs!inner(
            vehicle_id,
            vehicles!inner(make, model, year, vehicle_status)
          )
        `
        )
        ?.not('products', 'is', null)
        ?.not('jobs', 'is', null)
        ?.not('jobs.vehicles', 'is', null)
      if (orgId) q = q?.eq('jobs.dealer_id', orgId)
      const { data } = await q.throwOnError()

      // Group by vehicle make/model combination
      const modelGroups = {}

      data?.forEach((item) => {
        const vehicle = item?.jobs?.vehicles
        const make = vehicle?.make || 'Unknown Make'
        const model = vehicle?.model || 'Unknown Model'
        const year = safeNumber(vehicle?.year, new Date()?.getFullYear())
        const modelKey = `${make} ${model}`

        if (!modelGroups?.[modelKey]) {
          modelGroups[modelKey] = {
            make,
            model,
            year_range: { min: year, max: year },
            products_sold: [],
            total_revenue: 0,
            total_quantity: 0,
          }
        }

        // Update year range safely
        modelGroups[modelKey].year_range.min = Math.min(
          modelGroups?.[modelKey]?.year_range?.min || year,
          year
        )
        modelGroups[modelKey].year_range.max = Math.max(
          modelGroups?.[modelKey]?.year_range?.max || year,
          year
        )

        // Add product data with safe values
        const totalPrice = safeNumber(item?.total_price)
        const quantity = safeNumber(item?.quantity_used)

        modelGroups?.[modelKey]?.products_sold?.push({
          product_name: item?.products?.name || 'Unknown Product',
          category: item?.products?.category || 'Uncategorized',
          brand: item?.products?.brand || 'Unknown Brand',
          quantity,
          price: totalPrice,
        })

        modelGroups[modelKey].total_revenue += totalPrice
        modelGroups[modelKey].total_quantity += quantity
      })

      return Object.values(modelGroups)
    } catch (error) {
      console.error('Service error fetching products by vehicle model:', error)
      return []
    }
  }

  // Get average products per deal
  async getProductsPerDealAnalysis(orgId = null) {
    try {
      let q = supabase
        ?.from('jobs')
        ?.select(
          `
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
        `
        )
        ?.not('job_parts', 'is', null)
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data } = await q.throwOnError()

      const dealAnalysis = []
      let totalProducts = 0
      let totalRevenue = 0
      let dealCount = data?.length || 0

      data?.forEach((job) => {
        const productsInDeal = job?.job_parts?.length || 0
        const dealRevenue = job?.job_parts?.reduce(
          (sum, part) => sum + safeNumber(part?.total_price),
          0
        )

        totalProducts += productsInDeal
        totalRevenue += dealRevenue

        const vehicleYear = safeNumber(job?.vehicles?.year, new Date()?.getFullYear())
        const transactionAmount = safeNumber(job?.transactions?.[0]?.total_amount)

        dealAnalysis?.push({
          job_id: job?.id,
          job_number: job?.job_number || 'N/A',
          job_title: job?.title || 'Untitled Job',
          created_at: job?.created_at,
          products_count: productsInDeal,
          products_revenue: dealRevenue,
          vehicle_info: `${vehicleYear} ${job?.vehicles?.make || 'Unknown'} ${job?.vehicles?.model || 'Unknown'}`,
          transaction_total: transactionAmount,
          products:
            job?.job_parts?.map((part) => ({
              name: part?.products?.name || 'Unknown Product',
              category: part?.products?.category || 'Uncategorized',
              quantity: safeNumber(part?.quantity_used),
              price: safeNumber(part?.total_price),
            })) || [],
        })
      })

      const averages = {
        products_per_deal: safeAverage(totalProducts, dealCount),
        revenue_per_deal: safeAverage(totalRevenue, dealCount),
        total_deals: dealCount,
        total_products_sold: totalProducts,
        total_revenue: safeNumber(totalRevenue)?.toFixed(2),
      }

      return { averages, deals: dealAnalysis }
    } catch (error) {
      console.error('Service error fetching products per deal analysis:', error)
      return { averages: {}, deals: [] }
    }
  }

  // Get vendor performance totals
  async getVendorPerformanceData(orgId = null) {
    try {
      let q = supabase
        ?.from('vendors')
        ?.select(
          `
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
        `
        )
        ?.eq('is_active', true)
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data } = await q.throwOnError()

      const vendorAnalysis =
        data?.map((vendor) => {
          const products = vendor?.products || []
          const jobs = vendor?.jobs || []

          // Calculate product sales with safe numbers
          const totalProductsSold =
            products?.reduce((sum, product) => {
              const partsUsed =
                product?.job_parts?.reduce(
                  (partSum, part) => partSum + safeNumber(part?.quantity_used),
                  0
                ) || 0
              return sum + partsUsed
            }, 0) || 0

          const totalProductRevenue =
            products?.reduce((sum, product) => {
              const partRevenue =
                product?.job_parts?.reduce(
                  (partSum, part) => partSum + safeNumber(part?.total_price),
                  0
                ) || 0
              return sum + partRevenue
            }, 0) || 0

          // Calculate job performance safely
          const completedJobs = jobs?.filter((job) => job?.job_status === 'completed') || []
          const completionRate = safePercentage(completedJobs?.length, jobs?.length)

          const totalJobRevenue =
            jobs?.reduce(
              (sum, job) => sum + safeNumber(job?.actual_cost, job?.estimated_cost),
              0
            ) || 0

          return {
            vendor_id: vendor?.id,
            vendor_name: vendor?.name || 'Unknown Vendor',
            specialty: vendor?.specialty || 'General',
            rating: safeNumber(vendor?.rating),
            total_products_count: products?.length || 0,
            total_products_sold: totalProductsSold,
            total_product_revenue: safeNumber(totalProductRevenue)?.toFixed(2),
            total_jobs_count: jobs?.length || 0,
            completed_jobs_count: completedJobs?.length || 0,
            completion_rate: completionRate,
            total_job_revenue: safeNumber(totalJobRevenue)?.toFixed(2),
            total_revenue: safeNumber(totalProductRevenue + totalJobRevenue)?.toFixed(2),
            avg_job_value: safeAverage(totalJobRevenue, jobs?.length),
          }
        }) || []

      return vendorAnalysis
    } catch (error) {
      console.error('Service error fetching vendor performance data:', error)
      return []
    }
  }

  // Get product category analysis
  async getProductCategoryAnalysis(orgId = null) {
    try {
      let q = supabase
        ?.from('products')
        ?.select(
          `
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
        `
        )
        ?.eq('is_active', true)
      if (orgId) q = q?.eq('dealer_id', orgId)
      const { data } = await q.throwOnError()

      // Group by category
      const categoryGroups = {}

      data?.forEach((product) => {
        const category = product?.category || 'Uncategorized'

        if (!categoryGroups?.[category]) {
          categoryGroups[category] = {
            category,
            products_count: 0,
            total_quantity_sold: 0,
            total_revenue: 0,
            products: [],
          }
        }

        categoryGroups[category].products_count++

        const quantitySold =
          product?.job_parts?.reduce((sum, part) => sum + safeNumber(part?.quantity_used), 0) || 0

        const revenue =
          product?.job_parts?.reduce((sum, part) => sum + safeNumber(part?.total_price), 0) || 0

        categoryGroups[category].total_quantity_sold += quantitySold
        categoryGroups[category].total_revenue += revenue

        categoryGroups?.[category]?.products?.push({
          name: product?.name || 'Unknown Product',
          brand: product?.brand || 'Unknown Brand',
          unit_price: safeNumber(product?.unit_price),
          quantity_sold: quantitySold,
          revenue: safeNumber(revenue)?.toFixed(2),
        })
      })

      return (
        Object.values(categoryGroups)?.map((group) => ({
          ...group,
          total_revenue: safeNumber(group?.total_revenue)?.toFixed(2),
          avg_price_per_unit: safeAverage(group?.total_revenue, group?.total_quantity_sold),
        })) || []
      )
    } catch (error) {
      console.error('Service error fetching product category analysis:', error)
      return []
    }
  }

  // Get time-based sales trends
  async getSalesTrends(timeframe = '6months', orgId = null) {
    try {
      let dateFilter
      const now = new Date()

      switch (timeframe) {
        case '1month':
          dateFilter = new Date(now.getFullYear(), now.getMonth(), 1)?.toISOString()
          break
        case '3months':
          dateFilter = new Date(now.getFullYear(), now.getMonth() - 2, 1)?.toISOString()
          break
        case '6months':
          dateFilter = new Date(now.getFullYear(), now.getMonth() - 5, 1)?.toISOString()
          break
        case '1year':
          dateFilter = new Date(now.getFullYear() - 1, now.getMonth(), 1)?.toISOString()
          break
        default:
          dateFilter = new Date(now.getFullYear(), now.getMonth() - 5, 1)?.toISOString()
      }

      let q = supabase
        ?.from('job_parts')
        ?.select(
          `
          quantity_used,
          total_price,
          created_at,
          products!inner(name, category),
          jobs!inner(
            created_at,
            vehicles!inner(make, model, year)
          )
        `
        )
        ?.gte('created_at', dateFilter)
        ?.not('products', 'is', null)
        ?.not('jobs', 'is', null)
        ?.order('created_at', { ascending: true })
      if (orgId) q = q?.eq('jobs.dealer_id', orgId)
      const { data } = await q.throwOnError()

      // Group by month
      const monthlyData = {}

      data?.forEach((item) => {
        const date = new Date(item?.created_at)
        const monthKey = `${date?.getFullYear()}-${String(date?.getMonth() + 1)?.padStart(2, '0')}`

        if (!monthlyData?.[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            month_name: date?.toLocaleDateString('en-US', { year: 'numeric', month: 'long' }),
            total_quantity: 0,
            total_revenue: 0,
            products_sold: 0,
            categories: {},
          }
        }

        const quantity = safeNumber(item?.quantity_used)
        const price = safeNumber(item?.total_price)
        const category = item?.products?.category || 'Other'

        monthlyData[monthKey].total_quantity += quantity
        monthlyData[monthKey].total_revenue += price
        monthlyData[monthKey].products_sold++

        if (!monthlyData?.[monthKey]?.categories?.[category]) {
          monthlyData[monthKey].categories[category] = 0
        }
        monthlyData[monthKey].categories[category] += price
      })

      return (
        Object.values(monthlyData)?.map((month) => ({
          ...month,
          total_revenue: safeNumber(month?.total_revenue)?.toFixed(2),
          categories: Object.entries(month?.categories || {})?.map(([name, value]) => ({
            name,
            value: safeNumber(value)?.toFixed(2),
          })),
        })) || []
      )
    } catch (error) {
      console.error('Service error fetching sales trends:', error)
      return []
    }
  }

  // Get comprehensive dashboard summary
  async getDashboardSummary(orgId = null) {
    try {
      const [vehicleTypeData, productsPerDeal, vendorData, categoryData, trendsData, deals] =
        await Promise.all([
          this.getProductsByVehicleType(orgId),
          this.getProductsPerDealAnalysis(orgId),
          this.getVendorPerformanceData(orgId),
          this.getProductCategoryAnalysis(orgId),
          this.getSalesTrends('6months', orgId),
          // NOTE: `getAllDeals()` is already tenant-scoped via RLS/org context.
          // We call it here to keep high-level KPIs consistent with the Deals page.
          getAllDeals(),
        ])

      const dealKpis = calculateDealKPIs(deals)

      return {
        vehicle_type_analysis: vehicleTypeData,
        products_per_deal: productsPerDeal,
        vendor_performance: vendorData,
        category_analysis: categoryData,
        sales_trends: trendsData,
        deal_kpis: dealKpis,
        summary_stats: {
          // Deal-count and revenue should match Deals KPIs for identical data sets.
          total_deals: Array.isArray(deals)
            ? deals.length
            : safeNumber(productsPerDeal?.averages?.total_deals),
          total_products_sold: safeNumber(productsPerDeal?.averages?.total_products_sold),
          total_revenue: dealKpis?.revenue || '0.00',
          active_vendors: vendorData?.length || 0,
          product_categories: categoryData?.length || 0,
        },
      }
    } catch (error) {
      console.error('Service error fetching dashboard summary:', error)
      return {
        vehicle_type_analysis: { new: [], used: [] },
        products_per_deal: { averages: {}, deals: [] },
        vendor_performance: [],
        category_analysis: [],
        sales_trends: [],
        deal_kpis: calculateDealKPIs([]),
        summary_stats: {
          total_deals: 0,
          total_products_sold: 0,
          total_revenue: '0.00',
          active_vendors: 0,
          product_categories: 0,
        },
      }
    }
  }
}

export default new AnalyticsService()
