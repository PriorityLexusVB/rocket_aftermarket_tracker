import React, { useState, useEffect } from 'react';
import { X, Clock, User, Calendar, MapPin, AlertTriangle, Save, Trash2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

const JobScheduleModal = ({ 
  job, 
  vendors = [], 
  onClose, 
  onUpdate 
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    vendor_id: '',
    location: '',
    color_code: '#3b82f6',
    priority: 'medium',
    job_status: 'scheduled',
    calendar_notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [hasConflict, setHasConflict] = useState(false);
  const [conflictDetails, setConflictDetails] = useState(null);
  const [errors, setErrors] = useState({});

  // Initialize form with job data
  useEffect(() => {
    if (job) {
      setFormData({
        title: job?.title || '',
        description: job?.description || '',
        scheduled_start_time: job?.scheduled_start_time 
          ? new Date(job.scheduled_start_time)?.toISOString()?.slice(0, 16)
          : '',
        scheduled_end_time: job?.scheduled_end_time
          ? new Date(job.scheduled_end_time)?.toISOString()?.slice(0, 16)
          : '',
        vendor_id: job?.vendor_id || '',
        location: job?.location || '',
        color_code: job?.color_code || '#3b82f6',
        priority: job?.priority || 'medium',
        job_status: job?.job_status || 'scheduled',
        calendar_notes: job?.calendar_notes || ''
      });
    }
  }, [job]);

  // Check for conflicts when vendor or time changes
  useEffect(() => {
    if (formData?.vendor_id && formData?.scheduled_start_time && formData?.scheduled_end_time) {
      checkSchedulingConflict();
    }
  }, [formData?.vendor_id, formData?.scheduled_start_time, formData?.scheduled_end_time]);

  const checkSchedulingConflict = async () => {
    if (!formData?.vendor_id || !formData?.scheduled_start_time || !formData?.scheduled_end_time) {
      setHasConflict(false);
      return;
    }

    try {
      const { data: conflictExists, error } = await supabase?.rpc('check_vendor_schedule_conflict', {
          vendor_uuid: formData?.vendor_id,
          start_time: new Date(formData.scheduled_start_time)?.toISOString(),
          end_time: new Date(formData.scheduled_end_time)?.toISOString(),
          exclude_job_id: job?.id || null
        });

      if (error) {
        console.error('Error checking conflicts:', error);
        return;
      }

      setHasConflict(conflictExists || false);

      // Get conflict details if there is one
      if (conflictExists) {
        const { data: conflictingJobs, error: fetchError } = await supabase?.rpc('get_jobs_by_date_range', {
            start_date: new Date(formData.scheduled_start_time)?.toISOString(),
            end_date: new Date(formData.scheduled_end_time)?.toISOString(),
            vendor_filter: formData?.vendor_id
          });

        if (!fetchError && conflictingJobs?.length > 0) {
          const conflictingJob = conflictingJobs?.find(j => j?.id !== job?.id);
          setConflictDetails(conflictingJob);
        }
      } else {
        setConflictDetails(null);
      }

    } catch (error) {
      console.error('Error in conflict check:', error);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData?.title?.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData?.scheduled_start_time) {
      newErrors.scheduled_start_time = 'Start time is required';
    }

    if (!formData?.scheduled_end_time) {
      newErrors.scheduled_end_time = 'End time is required';
    }

    if (formData?.scheduled_start_time && formData?.scheduled_end_time) {
      if (new Date(formData.scheduled_start_time) >= new Date(formData.scheduled_end_time)) {
        newErrors.scheduled_end_time = 'End time must be after start time';
      }
    }

    if (!formData?.vendor_id) {
      newErrors.vendor_id = 'Please select a vendor';
    }

    setErrors(newErrors);
    return Object.keys(newErrors)?.length === 0;
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear field error when user starts typing
    if (errors?.[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const handleTimeChange = (field, value) => {
    handleInputChange(field, value);
    
    // Auto-adjust end time if start time changes
    if (field === 'scheduled_start_time' && value) {
      const startDate = new Date(value);
      const endDate = new Date(startDate.getTime() + (2 * 60 * 60 * 1000)); // Default 2 hours
      handleInputChange('scheduled_end_time', endDate?.toISOString()?.slice(0, 16));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    if (hasConflict && !window.confirm('There is a scheduling conflict. Do you want to proceed anyway?')) {
      return;
    }

    setLoading(true);
    try {
      // Prepare update data
      const updates = {
        title: formData?.title,
        description: formData?.description,
        scheduled_start_time: new Date(formData.scheduled_start_time)?.toISOString(),
        scheduled_end_time: new Date(formData.scheduled_end_time)?.toISOString(),
        vendor_id: formData?.vendor_id,
        location: formData?.location,
        color_code: formData?.color_code,
        priority: formData?.priority,
        job_status: formData?.job_status,
        calendar_notes: formData?.calendar_notes
      };

      const success = await onUpdate?.(job?.id, updates);
      
      if (success) {
        onClose?.();
      }

    } catch (error) {
      console.error('Error updating job:', error);
      alert('Failed to update job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this job? This action cannot be undone.')) {
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase?.from('jobs')?.delete()?.eq('id', job?.id);

      if (error) {
        throw error;
      }

      onClose?.();
    } catch (error) {
      console.error('Error deleting job:', error);
      alert('Failed to delete job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusOptions = () => [
    { value: 'pending', label: 'Not Started', color: 'text-gray-600' },
    { value: 'scheduled', label: 'Scheduled', color: 'text-blue-600' },
    { value: 'in_progress', label: 'In Progress', color: 'text-yellow-600' },
    { value: 'quality_check', label: 'Quality Check', color: 'text-purple-600' },
    { value: 'delivered', label: 'Delivered', color: 'text-green-600' },
    { value: 'completed', label: 'Completed', color: 'text-green-700' },
    { value: 'cancelled', label: 'Cancelled', color: 'text-red-600' }
  ];

  const getPriorityOptions = () => [
    { value: 'low', label: 'Low', color: 'text-green-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'high', label: 'High', color: 'text-orange-600' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            Schedule Job: {job?.title}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Conflict Warning */}
        {hasConflict && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Scheduling Conflict Detected
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  The selected vendor already has a job scheduled during this time.
                  {conflictDetails && (
                    <span className="block mt-1">
                      Conflicting job: "{conflictDetails?.title}"
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Job Title *
              </label>
              <input
                type="text"
                value={formData?.title}
                onChange={(e) => handleInputChange('title', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors?.title ? 'border-red-300' : 'border-gray-300'}
                `}
                placeholder="Enter job title"
              />
              {errors?.title && (
                <p className="text-red-600 text-sm mt-1">{errors?.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData?.description}
                onChange={(e) => handleInputChange('description', e?.target?.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter job description"
              />
            </div>

            {/* Start Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                Start Time *
              </label>
              <input
                type="datetime-local"
                value={formData?.scheduled_start_time}
                onChange={(e) => handleTimeChange('scheduled_start_time', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors?.scheduled_start_time ? 'border-red-300' : 'border-gray-300'}
                `}
              />
              {errors?.scheduled_start_time && (
                <p className="text-red-600 text-sm mt-1">{errors?.scheduled_start_time}</p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" />
                End Time *
              </label>
              <input
                type="datetime-local"
                value={formData?.scheduled_end_time}
                onChange={(e) => handleInputChange('scheduled_end_time', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors?.scheduled_end_time ? 'border-red-300' : 'border-gray-300'}
                `}
              />
              {errors?.scheduled_end_time && (
                <p className="text-red-600 text-sm mt-1">{errors?.scheduled_end_time}</p>
              )}
            </div>

            {/* Vendor */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" />
                Vendor *
              </label>
              <select
                value={formData?.vendor_id}
                onChange={(e) => handleInputChange('vendor_id', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors?.vendor_id ? 'border-red-300' : 'border-gray-300'}
                `}
              >
                <option value="">Select vendor</option>
                {vendors?.map(vendor => (
                  <option key={vendor?.id} value={vendor?.id}>
                    {vendor?.name}
                  </option>
                ))}
              </select>
              {errors?.vendor_id && (
                <p className="text-red-600 text-sm mt-1">{errors?.vendor_id}</p>
              )}
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" />
                Location
              </label>
              <input
                type="text"
                value={formData?.location}
                onChange={(e) => handleInputChange('location', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Service Bay 1"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                value={formData?.job_status}
                onChange={(e) => handleInputChange('job_status', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {getStatusOptions()?.map(option => (
                  <option key={option?.value} value={option?.value}>
                    {option?.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                value={formData?.priority}
                onChange={(e) => handleInputChange('priority', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {getPriorityOptions()?.map(option => (
                  <option key={option?.value} value={option?.value}>
                    {option?.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calendar Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  type="color"
                  value={formData?.color_code}
                  onChange={(e) => handleInputChange('color_code', e?.target?.value)}
                  className="h-10 w-16 border border-gray-300 rounded cursor-pointer"
                />
                <span className="text-sm text-gray-600">
                  Choose a color for calendar display
                </span>
              </div>
            </div>

            {/* Calendar Notes */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Calendar Notes
              </label>
              <textarea
                value={formData?.calendar_notes}
                onChange={(e) => handleInputChange('calendar_notes', e?.target?.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Internal notes for scheduling..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
            <button
              type="button"
              onClick={handleDelete}
              className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              disabled={loading}
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete Job</span>
            </button>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                <span>{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobScheduleModal;