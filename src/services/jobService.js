import { supabase } from '../lib/supabase';

export const jobService = {
  // Get all jobs with optional filtering
  async getJobs(filters = {}) {
    try {
      let query = supabase
        ?.from('jobs')
        ?.select(`
          *,
          vehicle:vehicles(id, make, model, year, license_plate, owner_name),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(id, full_name, email),
          vendor:vendors(id, name, contact_person),
          created_by_profile:user_profiles!jobs_created_by_fkey(full_name)
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
        return { data: null, error: { message: error?.message } };
      }

      return { data: data || [], error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to load jobs' } };
    }
  },

  // Get single job by ID
  async getJobById(id) {
    try {
      const { data, error } = await supabase
        ?.from('jobs')
        ?.select(`
          *,
          vehicle:vehicles(*),
          assigned_to_profile:user_profiles!jobs_assigned_to_fkey(id, full_name, email, role),
          vendor:vendors(*),
          created_by_profile:user_profiles!jobs_created_by_fkey(full_name),
          job_parts(
            *,
            product:products(*)
          ),
          communications(*, sent_by_profile:user_profiles!communications_sent_by_fkey(full_name))
        `)
        ?.eq('id', id)
        ?.single();

      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to load job details' } };
    }
  },

  // Create new job
  async createJob(jobData) {
    try {
      // Generate job number
      const { data: jobNumber } = await supabase?.rpc('generate_job_number');
      
      const { data, error } = await supabase
        ?.from('jobs')
        ?.insert([{
          ...jobData,
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
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to create job' } };
    }
  },

  // Update job
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
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to update job' } };
    }
  },

  // Delete job
  async deleteJob(id) {
    try {
      const { error } = await supabase
        ?.from('jobs')
        ?.delete()
        ?.eq('id', id);

      if (error) {
        return { error: { message: error?.message } };
      }

      return { error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { error: { message: 'Failed to delete job' } };
    }
  },

  // Update job status
  async updateJobStatus(id, status) {
    try {
      const updateData = { 
        job_status: status, 
        updated_at: new Date()?.toISOString() 
      };

      // Set completion timestamp if completed
      if (status === 'completed' && !updateData?.completed_at) {
        updateData.completed_at = new Date()?.toISOString();
      }

      // Set start timestamp if in progress
      if (status === 'in_progress' && !updateData?.started_at) {
        updateData.started_at = new Date()?.toISOString();
      }

      const { data, error } = await supabase
        ?.from('jobs')
        ?.update(updateData)
        ?.eq('id', id)
        ?.select()
        ?.single();

      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      return { data, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to update job status' } };
    }
  },

  // Get job statistics
  async getJobStats() {
    try {
      const { data, error } = await supabase
        ?.from('jobs')
        ?.select('job_status, priority');

      if (error) {
        return { data: null, error: { message: error?.message } };
      }

      const stats = {
        total: data?.length || 0,
        pending: data?.filter(j => j?.job_status === 'pending')?.length || 0,
        in_progress: data?.filter(j => j?.job_status === 'in_progress')?.length || 0,
        completed: data?.filter(j => j?.job_status === 'completed')?.length || 0,
        cancelled: data?.filter(j => j?.job_status === 'cancelled')?.length || 0,
        high_priority: data?.filter(j => j?.priority === 'high' || j?.priority === 'urgent')?.length || 0
      };

      return { data: stats, error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to load job statistics' } };
    }
  },

  // Get jobs assigned to current user
  async getMyJobs() {
    try {
      const currentUser = (await supabase?.auth?.getUser())?.data?.user;
      if (!currentUser) {
        return { data: [], error: null };
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
        return { data: null, error: { message: error?.message } };
      }

      return { data: data || [], error: null };
    } catch (error) {
      if (error?.message?.includes('Failed to fetch')) {
        return { 
          data: null, 
          error: { message: 'Cannot connect to database. Your Supabase project may be paused or deleted. Please visit your Supabase dashboard to check project status.' }
        };
      }
      return { data: null, error: { message: 'Failed to load assigned jobs' } };
    }
  },

  // Get all jobs (alias for getJobs with no filters)
  async getAllJobs() {
    try {
      return await this.getJobs({});
    } catch (error) {
      return { data: null, error: { message: 'Failed to load all jobs' } };
    }
  }
};