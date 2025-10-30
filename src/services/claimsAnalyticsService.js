import { supabase } from '@/lib/supabase'

class ClaimsAnalyticsService {
  // Add error handling method
  setError(message) {
    console.error('ClaimsAnalyticsService Error:', message)
  }

  // Get claims volume and resolution performance metrics
  async getClaimsOverviewMetrics(orgId) {
    try {
      let q = supabase?.from('jobs')?.select(`
          id,
          job_status,
          created_at,
          started_at,
          completed_at,
          estimated_cost,
          actual_cost,
          priority,
          title,
          service_type
        `)
      if (orgId) q = q?.eq('org_id', orgId)
      const { data } = await q?.throwOnError()

      if (!Array.isArray(data)) {
        this.setError('Failed to fetch claims overview metrics. Please try again.')
        return {}
      }

      const currentDate = new Date()
      const thirtyDaysAgo = new Date(currentDate.getTime() - 30 * 24 * 60 * 60 * 1000)
      const previousThirtyDays = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000)

      let totalClaims = data?.length || 0
      let completedClaims = 0
      let pendingClaims = 0
      let inProgressClaims = 0
      let totalCost = 0
      let totalEstimatedCost = 0
      let currentMonthClaims = 0
      let previousMonthClaims = 0
      let avgResolutionTime = 0
      let totalResolutionTime = 0
      let resolvedCount = 0

      data?.forEach((claim) => {
        const createdDate = new Date(claim?.created_at)

        // Status counts
        if (claim?.job_status === 'completed') {
          completedClaims++
          if (claim?.completed_at && claim?.started_at) {
            const resolutionTime = new Date(claim?.completed_at) - new Date(claim?.started_at)
            totalResolutionTime += resolutionTime
            resolvedCount++
          }
        } else if (claim?.job_status === 'pending' || claim?.job_status === 'scheduled') {
          pendingClaims++
        } else if (claim?.job_status === 'in_progress') {
          inProgressClaims++
        }

        // Cost calculations
        totalCost += parseFloat(claim?.actual_cost) || 0
        totalEstimatedCost += parseFloat(claim?.estimated_cost) || 0

        // Monthly comparison
        if (createdDate >= thirtyDaysAgo) {
          currentMonthClaims++
        } else if (createdDate >= previousThirtyDays && createdDate < thirtyDaysAgo) {
          previousMonthClaims++
        }
      })

      if (resolvedCount > 0) {
        avgResolutionTime = totalResolutionTime / resolvedCount / (1000 * 60 * 60 * 24) // Convert to days
      }

      const approvalRate = totalClaims > 0 ? ((completedClaims / totalClaims) * 100)?.toFixed(1) : 0
      const monthOverMonthChange =
        previousMonthClaims > 0
          ? (((currentMonthClaims - previousMonthClaims) / previousMonthClaims) * 100)?.toFixed(1)
          : currentMonthClaims > 0
            ? 100
            : 0

      return {
        total_claims: totalClaims,
        completed_claims: completedClaims,
        pending_claims: pendingClaims,
        in_progress_claims: inProgressClaims,
        approval_rate: parseFloat(approvalRate),
        avg_resolution_time: avgResolutionTime?.toFixed(1),
        total_financial_impact: totalCost?.toFixed(2),
        estimated_vs_actual_variance:
          totalEstimatedCost > 0
            ? (((totalCost - totalEstimatedCost) / totalEstimatedCost) * 100)?.toFixed(1)
            : 0,
        current_month_claims: currentMonthClaims,
        previous_month_claims: previousMonthClaims,
        month_over_month_change: parseFloat(monthOverMonthChange),
      }
    } catch (error) {
      this.setError('Unable to load claims metrics. Please check your connection.')
      return {}
    }
  }

  // Get claims distribution by product type
  async getClaimsByProductType(orgId) {
    try {
      let q = supabase
        ?.from('job_parts')
        ?.select(
          `
          quantity_used,
          total_price,
          products!inner(name, category, brand),
          jobs!inner(job_status, created_at, completed_at, priority)
        `
        )
        ?.not('products', 'is', null)
        ?.not('jobs', 'is', null)
      if (orgId) q = q?.eq('jobs.org_id', orgId)
      const { data } = await q?.throwOnError()

      if (!Array.isArray(data)) {
        this.setError('Failed to load product claims distribution.')
        return []
      }

      const categoryGroups = {}

      data?.forEach((item) => {
        const category = item?.products?.category || 'Uncategorized'
        const jobStatus = item?.jobs?.job_status

        if (!categoryGroups?.[category]) {
          categoryGroups[category] = {
            category,
            total_claims: 0,
            completed_claims: 0,
            pending_claims: 0,
            in_progress_claims: 0,
            total_cost: 0,
            avg_resolution_time: 0,
            resolution_times: [],
            products: {},
          }
        }

        categoryGroups[category].total_claims++
        categoryGroups[category].total_cost += parseFloat(item?.total_price) || 0

        if (jobStatus === 'completed') {
          categoryGroups[category].completed_claims++
          if (item?.jobs?.completed_at && item?.jobs?.created_at) {
            const resolutionTime =
              (new Date(item?.jobs?.completed_at) - new Date(item?.jobs?.created_at)) /
              (1000 * 60 * 60 * 24)
            categoryGroups?.[category]?.resolution_times?.push(resolutionTime)
          }
        } else if (jobStatus === 'pending' || jobStatus === 'scheduled') {
          categoryGroups[category].pending_claims++
        } else if (jobStatus === 'in_progress') {
          categoryGroups[category].in_progress_claims++
        }

        // Track individual products
        const productName = item?.products?.name
        if (!categoryGroups?.[category]?.products?.[productName]) {
          categoryGroups[category].products[productName] = 0
        }
        categoryGroups[category].products[productName]++
      })

      return Object.values(categoryGroups)
        ?.map((group) => {
          const avgResolution =
            group?.resolution_times?.length > 0
              ? group?.resolution_times?.reduce((sum, time) => sum + time, 0) /
                group?.resolution_times?.length
              : 0

          return {
            ...group,
            total_cost: group?.total_cost?.toFixed(2),
            completion_rate:
              group?.total_claims > 0
                ? ((group?.completed_claims / group?.total_claims) * 100)?.toFixed(1)
                : 0,
            avg_resolution_time: avgResolution?.toFixed(1),
            top_products: Object.entries(group?.products || {})
              ?.sort(([, a], [, b]) => b - a)
              ?.slice(0, 3)
              ?.map(([name, count]) => ({ name, claim_count: count })),
          }
        })
        ?.sort((a, b) => b?.total_claims - a?.total_claims)
    } catch (error) {
      this.setError('Error loading product claims data.')
      return []
    }
  }

  // Get claims resolution time trends
  async getResolutionTimeTrends(timeframe = '6months', orgId) {
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
        ?.from('jobs')
        ?.select(
          `
          id,
          created_at,
          started_at,
          completed_at,
          job_status,
          actual_cost,
          priority
        `
        )
        ?.gte('created_at', dateFilter)
        ?.order('created_at', { ascending: true })
      if (orgId) q = q?.eq('org_id', orgId)
      const { data } = await q?.throwOnError()

      if (!Array.isArray(data)) {
        this.setError('Unable to load resolution time trends.')
        return []
      }

      const monthlyData = {}

      data?.forEach((job) => {
        const createdDate = new Date(job?.created_at)
        const monthKey = `${createdDate?.getFullYear()}-${String(createdDate?.getMonth() + 1)?.padStart(2, '0')}`

        if (!monthlyData?.[monthKey]) {
          monthlyData[monthKey] = {
            month: monthKey,
            month_name: createdDate?.toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
            }),
            total_claims: 0,
            completed_claims: 0,
            avg_resolution_time: 0,
            resolution_times: [],
            total_cost: 0,
            pending_claims: 0,
            priority_distribution: { low: 0, medium: 0, high: 0, urgent: 0 },
          }
        }

        monthlyData[monthKey].total_claims++
        monthlyData[monthKey].total_cost += parseFloat(job?.actual_cost) || 0

        if (job?.priority) {
          monthlyData[monthKey].priority_distribution[job?.priority]++
        }

        if (job?.job_status === 'completed' && job?.completed_at && job?.started_at) {
          const resolutionTime =
            (new Date(job?.completed_at) - new Date(job?.started_at)) / (1000 * 60 * 60 * 24)
          monthlyData?.[monthKey]?.resolution_times?.push(resolutionTime)
          monthlyData[monthKey].completed_claims++
        } else if (job?.job_status === 'pending' || job?.job_status === 'scheduled') {
          monthlyData[monthKey].pending_claims++
        }
      })

      return Object.values(monthlyData)?.map((month) => ({
        ...month,
        avg_resolution_time:
          month?.resolution_times?.length > 0
            ? (
                month?.resolution_times?.reduce((sum, time) => sum + time, 0) /
                month?.resolution_times?.length
              )?.toFixed(1)
            : 0,
        completion_rate:
          month?.total_claims > 0
            ? ((month?.completed_claims / month?.total_claims) * 100)?.toFixed(1)
            : 0,
        total_cost: month?.total_cost?.toFixed(2),
      }))
    } catch (error) {
      this.setError('Failed to load trend data.')
      return []
    }
  }

  // Get vendor claim performance analysis
  async getVendorClaimsAnalysis(orgId) {
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
          jobs(
            id,
            job_status,
            created_at,
            started_at,
            completed_at,
            actual_cost,
            estimated_cost,
            priority
          )
        `
        )
        ?.eq('is_active', true)
      // Scope via joined jobs when vendors.org_id is not guaranteed
      if (orgId) q = q?.eq('jobs.org_id', orgId)
      const { data } = await q?.throwOnError()

      if (!Array.isArray(data)) {
        this.setError('Failed to load vendor performance data.')
        return []
      }

      const vendorAnalysis = data
        ?.map((vendor) => {
          const jobs = vendor?.jobs || []
          const completedJobs = jobs?.filter((job) => job?.job_status === 'completed')
          const pendingJobs = jobs?.filter(
            (job) => job?.job_status === 'pending' || job?.job_status === 'scheduled'
          )
          const inProgressJobs = jobs?.filter((job) => job?.job_status === 'in_progress')

          let totalResolutionTime = 0
          let resolvedCount = 0
          let totalCost = 0
          let totalEstimatedCost = 0

          completedJobs?.forEach((job) => {
            if (job?.completed_at && job?.started_at) {
              const resolutionTime = new Date(job?.completed_at) - new Date(job?.started_at)
              totalResolutionTime += resolutionTime
              resolvedCount++
            }
            totalCost += parseFloat(job?.actual_cost) || 0
            totalEstimatedCost += parseFloat(job?.estimated_cost) || 0
          })

          let avgResolutionTime =
            resolvedCount > 0 ? totalResolutionTime / resolvedCount / (1000 * 60 * 60 * 24) : 0

          const completionRate = jobs?.length > 0 ? (completedJobs?.length / jobs?.length) * 100 : 0
          const costVariance =
            totalEstimatedCost > 0
              ? ((totalCost - totalEstimatedCost) / totalEstimatedCost) * 100
              : 0

          return {
            vendor_id: vendor?.id,
            vendor_name: vendor?.name,
            specialty: vendor?.specialty || 'General',
            vendor_rating: vendor?.rating || 0,
            total_claims: jobs?.length,
            completed_claims: completedJobs?.length,
            pending_claims: pendingJobs?.length,
            in_progress_claims: inProgressJobs?.length,
            completion_rate: completionRate?.toFixed(1),
            avg_resolution_time: avgResolutionTime?.toFixed(1),
            total_claim_cost: totalCost?.toFixed(2),
            cost_variance_percentage: costVariance?.toFixed(1),
            efficiency_score: this.calculateEfficiencyScore(
              completionRate,
              avgResolutionTime,
              costVariance
            ),
          }
        })
        ?.sort((a, b) => b?.efficiency_score - a?.efficiency_score)

      return vendorAnalysis
    } catch (error) {
      this.setError('Error loading vendor claims analysis.')
      return []
    }
  }

  // Calculate vendor efficiency score
  calculateEfficiencyScore(completionRate, avgResolutionTime, costVariance) {
    const completionScore = Math.min(completionRate, 100)
    const timeScore = avgResolutionTime > 0 ? Math.max(0, 100 - avgResolutionTime * 2) : 50
    const costScore = Math.max(0, 100 - Math.abs(costVariance))

    return (completionScore * 0.4 + timeScore * 0.4 + costScore * 0.2)?.toFixed(1)
  }

  // Get seasonal claim patterns
  async getSeasonalClaimPatterns(orgId) {
    try {
      let q = supabase
        ?.from('jobs')
        ?.select(
          `
          created_at,
          job_status,
          actual_cost,
          job_parts!inner(
            products!inner(category)
          )
        `
        )
        ?.not('job_parts.products', 'is', null)
      if (orgId) q = q?.eq('org_id', orgId)
      const { data } = await q?.throwOnError()

      if (!Array.isArray(data)) {
        this.setError('Failed to load seasonal patterns.')
        return { monthly: [], seasonal: [] }
      }

      const monthlyPatterns = {}
      const seasonalPatterns = { Winter: 0, Spring: 0, Summer: 0, Fall: 0 }

      data?.forEach((job) => {
        const date = new Date(job?.created_at)
        const month = date?.getMonth() + 1
        const monthName = date?.toLocaleDateString('en-US', { month: 'long' })

        if (!monthlyPatterns?.[month]) {
          monthlyPatterns[month] = {
            month: month,
            month_name: monthName,
            claim_count: 0,
            total_cost: 0,
            categories: {},
          }
        }

        monthlyPatterns[month].claim_count++
        monthlyPatterns[month].total_cost += parseFloat(job?.actual_cost) || 0

        // Track categories
        job?.job_parts?.forEach((part) => {
          const category = part?.products?.category || 'Other'
          if (!monthlyPatterns?.[month]?.categories?.[category]) {
            monthlyPatterns[month].categories[category] = 0
          }
          monthlyPatterns[month].categories[category]++
        })

        // Seasonal grouping
        if (month >= 12 || month <= 2) seasonalPatterns.Winter++
        else if (month >= 3 && month <= 5) seasonalPatterns.Spring++
        else if (month >= 6 && month <= 8) seasonalPatterns.Summer++
        else seasonalPatterns.Fall++
      })

      const monthly = Object.values(monthlyPatterns)
        ?.sort((a, b) => a?.month - b?.month)
        ?.map((month) => ({
          ...month,
          total_cost: month?.total_cost?.toFixed(2),
          top_categories: Object.entries(month?.categories || {})
            ?.sort(([, a], [, b]) => b - a)
            ?.slice(0, 3)
            ?.map(([name, count]) => ({ name, count })),
        }))

      const seasonal = Object.entries(seasonalPatterns)?.map(([season, count]) => ({
        season,
        claim_count: count,
        percentage: data?.length > 0 ? ((count / data?.length) * 100)?.toFixed(1) : 0,
      }))

      return { monthly, seasonal }
    } catch (error) {
      this.setError('Error loading seasonal patterns.')
      return { monthly: [], seasonal: [] }
    }
  }

  // Get financial impact analysis
  async getFinancialImpactAnalysis(orgId) {
    try {
      let q = supabase?.from('jobs')?.select(`
          id,
          estimated_cost,
          actual_cost,
          created_at,
          job_status,
          job_parts(
            total_price,
            products!inner(category, vendor_id)
          ),
          transactions(
            total_amount,
            transaction_status
          )
        `)
      if (orgId) q = q?.eq('org_id', orgId)
      const { data } = await q?.throwOnError()

      if (!Array.isArray(data)) {
        this.setError('Failed to load financial impact data.')
        return {}
      }

      let totalEstimated = 0
      let totalActual = 0
      let totalRecovered = 0
      let categoryBreakdown = {}
      let costOverruns = 0
      let costSavings = 0

      data?.forEach((job) => {
        const estimated = parseFloat(job?.estimated_cost) || 0
        const actual = parseFloat(job?.actual_cost) || 0
        const recovered = job?.transactions?.[0]?.total_amount
          ? parseFloat(job?.transactions?.[0]?.total_amount)
          : 0

        totalEstimated += estimated
        totalActual += actual
        totalRecovered += recovered

        if (actual > estimated) {
          costOverruns += actual - estimated
        } else {
          costSavings += estimated - actual
        }

        job?.job_parts?.forEach((part) => {
          const category = part?.products?.category || 'Other'
          if (!categoryBreakdown?.[category]) {
            categoryBreakdown[category] = {
              category,
              total_cost: 0,
              claim_count: 0,
              avg_cost: 0,
            }
          }
          categoryBreakdown[category].total_cost += parseFloat(part?.total_price) || 0
          categoryBreakdown[category].claim_count++
        })
      })

      // Calculate averages and percentages
      Object.values(categoryBreakdown)?.forEach((category) => {
        category.avg_cost =
          category?.claim_count > 0 ? (category?.total_cost / category?.claim_count)?.toFixed(2) : 0
        category.total_cost = category?.total_cost?.toFixed(2)
      })

      const netImpact = totalActual - totalRecovered
      const accuracyRate =
        totalEstimated > 0
          ? (100 - Math.abs(((totalActual - totalEstimated) / totalEstimated) * 100))?.toFixed(1)
          : 0

      return {
        total_estimated_cost: totalEstimated?.toFixed(2),
        total_actual_cost: totalActual?.toFixed(2),
        total_recovered: totalRecovered?.toFixed(2),
        net_financial_impact: netImpact?.toFixed(2),
        cost_accuracy_rate: parseFloat(accuracyRate),
        total_overruns: costOverruns?.toFixed(2),
        total_savings: costSavings?.toFixed(2),
        recovery_rate: totalActual > 0 ? ((totalRecovered / totalActual) * 100)?.toFixed(1) : 0,
        category_breakdown: Object.values(categoryBreakdown)?.sort(
          (a, b) => parseFloat(b?.total_cost) - parseFloat(a?.total_cost)
        ),
      }
    } catch (error) {
      this.setError('Error calculating financial impact.')
      return {}
    }
  }

  // Get comprehensive claims dashboard data
  async getClaimsDashboardSummary(orgId) {
    try {
      const [
        overviewMetrics,
        productTypeClaims,
        resolutionTrends,
        vendorAnalysis,
        seasonalPatterns,
        financialImpact,
      ] = await Promise.all([
        this.getClaimsOverviewMetrics(orgId),
        this.getClaimsByProductType(orgId),
        this.getResolutionTimeTrends('6months', orgId),
        this.getVendorClaimsAnalysis(orgId),
        this.getSeasonalClaimPatterns(orgId),
        this.getFinancialImpactAnalysis(orgId),
      ])

      return {
        overview_metrics: overviewMetrics,
        product_claims_distribution: productTypeClaims,
        resolution_trends: resolutionTrends,
        vendor_performance: vendorAnalysis,
        seasonal_patterns: seasonalPatterns,
        financial_impact: financialImpact,
        last_updated: new Date()?.toISOString(),
      }
    } catch (error) {
      this.setError('Unable to load complete dashboard data.')
      return {}
    }
  }
}

export default new ClaimsAnalyticsService()
