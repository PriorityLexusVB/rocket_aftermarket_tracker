// /api/health/performance (server route)
// Performance health check endpoint to verify indexes and query performance
import { supabase } from '@/lib/supabase'

export default async function handler(req, res) {
  const timestamp = new Date().toISOString()

  try {
    const healthReport = {
      timestamp,
      database: {
        reachable: false,
        indexes: {},
        extensions: {},
        statistics: {},
      },
      checks: [],
      recommendations: [],
    }

    // Check 1: Verify pg_trgm extension is enabled
    const { data: extensionData, error: extensionError } = await supabase.rpc('pg_available_extensions')
      .catch(() => ({ data: null, error: { message: 'Unable to query extensions' } }))
    
    if (!extensionError && extensionData) {
      healthReport.database.reachable = true
      const pgTrgm = extensionData.find((ext) => ext.name === 'pg_trgm')
      healthReport.database.extensions.pg_trgm = {
        installed: !!pgTrgm?.installed_version,
        version: pgTrgm?.installed_version || null,
      }
      healthReport.checks.push({
        name: 'pg_trgm_extension',
        status: pgTrgm?.installed_version ? 'ok' : 'warning',
        message: pgTrgm?.installed_version 
          ? 'Trigram extension enabled for ILIKE optimization'
          : 'pg_trgm extension not found - ILIKE searches may be slow',
      })
    }

    // Check 2: Verify key indexes exist via pg_indexes
    const expectedIndexes = [
      { table: 'jobs', name: 'idx_jobs_title_trgm', type: 'trigram' },
      { table: 'jobs', name: 'idx_jobs_job_number_trgm', type: 'trigram' },
      { table: 'jobs', name: 'idx_jobs_status_created', type: 'composite' },
      { table: 'jobs', name: 'idx_jobs_org_id', type: 'standard' },
      { table: 'job_parts', name: 'idx_job_parts_vendor_id', type: 'foreign_key' },
      { table: 'job_parts', name: 'idx_job_parts_job_id', type: 'foreign_key' },
      { table: 'job_parts', name: 'idx_job_parts_promised_sched', type: 'composite' },
      { table: 'vendors', name: 'idx_vendors_name_trgm', type: 'trigram' },
      { table: 'vehicles', name: 'idx_vehicles_make_trgm', type: 'trigram' },
      { table: 'vehicles', name: 'idx_vehicles_model_trgm', type: 'trigram' },
      { table: 'vehicles', name: 'idx_vehicles_vin_trgm', type: 'trigram' },
    ]

    const { data: indexData } = await supabase
      .rpc('pg_indexes')
      .then((result) => result)
      .catch(() => ({ data: null }))

    if (indexData) {
      const indexSet = new Set(indexData.map((idx) => idx.indexname))
      expectedIndexes.forEach((expectedIdx) => {
        const exists = indexSet.has(expectedIdx.name)
        healthReport.database.indexes[expectedIdx.name] = {
          exists,
          table: expectedIdx.table,
          type: expectedIdx.type,
        }
        healthReport.checks.push({
          name: `index_${expectedIdx.name}`,
          status: exists ? 'ok' : 'warning',
          message: exists
            ? `Index ${expectedIdx.name} exists on ${expectedIdx.table}`
            : `Index ${expectedIdx.name} missing on ${expectedIdx.table}`,
        })
        
        if (!exists) {
          healthReport.recommendations.push({
            priority: expectedIdx.type === 'trigram' ? 'high' : 'medium',
            action: `Create ${expectedIdx.type} index ${expectedIdx.name} on table ${expectedIdx.table}`,
            impact: 'Improved query performance for searches and joins',
          })
        }
      })
    }

    // Check 3: Verify materialized view (optional)
    const { data: mvData } = await supabase
      .rpc('pg_matviews')
      .then((result) => result)
      .catch(() => ({ data: null }))

    if (mvData) {
      const overdueJobsMV = mvData.find((mv) => mv.matviewname === 'mv_overdue_jobs')
      healthReport.database.materialized_views = {
        mv_overdue_jobs: {
          exists: !!overdueJobsMV,
          populated: overdueJobsMV?.ispopulated || false,
        },
      }
      healthReport.checks.push({
        name: 'materialized_view_overdue_jobs',
        status: overdueJobsMV ? 'ok' : 'info',
        message: overdueJobsMV
          ? 'Overdue jobs materialized view exists (optional optimization)'
          : 'Overdue jobs materialized view not created (optional - only needed if RPC is slow)',
      })
    }

    // Check 4: Query table statistics
    const { data: statsData } = await supabase
      .from('pg_stat_user_tables')
      .select('schemaname,relname,n_live_tup,last_analyze,last_autoanalyze')
      .eq('schemaname', 'public')
      .in('relname', ['jobs', 'job_parts', 'vendors', 'vehicles'])
      .then((result) => result)
      .catch(() => ({ data: null }))

    if (statsData) {
      healthReport.database.statistics = statsData.reduce((acc, stat) => {
        acc[stat.relname] = {
          row_count: stat.n_live_tup,
          last_analyzed: stat.last_analyze || stat.last_autoanalyze,
        }
        return acc
      }, {})
    }

    // Generate overall status
    const hasWarnings = healthReport.checks.some((check) => check.status === 'warning')
    const hasErrors = healthReport.checks.some((check) => check.status === 'error')
    
    healthReport.status = hasErrors ? 'error' : hasWarnings ? 'warning' : 'healthy'
    healthReport.summary = {
      total_checks: healthReport.checks.length,
      passed: healthReport.checks.filter((c) => c.status === 'ok').length,
      warnings: healthReport.checks.filter((c) => c.status === 'warning').length,
      errors: healthReport.checks.filter((c) => c.status === 'error').length,
    }

    return res.status(200).json(healthReport)
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      error: error?.message || 'Unexpected error during performance health check',
      timestamp,
    })
  }
}
