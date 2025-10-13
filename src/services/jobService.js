import { supabase } from '../lib/supabase';

// Job Service with comprehensive deal/line items functionality
export const jobService = {
  // Get all jobs with full line items details
  async getAllJobs() {
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicle:vehicles(*),
          vendor:vendors(id, name, specialty, contact_person),
          assigned_to:user_profiles!jobs_assigned_to_fkey(id, first_name, last_name, email),
          created_by:user_profiles!jobs_created_by_fkey(id, first_name, last_name, email),
          job_parts(
            id,
            quantity_used,
            unit_price,
            total_price,
            product:products(
              id,
              name,
              description,
              category,
              brand,
              unit_price,
              cost
            )
          )
        `)?.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching jobs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error fetching jobs:', error);
      return [];
    }
  },

  // Create a new deal with line items
  async createDealWithLineItems(dealData) {
    try {
      // create parent job first
      const parent = await this.createJob({
        ...dealData,
        // Ensure parent job has a deterministic title if not provided
        title:
          (dealData?.title && String(dealData?.title)?.trim()) ||
          [
            dealData?.stock_number && `#${dealData?.stock_number}`,
            dealData?.vehicle_label,
            dealData?.lineItems?.length && `${dealData?.lineItems?.length} item(s)`
          ]?.filter(Boolean)?.join(' — ') ||
          'Sales Transaction'
      });

      // Create line items (job_parts) if provided
      if (dealData?.lineItems && dealData?.lineItems?.length > 0) {
        const lineItemsData = dealData?.lineItems?.map(item => ({
          job_id: parent?.data?.id,
          product_id: item?.product_id,
          quantity_used: item?.quantity || 1,
          unit_price: parseFloat(item?.unit_price) || 0
        }));

        const { error: lineItemsError } = await supabase?.from('job_parts')?.insert(lineItemsData);

        if (lineItemsError) {
          console.error('Error creating line items:', lineItemsError);
          // Rollback: delete the created job
          await supabase?.from('jobs')?.delete()?.eq('id', parent?.data?.id);
          throw new Error(`Failed to create line items: ${lineItemsError?.message}`);
        }
      }

      // Return the complete deal with line items
      return await this.getJobById(parent?.data?.id);
    } catch (error) {
      console.error('Network error creating deal:', error);
      throw error;
    }
  },

  // Update a deal with line items
  async updateDealWithLineItems(jobId, dealData) {
    if (!jobId) throw new Error('Job ID is required');
    
    try {
      // Update the main job record
      const { data: jobData, error: jobError } = await supabase?.from('jobs')?.update({
          title: dealData?.title,
          description: dealData?.description,
          vehicle_id: dealData?.vehicle_id,
          vendor_id: dealData?.vendor_id || null,
          service_type: dealData?.service_type || (dealData?.vendor_id ? 'vendor' : 'in_house'),
          location: dealData?.location || (dealData?.vendor_id ? 'Off-Site' : 'In-House Service Bay'),
          priority: dealData?.priority || 'medium',
          promised_date: dealData?.promised_date,
          scheduled_start_time: dealData?.scheduled_start_time,
          scheduled_end_time: dealData?.scheduled_end_time,
          estimated_cost: dealData?.estimated_cost,
          customer_needs_loaner: dealData?.customer_needs_loaner || false,
          delivery_coordinator_id: dealData?.delivery_coordinator_id,
          assigned_to: dealData?.assigned_to,
          calendar_notes: dealData?.calendar_notes,
          color_code: dealData?.color_code || '#3b82f6',
          job_status: dealData?.job_status || 'pending',
          updated_at: new Date()?.toISOString()
        })?.eq('id', jobId)?.select()?.single();

      if (jobError) {
        throw new Error(`Failed to update job: ${jobError?.message}`);
      }

      // Handle line items updates if provided
      if (dealData?.lineItems && Array.isArray(dealData?.lineItems)) {
        // Delete existing line items
        const { error: deleteError } = await supabase?.from('job_parts')?.delete()?.eq('job_id', jobId);
        
        if (deleteError && deleteError?.code !== 'PGRST116') { // PGRST116 means no rows found, which is OK
          throw new Error(`Failed to clear line items: ${deleteError?.message}`);
        }

        // Insert new line items
        if (dealData?.lineItems?.length > 0) {
          const lineItemsData = dealData?.lineItems?.map(item => ({
            job_id: jobId,
            product_id: item?.product_id,
            quantity_used: item?.quantity || 1,
            unit_price: parseFloat(item?.unit_price) || 0
          }));

          const { error: insertError } = await supabase?.from('job_parts')?.insert(lineItemsData);

          if (insertError) {
            throw new Error(`Failed to create line items: ${insertError?.message}`);
          }
        }
      }

      return { success: true, id: jobId, data: jobData };
    } catch (error) {
      return { success: false, error: error?.message || 'Failed to update deal with line items' };
    }
  },

  // Get job by ID with full details
  async getJobById(id) {
    if (!id) return null;
    
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicle:vehicles(*),
          vendor:vendors(id, name, specialty, contact_person, phone, email),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(id, full_name, email, role),
          created_by_profile:user_profiles!jobs_created_by_fkey(id, full_name, email),
          delivery_coordinator:user_profiles!jobs_delivery_coordinator_id_fkey(id, full_name, email),
          job_parts(
            id,
            quantity_used,
            unit_price,
            total_price,
            created_at,
            product:products(
              id,
              name,
              description,
              category,
              brand,
              unit_price,
              cost,
              part_number,
              op_code
            )
          )
        `)?.eq('id', id)?.single();

      if (error) {
        console.error('Error fetching job:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Network error fetching job:', error);
      return null;
    }
  },

  // Delete a deal and all its line items
  async deleteDeal(dealId) {
    if (!dealId) throw new Error('Deal ID is required');
    
    try {
      // Delete job_parts first (foreign key constraint)
      const { error: lineItemsError } = await supabase?.from('job_parts')?.delete()?.eq('job_id', dealId);
      
      if (lineItemsError) {
        console.error('Error deleting line items:', lineItemsError);
        throw new Error(`Failed to delete line items: ${lineItemsError?.message}`);
      }

      // Delete the main job
      const { error: jobError } = await supabase?.from('jobs')?.delete()?.eq('id', dealId);
      
      if (jobError) {
        console.error('Error deleting job:', jobError);
        throw new Error(`Failed to delete deal: ${jobError?.message}`);
      }

      return true;
    } catch (error) {
      console.error('Network error deleting deal:', error);
      throw error;
    }
  },

  // Get jobs by status
  async getJobsByStatus(status) {
    if (!status) return [];
    
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicle:vehicles(*),
          vendor:vendors(id, name, specialty),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(id, full_name),
          job_parts(
            id,
            quantity_used,
            unit_price,
            total_price,
            product:products(id, name, category, unit_price, cost)
          )
        `)?.eq('job_status', status)?.order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching jobs by status:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error fetching jobs by status:', error);
      return [];
    }
  },

  // Update job status
  async updateJobStatus(jobId, status, additionalData = {}) {
    if (!jobId || !status) throw new Error('Job ID and status are required');
    
    try {
      const updateData = {
        job_status: status,
        updated_at: new Date()?.toISOString(),
        ...additionalData
      
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};

      // Set completed_at when status is completed
      if (status === 'completed' && !updateData?.completed_at) {
        updateData.completed_at = new Date()?.toISOString();
      }

      const { data, error } = await supabase?.from('jobs')?.update(updateData)?.eq('id', jobId)?.select()?.single();

      if (error) {
        console.error('Error updating job status:', error);
        throw new Error(`Failed to update status: ${error?.message}`);
      }

      return data;
    } catch (error) {
      console.error('Network error updating job status:', error);
      throw error;
    }
  },

  // Search jobs with line items
  async searchJobs(searchTerm) {
    if (!searchTerm?.trim()) return [];
    
    try {
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vehicle:vehicles(year, make, model, owner_name, stock_number),
          vendor:vendors(name, specialty),
          job_parts(
            id,
            quantity_used,
            unit_price,
            total_price,
            product:products(id, name, category)
          )
        `)?.or(`title.ilike.%${searchTerm}%,job_number.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)?.order('created_at', { ascending: false })?.limit(50);

      if (error) {
        console.error('Error searching jobs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Network error searching jobs:', error);
      return [];
    }
  },

  // Batch update multiple jobs
  async batchUpdateJobs(updates) {
    if (!updates || !Array.isArray(updates) || updates?.length === 0) {
      throw new Error('Updates array is required');
    }
    
    try {
      const results = await Promise.all(
        updates?.map(async (update) => {
          const { id, ...updateData } = update;
          return await this.updateJobStatus(id, updateData?.job_status, updateData);
        })
      );

      return results;
    } catch (error) {
      console.error('Network error batch updating jobs:', error);
      throw error;
    }
  },

  // Calculate deal/job totals from line items
  calculateDealTotals(jobParts) {
    if (!jobParts || !Array.isArray(jobParts)) {
      return { totalCost: 0, totalPrice: 0, totalProfit: 0, itemCount: 0 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    }

    const totalCost = jobParts?.reduce((sum, part) => {
      const cost = (part?.product?.cost || 0) * (part?.quantity_used || 1);
      return sum + cost;
    }, 0);

    const totalPrice = jobParts?.reduce((sum, part) => {
      const price = (part?.unit_price || 0) * (part?.quantity_used || 1);
      return sum + price;
    }, 0);

    const totalProfit = totalPrice - totalCost;

    return {
      totalCost: parseFloat(totalCost?.toFixed(2)),
      totalPrice: parseFloat(totalPrice?.toFixed(2)),
      totalProfit: parseFloat(totalProfit?.toFixed(2)),
      itemCount: jobParts?.length
    
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
  },

  // Get all jobs with optional filtering (maintains compatibility with existing code)
  async getJobs(filters = {}) {
    try {
      let query = supabase
        ?.from('jobs')
        ?.select(`
          *,
          vehicle:vehicles(id, make, model, year, license_plate, owner_name),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(id, full_name, email),
          vendor:vendors(id, name, contact_person),
          created_by_profile:user_profiles!jobs_created_by_fkey(full_name),
          job_parts(
            id,
            quantity_used,
            unit_price,
            total_price,
            product:products(id, name, category, unit_price, cost)
          )
        `)
        ?.order('created_at', { ascending: false });

      // Apply filters
      if (filters?.status) {
        query = query?.eq('job_status', filters?.status);
      }
      
      if (filters?.priority) {
        query = query?.eq('priority', filters?.priority);
      }
      
      if (filters?.assigned_to) {
        query = query?.eq('assigned_to', filters?.assigned_to);
      }

      if (filters?.search) {
        query = query?.or(`job_number.ilike.%${filters?.search}%,title.ilike.%${filters?.search}%,description.ilike.%${filters?.search}%`);
      }

      const { data, error } = await query;

      if (error) {
        return { data: null, error: { message: error?.message } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }

      return { data: data || [], error: null 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }
      return { data: null, error: { message: 'Failed to load jobs' } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    }
  },

  // Create new job (maintains compatibility)
  async createJob(jobData) {
    // Guard against NULL titles (Postgres 23502 on jobs.title)
    const safeTitle =
      (jobData?.title && String(jobData?.title)?.trim()) ||
      [
        jobData?.stock_number && `#${jobData?.stock_number}`,
        jobData?.vehicle_label,
        jobData?.product_name
      ]?.filter(Boolean)?.join(' — ') ||
      'Aftermarket Job';

    const safeJob = { ...jobData, title: safeTitle 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};

    try {
      // Generate job number
      const { data: jobNumber } = await supabase?.rpc('generate_job_number');
      
      const { data, error } = await supabase
        ?.from('jobs')
        ?.insert([{
          ...safeJob,
          job_number: jobNumber,
          created_by: (await supabase?.auth?.getUser())?.data?.user?.id
        }])
        ?.select(`
          *,
          vehicle:vehicles(id, make, model, year, license_plate, owner_name),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(full_name),
          vendor:vendors(name)
        `)
        ?.single();

      if (error) {
        return { data: null, error: { message: error?.message } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }

      return { data, error: null 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }
      return { data: null, error: { message: 'Failed to create job' } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    }
  },

  // Update job (maintains compatibility)
  async updateJob(id, updates) {
    try {
      const { data, error } = await supabase
        ?.from('jobs')
        ?.update({
          ...updates,
          updated_at: new Date()?.toISOString()
        })
        ?.eq('id', id)
        ?.select(`
          *,
          vehicle:vehicles(id, make, model, year, license_plate, owner_name),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(full_name),
          vendor:vendors(name)
        `)
        ?.single();

      if (error) {
        return { data: null, error: { message: error?.message } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }

      return { data, error: null 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }
      return { data: null, error: { message: 'Failed to update job' } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    }
  },

  // Delete job (maintains compatibility)
  async deleteJob(id) {
    try {
      const { error } = await supabase
        ?.from('jobs')
        ?.delete()
        ?.eq('id', id);

      if (error) {
        return { error: { message: error?.message } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }

      return { error: null 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }
      return { error: { message: 'Failed to delete job' } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    }
  },

  // Get job statistics (maintains compatibility)
  async getJobStats() {
    try {
      const { data, error } = await supabase
        ?.from('jobs')
        ?.select('job_status, priority');

      if (error) {
        return { data: null, error: { message: error?.message } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }

      const stats = {
        total: data?.length || 0,
        pending: data?.filter(j => j?.job_status === 'pending')?.length || 0,
        in_progress: data?.filter(j => j?.job_status === 'in_progress')?.length || 0,
        completed: data?.filter(j => j?.job_status === 'completed')?.length || 0,
        cancelled: data?.filter(j => j?.job_status === 'cancelled')?.length || 0,
        high_priority: data?.filter(j => j?.priority === 'high' || j?.priority === 'urgent')?.length || 0
      
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};

      return { data: stats, error: null 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }
      return { data: null, error: { message: 'Failed to load job statistics' } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    }
  },

  // Get jobs assigned to current user (maintains compatibility)
  async getMyJobs() {
    try {
      const currentUser = (await supabase?.auth?.getUser())?.data?.user;
      if (!currentUser) {
        return { data: [], error: null 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }

      const { data, error } = await supabase
        ?.from('jobs')
        ?.select(`
          *,
          vehicle:vehicles(make, model, year, license_plate, owner_name)
        `)
        ?.eq('assigned_to', currentUser?.id)
        ?.order('created_at', { ascending: false });

      if (error) {
        return { data: null, error: { message: error?.message } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }

      return { data: data || [], error: null 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      }
      return { data: null, error: { message: 'Failed to load assigned jobs' } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    }
  }

  ,
  // Upsert a single line item for a given job (insert if id is null, else update by id)
  async upsertLineItem(jobId, item) {
    try {
      if (!jobId) return { data: null, error: { message: 'jobId is required' } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      const row = {
        id: item?.id || undefined,
        job_id: jobId,
        product_id: item?.product_id,
        quantity_used: item?.quantity || 1,
        unit_price: parseFloat(item?.unit_price || 0)
      
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      const { data, error } = await supabase
        ?.from('job_parts')
        ?.upsert([row], { onConflict: 'id' })
        ?.select()
        ?.single();
      if (error) return { data: null, error 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
      return { data, error: null 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to upsert line item' } 
  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};
    }
  }

  ,
  // Remove any child calendar jobs associated with a line item (by LI:<id> marker)
  async removeLineItemCalendarJob(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: null };
      const marker = `LI:${lineItemId}`;
      const { data: hits, error: qErr } = await supabase
        ?.from('jobs')
        ?.select('id, calendar_notes')
        ?.ilike('calendar_notes', `%${marker}%`);
      if (qErr) return { data: null, error: qErr };
      if (!hits?.length) return { data: [], error: null };
      const ids = hits?.map(r => r?.id);
      const { data, error } = await supabase?.from('jobs')?.delete()?.in('id', ids)?.select();
      if (error) return { data: null, error };
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to remove calendar jobs for line item' } };
    }
  },
  // Delete a single line item and its calendar job(s)
  async deleteLineItem(lineItemId) {
    try {
      if (!lineItemId) return { data: null, error: { message: 'lineItemId is required' } };
      const { data, error } = await supabase?.from('job_parts')?.delete()?.eq('id', lineItemId)?.select()?.single();
      if (error) return { data: null, error };
      await this.removeLineItemCalendarJob(lineItemId);
      return { data, error: null };
    } catch (error) {
      return { data: null, error: { message: error?.message || 'Failed to delete line item' } };
    }
  }
};