import { supabase } from '@/lib/supabase'
import { safeSelect } from '@/lib/supabase/safeSelect'

async function getDealerId(label = 'opportunities:getDealerId') {
  const res = await supabase.rpc('auth_dealer_id')
  if (res?.error) {
    throw new Error(res.error.message || 'Failed to resolve dealer_id')
  }
  const dealerId = res?.data ?? null
  if (!dealerId) {
    throw new Error(`[${label}] Missing dealer_id (auth_dealer_id() returned null)`)
  }
  return dealerId
}

async function getUserId() {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id ?? null
  } catch {
    return null
  }
}

export async function listByJobId(jobId) {
  if (!jobId) return []
  const q = supabase
    .from('deal_opportunities')
    .select('*')
    .eq('job_id', jobId)
    .order('created_at', { ascending: true })

  return (await safeSelect(q, 'deal_opportunities:listByJobId')) || []
}

export async function createOpportunity(payload) {
  if (!payload?.job_id) throw new Error('job_id is required')
  if (!payload?.name) throw new Error('name is required')

  const dealerId = await getDealerId('deal_opportunities:create')
  const userId = await getUserId()

  const row = {
    dealer_id: dealerId,
    job_id: payload.job_id,
    product_id: payload.product_id || null,
    name: String(payload.name || '').trim(),
    quantity: Number.isFinite(Number(payload.quantity)) ? Number(payload.quantity) : 1,
    unit_price:
      payload.unit_price === '' || payload.unit_price === undefined || payload.unit_price === null
        ? null
        : Number(payload.unit_price),
    status: payload.status || 'open',
    decline_reason: payload.decline_reason || null,
    created_by: userId,
  }

  const { data, error } = await supabase
    .from('deal_opportunities')
    .insert([row])
    .select('*')
    .single()
  if (error) throw new Error(error.message || 'Failed to create opportunity')
  return data
}

export async function updateOpportunity(id, patch) {
  if (!id) throw new Error('id is required')
  const updates = { ...patch }
  delete updates.id
  delete updates.dealer_id
  delete updates.job_id

  const { data, error } = await supabase
    .from('deal_opportunities')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) throw new Error(error.message || 'Failed to update opportunity')
  return data
}

export async function deleteOpportunity(id) {
  if (!id) throw new Error('id is required')
  const { error } = await supabase.from('deal_opportunities').delete().eq('id', id)
  if (error) throw new Error(error.message || 'Failed to delete opportunity')
  return true
}

export async function getOpenOpportunitySummary() {
  const q = supabase
    .from('deal_opportunities')
    .select('job_id, quantity, unit_price')
    .eq('status', 'open')

  const rows = (await safeSelect(q, 'deal_opportunities:openSummary')) || []

  const openCount = rows.length
  const dealIds = new Set()
  let openAmount = 0

  for (const r of rows) {
    if (r?.job_id) dealIds.add(r.job_id)
    const qty = Number.isFinite(Number(r?.quantity)) ? Number(r.quantity) : 0
    const unit = Number.isFinite(Number(r?.unit_price)) ? Number(r.unit_price) : 0
    openAmount += qty * unit
  }

  return {
    open_count: openCount,
    open_deals_count: dealIds.size,
    open_amount: openAmount,
  }
}

/**
 * Bulk-fetch open opportunity counts for multiple job IDs in a single query.
 * Replaces the N+1 loop in the dashboard where one query fired per job.
 *
 * @param {string[]} jobIds
 * @returns {Promise<Record<string, number>>} map of job_id → open count (0 if absent)
 */
export async function listOpenCountsByJobIds(jobIds) {
  if (!Array.isArray(jobIds) || jobIds.length === 0) return {}
  const { data, error } = await supabase
    .from('deal_opportunities')
    .select('job_id, status')
    .in('job_id', jobIds)
    .eq('status', 'open')
  if (error) {
    console.warn('[opportunities] listOpenCountsByJobIds failed:', error)
    return {}
  }
  const counts = {}
  for (const row of (data || [])) {
    if (!row?.job_id) continue
    counts[row.job_id] = (counts[row.job_id] || 0) + 1
  }
  return counts
}

export const opportunitiesService = {
  listByJobId,
  listOpenCountsByJobIds,
  createOpportunity,
  updateOpportunity,
  deleteOpportunity,
  getOpenOpportunitySummary,
}

export default opportunitiesService
