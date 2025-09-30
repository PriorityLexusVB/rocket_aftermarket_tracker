import React, { useState, useEffect } from 'react';
import { Activity, Filter, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

// Kanban components
import KanbanColumn from './components/KanbanColumn';
import JobCard from './components/JobCard';
import StatusUpdateModal from './components/StatusUpdateModal';
import FilterPanel from './components/FilterPanel';

const KanbanStatusBoard = () => {
  const { user } = useAuth();
  
  // State management
  const [jobs, setJobs] = useState([]);
  const [vendors, setVendors] = useState([]);
  const [filteredJobs, setFilteredJobs] = useState([]);
  const [selectedJob, setSelectedJob] = useState(null);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [draggedJob, setDraggedJob] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({
    vendors: [],
    priorities: [],
    overdue: false,
    dateRange: 'all' // 'today', 'week', 'month', 'all'
  });
  const [showFilters, setShowFilters] = useState(false);

  // Kanban columns definition
  const kanbanColumns = [
    {
      id: 'pending',
      title: 'Not Started',
      color: 'bg-gray-100 border-gray-300',
      headerColor: 'bg-gray-50 text-gray-700',
      statuses: ['pending']
    },
    {
      id: 'scheduled',
      title: 'Scheduled',
      color: 'bg-blue-100 border-blue-300',
      headerColor: 'bg-blue-50 text-blue-700',
      statuses: ['scheduled']
    },
    {
      id: 'in_progress',
      title: 'In Progress',
      color: 'bg-yellow-100 border-yellow-300',
      headerColor: 'bg-yellow-50 text-yellow-700',
      statuses: ['in_progress']
    },
    {
      id: 'quality_check',
      title: 'Quality Check',
      color: 'bg-purple-100 border-purple-300',
      headerColor: 'bg-purple-50 text-purple-700',
      statuses: ['quality_check']
    },
    {
      id: 'delivered',
      title: 'Delivered',
      color: 'bg-green-100 border-green-300',
      headerColor: 'bg-green-50 text-green-700',
      statuses: ['delivered', 'completed']
    }
  ];

  // Load data on mount
  useEffect(() => {
    loadJobs();
    loadVendors();
  }, []);

  // Real-time subscription for job updates
  useEffect(() => {
    const channel = supabase?.channel('jobs_kanban')?.on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'jobs' },
        (payload) => {
          console.log('Job update received:', payload);
          loadJobs(); // Refresh jobs on any change
        }
      )?.subscribe();

    return () => supabase?.removeChannel(channel);
  }, []);

  // Apply filters whenever jobs, searchTerm, or filters change
  useEffect(() => {
    applyFilters();
  }, [jobs, searchTerm, filters]);

  const loadJobs = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase?.from('jobs')?.select(`
          *,
          vendor:vendors(id, name, specialty),
          vehicle:vehicles(id, make, model, year, owner_name, stock_number),
          assigned_user:user_profiles!jobs_assigned_to_fkey(id, full_name)
        `)?.order('created_at', { ascending: false });

      if (error) {
        console.error('Error loading jobs:', error);
        return;
      }

      setJobs(data || []);
      
    } catch (error) {
      console.error('Error in loadJobs:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadVendors = async () => {
    try {
      const { data, error } = await supabase?.from('vendors')?.select('id, name, specialty')?.eq('is_active', true)?.order('name');

      if (error) {
        console.error('Error loading vendors:', error);
        return;
      }

      setVendors(data || []);
    } catch (error) {
      console.error('Error in loadVendors:', error);
    }
  };

  const applyFilters = () => {
    let filtered = [...jobs];

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm?.toLowerCase();
      filtered = filtered?.filter(job =>
        job?.title?.toLowerCase()?.includes(searchLower) ||
        job?.description?.toLowerCase()?.includes(searchLower) ||
        job?.job_number?.toLowerCase()?.includes(searchLower) ||
        job?.vendor?.name?.toLowerCase()?.includes(searchLower) ||
        job?.vehicle?.owner_name?.toLowerCase()?.includes(searchLower) ||
        `${job?.vehicle?.year} ${job?.vehicle?.make} ${job?.vehicle?.model}`?.toLowerCase()?.includes(searchLower)
      );
    }

    // Vendor filter
    if (filters?.vendors?.length > 0) {
      filtered = filtered?.filter(job =>
        filters?.vendors?.includes(job?.vendor_id)
      );
    }

    // Priority filter
    if (filters?.priorities?.length > 0) {
      filtered = filtered?.filter(job =>
        filters?.priorities?.includes(job?.priority)
      );
    }

    // Overdue filter
    if (filters?.overdue) {
      const now = new Date();
      filtered = filtered?.filter(job =>
        job?.due_date &&
        new Date(job.due_date) < now &&
        !['completed', 'delivered', 'cancelled']?.includes(job?.job_status)
      );
    }

    // Date range filter
    if (filters?.dateRange !== 'all') {
      const now = new Date();
      let startDate = new Date();
      
      switch (filters?.dateRange) {
        case 'today':
          startDate?.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate?.setDate(now?.getDate() - 7);
          break;
        case 'month':
          startDate?.setMonth(now?.getMonth() - 1);
          break;
      }
      
      filtered = filtered?.filter(job =>
        job?.created_at && new Date(job.created_at) >= startDate
      );
    }

    setFilteredJobs(filtered);
  };

  const getJobsForColumn = (columnStatuses) => {
    return filteredJobs?.filter(job =>
      columnStatuses?.includes(job?.job_status)
    );
  };

  const handleJobClick = (job) => {
    setSelectedJob(job);
    setShowStatusModal(true);
  };

  const handleStatusChange = async (jobId, newStatus) => {
    try {
      // Validate status progression
      const job = jobs?.find(j => j?.id === jobId);
      if (!job) return false;

      const { data: isValid } = await supabase?.rpc('validate_status_progression', {
          current_status: job?.job_status,
          new_status: newStatus
        });

      if (!isValid) {
        alert(`Invalid status progression from ${job?.job_status} to ${newStatus}`);
        return false;
      }

      // Update job status
      const { error } = await supabase?.from('jobs')?.update({ 
          job_status: newStatus,
          updated_at: new Date()?.toISOString()
        })?.eq('id', jobId);

      if (error) {
        console.error('Error updating job status:', error);
        return false;
      }

      // Log activity
      await supabase?.rpc('log_activity', {
        entity_type: 'job',
        entity_id: jobId,
        action: 'status_changed',
        description: `Status changed from ${job?.job_status} to ${newStatus}`
      });

      // Refresh jobs
      loadJobs();
      return true;

    } catch (error) {
      console.error('Error in handleStatusChange:', error);
      return false;
    }
  };

  // Drag and drop handlers
  const handleDragStart = (e, job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedJob(null);
  };

  const handleDrop = async (e, targetStatus) => {
    e?.preventDefault();
    
    if (!draggedJob || targetStatus === draggedJob?.job_status) {
      return;
    }

    const success = await handleStatusChange(draggedJob?.id, targetStatus);
    if (!success) {
      // Could show error feedback here
    }
  };

  const handleDragOver = (e) => {
    e?.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const isOverdue = (job) => {
    if (!job?.due_date || ['completed', 'delivered', 'cancelled']?.includes(job?.job_status)) {
      return false;
    }
    return new Date(job.due_date) < new Date();
  };

  const getColumnStats = (columnStatuses) => {
    const columnJobs = getJobsForColumn(columnStatuses);
    const overdue = columnJobs?.filter(isOverdue)?.length;
    const urgent = columnJobs?.filter(job => job?.priority === 'urgent')?.length;
    
    return {
      total: columnJobs?.length,
      overdue,
      urgent
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-4">Loading kanban board...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Activity className="h-6 w-6 text-blue-600" />
              <h1 className="text-2xl font-bold text-gray-900">Kanban Status Board</h1>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e?.target?.value)}
                placeholder="Search jobs, vehicles, or vendors..."
                className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center space-x-3">
            {/* Filter Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`
                flex items-center space-x-2 px-3 py-2 rounded-lg transition-colors
                ${showFilters ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'}
              `}
            >
              <Filter className="h-4 w-4" />
              <span>Filters</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>

            {/* Active filters indicator */}
            {(filters?.vendors?.length > 0 || filters?.priorities?.length > 0 || filters?.overdue || searchTerm) && (
              <div className="flex items-center space-x-1 text-sm text-blue-600">
                <span>Filtered</span>
                <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
              </div>
            )}

            {/* Jobs count */}
            <div className="text-sm text-gray-600">
              {filteredJobs?.length} of {jobs?.length} jobs
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
          <FilterPanel
            vendors={vendors}
            filters={filters}
            onFiltersChange={setFilters}
            onFilterChange={setFilters}
            onClearFilters={() => setFilters({ vendors: [], priorities: [], overdue: false, dateRange: 'all' })}
            onSavePreset={() => {}}
            onLoadPreset={() => {}}
            className="mt-4"
          />
        )}
      </div>
      {/* Kanban Board */}
      <div className="flex-1 overflow-hidden">
        <div className="h-full flex space-x-4 p-6 overflow-x-auto">
          {kanbanColumns?.map(column => (
            <KanbanColumn
              key={column?.id}
              column={column}
              jobs={getJobsForColumn(column?.statuses)}
              stats={getColumnStats(column?.statuses)}
              onJobClick={handleJobClick}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, column?.statuses?.[0])}
              draggedJob={draggedJob}
            >
              {getJobsForColumn(column?.statuses)?.map(job => (
                <JobCard
                  key={job?.id}
                  job={job}
                  isOverdue={isOverdue(job)}
                  onDragStart={(e) => handleDragStart(e, job)}
                  onDragEnd={handleDragEnd}
                  onClick={() => handleJobClick(job)}
                />
              ))}
            </KanbanColumn>
          ))}
        </div>
      </div>
      {/* Status Update Modal */}
      {showStatusModal && selectedJob && (
        <StatusUpdateModal
          job={selectedJob}
          onClose={() => {
            setShowStatusModal(false);
            setSelectedJob(null);
          }}
          onStatusUpdate={handleStatusChange}
        />
      )}
    </div>
  );
};

export default KanbanStatusBoard;