// src/services/dealService.js
import { supabase } from '../lib/supabase';

// --- helpers -------------------------------------------------------------

// Only pass columns we're confident exist on your `jobs` table.
// Add more keys here if you confirm additional columns.
const JOB_COLS = [
  'job_number',
  'title',
  'description',
  'vehicle_id',
  'vendor_id',
  'job_status',
  'priority',
  'location',
  'scheduled_start_time',
  'scheduled_end_time',
  'estimated_hours',
  'estimated_cost',
  'actual_cost',
  'customer_needs_loaner', // ✅ FIXED: Changed from loaner_required
  'service_type',
  'delivery_coordinator_id'
];

function pick(obj, keys) {
  const out = {};
  keys?.forEach(k => {
    if (obj?.[k] !== undefined) out[k] = obj?.[k];
  });
  return out;
}

function sanitizeDealPayload(input) {
  return pick(input || {}, JOB_COLS);
}

// Normalize line items to match `job_parts` columns we know are present.
// Updated to include new scheduling fields
function toJobPartRows(jobId, items = []) {
  return (
    // drop null-only rows
    ((items || [])?.map((it) => ({
        job_id: jobId,
        product_id: it?.product_id ?? null,
        quantity_used: it?.quantity_used ?? it?.quantity ?? 1,
        unit_price: it?.unit_price ?? it?.price ?? 0,
        line_total:
          it?.line_total ??
          (typeof it?.quantity_used === 'number' && typeof it?.unit_price === 'number'
            ? it?.quantity_used * it?.unit_price
            : null),
        // Add new per-line-item scheduling fields
        promised_date: it?.lineItemPromisedDate || null,
        requires_scheduling: !!it?.requiresScheduling,
        no_schedule_reason: it?.requiresScheduling ? null : (it?.noScheduleReason || null),
        is_off_site: !!it?.isOffSite
      }))?.filter((row) => row?.product_id !== null || row?.quantity_used || row?.unit_price || row?.line_total))
  );
}

// --- queries -------------------------------------------------------------

// Shared select list with lightweight nested relations.
// Updated to include new job_parts columns
const JOBS_SELECT = `
  id,
  job_number,
  title,
  description,
  job_status,
  priority,
  location,
  vehicle_id,
  vendor_id,
  scheduled_start_time,
  scheduled_end_time,
  estimated_hours,
  estimated_cost,
  actual_cost,
  customer_needs_loaner,
  service_type,
  delivery_coordinator_id,
  created_at,
  vehicle:vehicles(id, year, make, model, stock_number),
  vendor:vendors(id, name),
  job_parts(*, product:products(id, name))
`;

// READ: all deals (used by /deals list)
export async function getAllDeals() {
  const { data, error } = await supabase?.from('jobs')?.select(JOBS_SELECT)?.order('created_at', { ascending: false });

  if (error) throw new Error(`Failed to load deals: ${error.message}`);
  return data || [];
}

// READ: single deal by id (used by Edit)
export async function getDeal(id) {
  const { data, error } = await supabase?.from('jobs')?.select(JOBS_SELECT)?.eq('id', id)?.single();

  if (error) throw new Error(`Failed to load deal: ${error.message}`);
  return data;
}

// CREATE: deal + job_parts
export async function createDeal(formState) {
  const payload = sanitizeDealPayload(formState || {});
  const lineItems = Array.isArray(formState?.lineItems) ? formState?.lineItems : [];

  // 1) create job
  const { data: job, error: jobErr } = await supabase?.from('jobs')?.insert([payload])?.select('id')?.single();

  if (jobErr) throw new Error(`Failed to create deal: ${jobErr.message}`);

  // 2) insert parts (if any)
  if (lineItems?.length > 0) {
    const rows = toJobPartRows(job?.id, lineItems);
    if (rows?.length > 0) {
      const { error: partsErr } = await supabase?.from('job_parts')?.insert(rows);
      if (partsErr) {
        // rollback best-effort
        await supabase?.from('jobs')?.delete()?.eq('id', job?.id);
        throw new Error(`Failed to create line items: ${partsErr.message}`);
      }
    }
  }

  // 3) return full record (with joins)
  return await getDeal(job?.id);
}

// UPDATE: deal + replace job_parts - FIXED with proper transaction handling
export async function updateDeal(id, formState) {
  const payload = sanitizeDealPayload(formState || {});
  const lineItems = Array.isArray(formState?.lineItems) ? formState?.lineItems : [];

  // Calculate total deal value for transactions
  const totalDealValue = lineItems?.reduce((sum, item) => {
    const qty = Number(item?.quantity_used || item?.quantity || 1);
    const price = Number(item?.unit_price || item?.price || 0);
    return sum + (qty * price);
  }, 0) || 0;

  // Extract customer info from form state
  const customerName = formState?.customerName?.trim() || '';
  const customerPhone = formState?.customerPhone?.trim() || '';
  const customerEmail = formState?.customerEmail?.trim() || '';

  // 1) Update job
  const { error: jobErr } = await supabase?.from('jobs')?.update(payload)?.eq('id', id);
  if (jobErr) throw new Error(`Failed to update deal: ${jobErr.message}`);

  // 2) Enhanced transaction upsert with onConflict (Step 4B optimized)
  if (totalDealValue > 0 || customerName) {
    const transactionData = {
      job_id: id,
      vehicle_id: formState?.vehicle_id || null,
      total_amount: totalDealValue,
      customer_name: customerName || 'Unknown Customer',
      customer_phone: customerPhone || null,
      customer_email: customerEmail || null,
      transaction_status: 'pending'
    };

    const { error: txnErr } = await supabase
      ?.from('transactions')
      ?.upsert(transactionData, { onConflict: 'job_id' });
    
    if (txnErr) throw new Error(`Failed to upsert transaction: ${txnErr.message}`);
  }

  // 3) Replace job_parts with new scheduling fields
  // Delete existing
  const { error: delErr } = await supabase?.from('job_parts')?.delete()?.eq('job_id', id);
  if (delErr) throw new Error(`Failed to update line items: ${delErr.message}`);

  // Insert new (if any)
  if (lineItems?.length > 0) {
    const rows = toJobPartRows(id, lineItems);
    if (rows?.length > 0) {
      const { error: insErr } = await supabase?.from('job_parts')?.insert(rows);
      if (insErr) throw new Error(`Failed to update line items: ${insErr.message}`);
    }
  }

  // 4) Return full record (with joins)
  return await getDeal(id);
}

// DELETE: deal (delete parts first to satisfy FK)
export async function deleteDeal(id) {
  const { error: partsErr } = await supabase?.from('job_parts')?.delete()?.eq('job_id', id);
  if (partsErr) throw new Error(`Failed to delete line items: ${partsErr.message}`);

  const { error: jobErr } = await supabase?.from('jobs')?.delete()?.eq('id', id);
  if (jobErr) throw new Error(`Failed to delete deal: ${jobErr.message}`);

  return true;
}

// UPDATE: status only (handy for quick changes)
export async function updateDealStatus(id, job_status) {
  const { data, error } = await supabase?.from('jobs')?.update({ job_status })?.eq('id', id)?.select('id, job_status')?.single();

  if (error) throw new Error(`Failed to update status: ${error.message}`);
  return data;
}

// ✅ FIXED: mapDbDealToForm implementation (Step 7)
function mapDbDealToForm(dbDeal) {
  if (!dbDeal) return null;

  return {
    id: dbDeal?.id,
    title: dbDeal?.title || '',
    description: dbDeal?.description || '',
    vendor_id: dbDeal?.vendor_id,
    vehicle_id: dbDeal?.vehicle_id,
    job_status: dbDeal?.job_status || 'pending',
    priority: dbDeal?.priority || 'medium',
    scheduled_start_time: dbDeal?.scheduled_start_time || '',
    scheduled_end_time: dbDeal?.scheduled_end_time || '',
    estimated_hours: dbDeal?.estimated_hours || '',
    estimated_cost: dbDeal?.estimated_cost || '',
    actual_cost: dbDeal?.actual_cost || '',
    location: dbDeal?.location || '',
    customer_needs_loaner: !!dbDeal?.customer_needs_loaner,
    lineItems: (dbDeal?.job_parts || [])?.map(part => ({
      product_id: part?.product_id,
      unit_price: part?.unit_price || 0,
      quantity_used: part?.quantity_used || 1,
      lineItemPromisedDate: part?.promised_date || '',
      requiresScheduling: !!part?.requires_scheduling,
      noScheduleReason: part?.no_schedule_reason || '',
      isOffSite: !!part?.is_off_site,
      needsLoaner: false // Individual line item loaner (if needed)
    }))
  };
}

// Back-compat default export (so both import styles work):
export const dealService = {
  getAllDeals,
  getDeal,
  createDeal,
  updateDeal,
  deleteDeal,
  updateDealStatus,
};

export default dealService;

export { mapDbDealToForm };