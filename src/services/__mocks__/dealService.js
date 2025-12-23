import { vi } from 'vitest'
import { supabase } from '../../lib/supabase'

// Helper: compute totals from line items
const computeTotal = (items = []) =>
  items.reduce((sum, it) => sum + Number(it?.unit_price || 0) * Number(it?.quantity_used || 0), 0)

// vi.fn so tests can override with mockResolvedValue, but provide sane defaults
export const getAllDeals = vi.fn().mockImplementation(async () => {
  // Provide a minimal default list so UI tests can render basic elements
  return [
    {
      id: 'test-job-001',
      job_number: 'JOB-001',
      job_status: 'in_progress',
      title: 'Sample Deal',
      customer_name: 'Alice Test',
      customer_phone: '555-0001',
      vendor_name: 'Elite Auto Repair',
      total_amount: 1299,
      work_tags: ['tint', 'detail'],
      vehicle: { year: 2022, make: 'Toyota', model: 'Camry', stock_number: 'STK123' },
      next_promised_iso: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
      appt_start: new Date().toISOString(),
      appt_end: new Date(Date.now() + 3600000).toISOString(),
      job_parts: [
        { is_off_site: true, requires_scheduling: true },
        { is_off_site: false, requires_scheduling: false },
      ],
    },
  ]
})

export const getDeal = vi.fn().mockImplementation(async (id) => {
  const { data: job } = await supabase?.from('jobs')?.select('*')?.eq('id', id)?.single()
  if (!job) return null
  const { data: parts } = await supabase?.from('job_parts')?.select('*')?.eq('job_id', id)
  return { ...job, job_parts: parts || [] }
})

export const createDeal = vi.fn().mockImplementation(async (payload) => {
  // Create a basic job record
  const id = `job-${Date.now()}`
  const baseJob = {
    id,
    title: payload?.title || payload?.description || 'Untitled',
    description: payload?.description || '',
    job_number: payload?.job_number || `JOB-${String(Math.floor(Math.random() * 900) + 100)}`,
    vendor_id: payload?.vendor_id || null,
    vehicle_id: payload?.vehicle_id || null,
    customer_needs_loaner: !!payload?.customer_needs_loaner,
    service_type: payload?.vendor_id ? 'vendor' : payload?.service_type || 'onsite',
    location: payload?.location || null,
    customer_name: payload?.customerName || null,
    customer_email: payload?.customerEmail || null,
    customer_phone: payload?.customerPhone || null,
    created_at: new Date().toISOString(),
    promised_date: null,
    // Calendar fields defaulted; set if off-site scheduled
    scheduled_start_time: null,
    scheduled_end_time: null,
    calendar_event_id: null,
    color_code: null,
    job_status: 'in_progress',
  }

  // Determine if any off-site scheduled items exist
  const items = Array.isArray(payload?.lineItems) ? payload.lineItems : []
  const firstOffsiteSched = items.find((it) => it?.isOffSite && it?.requiresScheduling)
  if (firstOffsiteSched && firstOffsiteSched?.lineItemPromisedDate) {
    const start = new Date(`${firstOffsiteSched.lineItemPromisedDate}T09:00:00Z`).toISOString()
    const end = new Date(`${firstOffsiteSched.lineItemPromisedDate}T11:00:00Z`).toISOString()
    baseJob.scheduled_start_time = start
    baseJob.scheduled_end_time = end
    baseJob.calendar_event_id = `deal_${id}`
    baseJob.color_code = '#3B82F6'
  }

  await supabase?.from('jobs')?.insert(baseJob)

  // Insert job_parts
  const partsToInsert = items.map((it, idx) => ({
    id: `jp-${Date.now()}-${idx}`,
    job_id: id,
    product_id: it?.product_id,
    unit_price: String(it?.unit_price ?? ''),
    quantity_used: Number(it?.quantity_used ?? 1),
    is_off_site: !!it?.isOffSite,
    requires_scheduling: !!it?.requiresScheduling,
    promised_date: it?.lineItemPromisedDate || null,
    no_schedule_reason: it?.noScheduleReason ?? null,
  }))
  if (partsToInsert?.length) {
    await supabase?.from('job_parts')?.insert(partsToInsert)
  }

  // Insert/Update transaction
  const total = computeTotal(partsToInsert)
  await supabase?.from('transactions')?.insert({
    job_id: id,
    total_amount: total,
    customer_name: baseJob.customer_name,
    customer_email: baseJob.customer_email,
    transaction_status: 'pending',
  })

  return getDeal.mock.results?.[0]?.value ?? (await getDeal(id))
})

export const updateDeal = vi.fn().mockImplementation(async (id, payload) => {
  // Update base job
  const jobChanges = {
    title: payload?.title || payload?.description || 'Untitled',
    description: payload?.description || '',
    customer_needs_loaner: !!payload?.customer_needs_loaner,
    customer_name: payload?.customerName || null,
    customer_email: payload?.customerEmail || null,
    customer_phone: payload?.customerPhone || null,
    updated_at: new Date().toISOString(),
  }
  await supabase?.from('jobs')?.update(jobChanges)?.eq('id', id)

  // Reset and re-insert job_parts
  await supabase?.from('job_parts')?.delete()?.eq('job_id', id)
  const items = Array.isArray(payload?.lineItems) ? payload.lineItems : []
  const partsToInsert = items.map((it, idx) => ({
    id: `jp-${Date.now()}-${idx}`,
    job_id: id,
    product_id: it?.product_id,
    unit_price: String(it?.unit_price ?? ''),
    quantity_used: Number(it?.quantity_used ?? 1),
    is_off_site: !!it?.isOffSite,
    requires_scheduling: !!it?.requiresScheduling,
    promised_date: it?.lineItemPromisedDate || null,
    no_schedule_reason: it?.noScheduleReason ?? null,
  }))
  if (partsToInsert?.length) {
    await supabase?.from('job_parts')?.insert(partsToInsert)
  }

  // Update transaction
  const total = computeTotal(partsToInsert)
  await supabase
    ?.from('transactions')
    ?.update({
      total_amount: total,
      customer_name: jobChanges.customer_name,
      customer_email: jobChanges.customer_email,
    })
    ?.eq('job_id', id)

  return await getDeal(id)
})

export const deleteDeal = vi.fn().mockImplementation(async (id) => {
  await supabase?.from('job_parts')?.delete()?.eq('job_id', id)
  await supabase?.from('transactions')?.delete()?.eq('job_id', id)
  await supabase?.from('jobs')?.delete()?.eq('id', id)
  return { success: true }
})

export const updateDealStatus = vi.fn().mockImplementation(async (id, status) => {
  await supabase?.from('jobs')?.update({ job_status: status })?.eq('id', id)
  return await getDeal(id)
})

export const markLoanerReturned = vi.fn().mockImplementation(async (loanerId) => {
  await supabase
    ?.from('loaner_assignments')
    ?.update({ returned_at: new Date().toISOString() })
    ?.eq('id', loanerId)
  return { success: true }
})

const dealService = {
  getAllDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStatus,
  markLoanerReturned,
}

export default dealService
