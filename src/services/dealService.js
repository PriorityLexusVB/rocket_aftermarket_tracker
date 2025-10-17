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
  'customer_needs_loaner', // ✅ CONFIRMED: This column exists
  'service_type',
  'delivery_coordinator_id',
  'assigned_to'
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
        // Add new per-line-item scheduling fields
        promised_date: it?.lineItemPromisedDate || null,
        requires_scheduling: !!it?.requiresScheduling,
        no_schedule_reason: it?.requiresScheduling ? null : (it?.noScheduleReason || null),
        is_off_site: !!it?.isOffSite
        // ❌ REMOVED: description field as it doesn't exist in schema
      }))?.filter((row) => row?.product_id !== null || row?.quantity_used || row?.unit_price))
  );
}

// A3: Enhanced UPSERT loaner assignment function
async function upsertLoanerAssignment(jobId, loanerData) {
  if (!loanerData?.loaner_number?.trim()) {
    return; // No loaner number provided, skip assignment
  }

  try {
    // Check for existing active assignment for this job
    const { data: existing } = await supabase
      ?.from('loaner_assignments')
      ?.select('id')
      ?.eq('job_id', jobId)
      ?.is('returned_at', null)
      ?.single();

    const assignmentData = {
      job_id: jobId,
      loaner_number: loanerData?.loaner_number?.trim(),
      eta_return_date: loanerData?.eta_return_date || null,
      notes: loanerData?.notes?.trim() || null
    };

    if (existing) {
      // Update existing assignment
      const { error } = await supabase
        ?.from('loaner_assignments')
        ?.update(assignmentData)
        ?.eq('id', existing?.id);
      
      if (error) throw error;
    } else {
      // Create new assignment
      const { error } = await supabase
        ?.from('loaner_assignments')
        ?.insert([assignmentData]);
      
      if (error) throw error;
    }
  } catch (error) {
    // Handle uniqueness constraint error gracefully
    if (error?.code === '23505') {
      throw new Error(`Loaner ${loanerData?.loaner_number} is already assigned to another active job`);
    }
    throw error;
  }
}

// --- queries -------------------------------------------------------------

// ✅ UPDATED: Proper tracker SQL query with CTE for next appointments
export async function getAllDeals() {
  try {
    // Enhanced query with CTE for next appointment calculations
    const { data: jobs, error } = await supabase?.rpc('sql', {
      query: `
        WITH next_appt AS (
          SELECT DISTINCT ON (jp.job_id)
            jp.job_id,
            jp.promised_date as next_appointment_date,
            CASE 
              WHEN jp.promised_date < CURRENT_DATE THEN 'overdue'
              WHEN jp.promised_date = CURRENT_DATE THEN 'today'  
              WHEN jp.promised_date <= CURRENT_DATE + INTERVAL '7 days'THEN 'upcoming' ELSE'future'
            END as appointment_status
          FROM job_parts jp
          WHERE jp.requires_scheduling = true 
            AND jp.promised_date IS NOT NULL
            AND jp.promised_date >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY jp.job_id, jp.promised_date ASC
        ),
        active_loaner AS (
          SELECT 
            la.job_id, 
            la.id as loaner_id, 
            la.loaner_number, 
            la.eta_return_date,
            la.notes as loaner_notes
          FROM loaner_assignments la
          WHERE la.returned_at IS NULL
        )
        SELECT 
          j.id,
          j.created_at,
          j.job_status,
          j.service_type,
          j.color_code,
          j.title,
          j.job_number,
          j.priority,
          j.assigned_to,
          j.delivery_coordinator_id,
          j.finance_manager_id,
          j.customer_needs_loaner,
          -- Vehicle information
          v.id as vehicle_id,
          v.year as vehicle_year,
          v.make as vehicle_make,
          v.model as vehicle_model,
          v.stock_number as vehicle_stock_number,
          -- Next appointment data from CTE
          na.next_appointment_date,
          na.appointment_status,
          -- Active loaner data
          ala.loaner_id,
          ala.loaner_number,
          to_char(ala.eta_return_date, 'Mon DD') as loaner_eta_short,
          ala.loaner_notes,
          -- Job parts for service location and scheduling
          COALESCE(
            json_agg(
              CASE WHEN jp.id IS NOT NULL THEN
                json_build_object(
                  'id', jp.id,
                  'product_id', jp.product_id,
                  'unit_price', jp.unit_price,
                  'quantity_used', jp.quantity_used,
                  'promised_date', jp.promised_date,
                  'requires_scheduling', jp.requires_scheduling,
                  'no_schedule_reason', jp.no_schedule_reason,
                  'is_off_site', jp.is_off_site
                )
              ELSE NULL END
            ) FILTER (WHERE jp.id IS NOT NULL),
            '[]'::json
          ) as job_parts
        FROM jobs j
        LEFT JOIN vehicles v ON j.vehicle_id = v.id
        LEFT JOIN next_appt na ON j.id = na.job_id
        LEFT JOIN active_loaner ala ON ala.job_id = j.id
        LEFT JOIN job_parts jp ON j.id = jp.job_id
        WHERE j.job_status IN ('draft', 'pending', 'in_progress', 'completed')
        GROUP BY 
          j.id, j.created_at, j.job_status, j.service_type, j.color_code, 
          j.title, j.job_number, j.priority, j.assigned_to, 
          j.delivery_coordinator_id, j.finance_manager_id, j.customer_needs_loaner,
          v.id, v.year, v.make, v.model, v.stock_number,
          na.next_appointment_date, na.appointment_status,
          ala.loaner_id, ala.loaner_number, ala.eta_return_date, ala.loaner_notes
        ORDER BY j.created_at DESC
      `
    });

    if (error) throw error;

    // Get transactions data separately for customer info and totals
    const jobIds = (jobs || [])?.map(j => j?.id);
    const { data: transactions } = await supabase?.from('transactions')?.select('job_id, customer_name, customer_phone, customer_email, total_amount')?.in('job_id', jobIds);

    // Get delivery coordinators and sales consultants
    const { data: deliveryCoordinators } = await supabase?.from('user_profiles')?.select('id, full_name')?.eq('department', 'Delivery Coordinator')?.eq('is_active', true);

    const { data: salesStaff } = await supabase?.from('user_profiles')?.select('id, full_name')?.eq('department', 'Sales Consultants')?.eq('is_active', true);

    // Enhanced job mapping with CTE data
    const enhancedJobs = (jobs || [])?.map(job => {
      const transaction = transactions?.find(t => t?.job_id === job?.id);
      const deliveryCoordinator = deliveryCoordinators?.find(dc => dc?.id === job?.delivery_coordinator_id);
      const salesConsultant = salesStaff?.find(sc => sc?.id === job?.created_by);

      // Parse job_parts JSON if it exists
      let jobParts = [];
      try {
        jobParts = job?.job_parts ? JSON.parse(job?.job_parts) : [];
      } catch (e) {
        jobParts = Array.isArray(job?.job_parts) ? job?.job_parts : [];
      }

      return {
        ...job,
        vehicle: job?.vehicle_id ? {
          id: job?.vehicle_id,
          year: job?.vehicle_year,
          make: job?.vehicle_make,
          model: job?.vehicle_model,
          stock_number: job?.vehicle_stock_number
        } : null,
        job_parts: jobParts,
        customer_name: transaction?.customer_name || '',
        customer_phone: transaction?.customer_phone || '',
        customer_email: transaction?.customer_email || '',
        total_amount: transaction?.total_amount || 0,
        delivery_coordinator_name: deliveryCoordinator?.full_name || null,
        sales_consultant_name: salesConsultant?.full_name || null,
        next_promised_short: job?.next_appointment_date ? 
          new Date(job?.next_appointment_date)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null,
        appointment_status: job?.appointment_status || null
      };
    });

    return enhancedJobs;
  } catch (error) {
    // Fallback to original query if CTE query fails
    console.warn('CTE query failed, falling back to original query:', error?.message);
    
    const { data: jobs, error: fallbackError } = await supabase?.from('jobs')?.select(`
        id,
        created_at,
        job_status,
        service_type,
        color_code,
        title,
        job_number,
        priority,
        assigned_to,
        delivery_coordinator_id,
        finance_manager_id,
        customer_needs_loaner,
        vehicle:vehicles(id, year, make, model, stock_number),
        job_parts(id, product_id, unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site)
      `)?.in('job_status', ['draft', 'pending', 'in_progress', 'completed'])?.order('created_at', { ascending: false });

    if (fallbackError) throw new Error(`Failed to load deals: ${fallbackError.message}`);

    // Get transactions data separately for customer info and totals
    const jobIds = (jobs || [])?.map(j => j?.id);
    const { data: transactions } = await supabase?.from('transactions')?.select('job_id, customer_name, customer_phone, customer_email, total_amount')?.in('job_id', jobIds);

    // Get delivery coordinators and sales consultants
    const { data: deliveryCoordinators } = await supabase?.from('user_profiles')?.select('id, full_name')?.eq('department', 'Delivery Coordinator')?.eq('is_active', true);

    const { data: salesStaff } = await supabase?.from('user_profiles')?.select('id, full_name')?.eq('department', 'Sales Consultants')?.eq('is_active', true);

    // Merge the data with fallback next appointment calculation
    const enhancedJobs = (jobs || [])?.map(job => {
      const transaction = transactions?.find(t => t?.job_id === job?.id);
      const deliveryCoordinator = deliveryCoordinators?.find(dc => dc?.id === job?.delivery_coordinator_id);
      const salesConsultant = salesStaff?.find(sc => sc?.id === job?.created_by);

      // Calculate next promised date
      const schedulingParts = (job?.job_parts || [])?.filter(part => part?.requires_scheduling && part?.promised_date);
      const nextPromisedDate = schedulingParts?.length > 0 
        ? schedulingParts?.sort((a, b) => new Date(a.promised_date) - new Date(b.promised_date))?.[0]?.promised_date
        : null;

      return {
        ...job,
        customer_name: transaction?.customer_name || '',
        customer_phone: transaction?.customer_phone || '',
        customer_email: transaction?.customer_email || '',
        total_amount: transaction?.total_amount || 0,
        delivery_coordinator_name: deliveryCoordinator?.full_name || null,
        sales_consultant_name: salesConsultant?.full_name || null,
        next_promised_short: nextPromisedDate ? 
          new Date(nextPromisedDate)?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : null
      };
    });

    return enhancedJobs;
  }
}

// Shared select list with lightweight nested relations.
// Updated to include new job_parts columns and proper relationships
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
  assigned_to,
  created_at,
  vehicle:vehicles(id, year, make, model, stock_number),
  vendor:vendors(id, name),
  job_parts(id, product_id, unit_price, quantity_used, promised_date, requires_scheduling, no_schedule_reason, is_off_site, product:products(id, name))
`;

// READ: single deal by id (used by Edit) - ENHANCED with transaction data
export async function getDeal(id) {
  const { data: job, error: jobError } = await supabase?.from('jobs')?.select(JOBS_SELECT)?.eq('id', id)?.single();

  if (jobError) throw new Error(`Failed to load deal: ${jobError.message}`);

  // Get transaction data for customer information
  const { data: transaction } = await supabase?.from('transactions')?.select('customer_name, customer_phone, customer_email, total_amount')?.eq('job_id', id)?.single();

  // Merge job and transaction data
  const enhancedDeal = {
    ...job,
    customer_name: transaction?.customer_name || '',
    customer_phone: transaction?.customer_phone || '',
    customer_email: transaction?.customer_email || '',
    total_amount: transaction?.total_amount || 0
  };

  return enhancedDeal;
}

// CREATE: deal + job_parts
export async function createDeal(formState) {
  const payload = sanitizeDealPayload(formState || {});
  const lineItems = Array.isArray(formState?.lineItems) ? formState?.lineItems : [];

  // 1) create job
  const { data: job, error: jobErr } = await supabase?.from('jobs')?.insert([payload])?.select('id')?.single();

  if (jobErr) throw new Error(`Failed to create deal: ${jobErr.message}`);

  try {
    // 2) insert parts (if any)
    if (lineItems?.length > 0) {
      const rows = toJobPartRows(job?.id, lineItems);
      if (rows?.length > 0) {
        const { error: partsErr } = await supabase?.from('job_parts')?.insert(rows);
        if (partsErr) throw partsErr;
      }
    }

    // A3: Handle loaner assignment for new deals
    if (formState?.customer_needs_loaner && formState?.loanerForm) {
      await upsertLoanerAssignment(job?.id, formState?.loanerForm);
    }

    // 3) return full record (with joins)
    return await getDeal(job?.id);
  } catch (error) {
    // rollback best-effort
    await supabase?.from('jobs')?.delete()?.eq('id', job?.id);
    throw new Error(`Failed to create deal: ${error.message}`);
  }
}

// UPDATE: deal + replace job_parts - FIXED with proper transaction handling and customer data
export async function updateDeal(id, formState) {
  const payload = sanitizeDealPayload(formState || {});
  const lineItems = Array.isArray(formState?.lineItems) ? formState?.lineItems : [];

  // Calculate total deal value for transactions
  const totalDealValue = lineItems?.reduce((sum, item) => {
    const qty = Number(item?.quantity_used || item?.quantity || 1);
    const price = Number(item?.unit_price || item?.price || 0);
    return sum + (qty * price);
  }, 0) || 0;

  // ✅ FIXED: Extract customer info from consistent field names in form state
  const customerName = formState?.customerName?.trim() || formState?.customer_name?.trim() || '';
  const customerPhone = formState?.customerPhone?.trim() || formState?.customer_phone?.trim() || '';
  const customerEmail = formState?.customerEmail?.trim() || formState?.customer_email?.trim() || '';

  // 1) Update job
  const { error: jobErr } = await supabase?.from('jobs')?.update(payload)?.eq('id', id);
  if (jobErr) throw new Error(`Failed to update deal: ${jobErr.message}`);

  // 2) ✅ ENHANCED: Always upsert transaction with customer data
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

  // A3: Handle loaner assignment updates
  if (formState?.customer_needs_loaner && formState?.loanerForm) {
    await upsertLoanerAssignment(id, formState?.loanerForm);
  }

  // 4) Return full record (with joins and transaction data)
  return await getDeal(id);
}

// ✅ UPDATED: Use safe cascade delete function
export async function deleteDeal(id) {
  const { error } = await supabase?.rpc('delete_job_cascade', { p_job_id: id });
  if (error) throw new Error(`Failed to delete deal: ${error.message}`);
  return true;
}

// UPDATE: status only (handy for quick changes)
export async function updateDealStatus(id, job_status) {
  const { data, error } = await supabase?.from('jobs')?.update({ job_status })?.eq('id', id)?.select('id, job_status')?.single();

  if (error) throw new Error(`Failed to update status: ${error.message}`);
  return data;
}

// ✅ ENHANCED: mapDbDealToForm implementation with proper customer data handling
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
    assigned_to: dbDeal?.assigned_to,
    delivery_coordinator_id: dbDeal?.delivery_coordinator_id,
    // ✅ ENHANCED: Include customer data from transactions
    customerName: dbDeal?.customer_name || '',
    customerPhone: dbDeal?.customer_phone || '',
    customerEmail: dbDeal?.customer_email || '',
    lineItems: (dbDeal?.job_parts || [])?.map(part => ({
      product_id: part?.product_id,
      unit_price: part?.unit_price || 0,
      quantity_used: part?.quantity_used || 1,
      lineItemPromisedDate: part?.promised_date || '',
      requiresScheduling: !!part?.requires_scheduling,
      noScheduleReason: part?.no_schedule_reason || '',
      isOffSite: !!part?.is_off_site
      // ❌ REMOVED: description mapping as column doesn't exist
    }))
  };
}

// A3: New function to mark loaner as returned
export async function markLoanerReturned(loanerAssignmentId) {
  const { error } = await supabase?.rpc('mark_loaner_returned', { 
    assignment_id: loanerAssignmentId 
  });
  
  if (error) throw new Error(`Failed to mark loaner as returned: ${error.message}`);
  return true;
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