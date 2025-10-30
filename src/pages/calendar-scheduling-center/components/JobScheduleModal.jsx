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

  // Smart defaults helper functions
  const computeStartDefault = () => {
    const now = new Date();
    const localHour = now?.getHours();
    const localMinute = now?.getMinutes();

    // Round to next 30-min slot
    let roundedMinutes = Math.ceil(localMinute / 30) * 30;
    let adjustedHour = localHour;

    if (roundedMinutes >= 60) {
      adjustedHour += Math.floor(roundedMinutes / 60);
      roundedMinutes = roundedMinutes % 60;
    }

    // If >= 16:00 local, use tomorrow 09:00
    if (adjustedHour >= 16) {
      const tomorrow = new Date(now);
      tomorrow?.setDate(tomorrow?.getDate() + 1);
      tomorrow?.setHours(9, 0, 0, 0);
      return tomorrow;
    }

    const defaultStart = new Date(now);
    defaultStart?.setHours(adjustedHour, roundedMinutes, 0, 0);
    return defaultStart;
  };

  const getDefaultLocation = (vendorId, vendors) => {
    if (!vendorId) return 'In-House Service Bay';
    
    const selectedVendor = vendors?.find(v => v?.id === vendorId);
    if (selectedVendor) {
      return `${selectedVendor?.name} - Off-Site`;
    }
    
    return 'Off-Site Service';
  };

  // Initialize form with job data and smart defaults
  useEffect(() => {
    if (job) {
      // Existing job - use current data
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
        location: job?.location || getDefaultLocation(job?.vendor_id, vendors),
        color_code: job?.color_code || '#3b82f6',
        priority: job?.priority || 'medium',
        job_status: job?.job_status || 'scheduled',
        calendar_notes: job?.calendar_notes || ''
      });
    } else {
      // New job - apply smart defaults
      const startDefault = computeStartDefault();
      const endDefault = new Date(startDefault.getTime() + (120 * 60 * 1000)); // +120 minutes

      setFormData({
        title: '',
        description: '',
        scheduled_start_time: startDefault?.toISOString()?.slice(0, 16),
        scheduled_end_time: endDefault?.toISOString()?.slice(0, 16),
        vendor_id: job?.vendor_id || '', // Prefill from job if available
        location: getDefaultLocation(job?.vendor_id, vendors),
        color_code: '#3b82f6',
        priority: 'medium',
        job_status: 'scheduled',
        calendar_notes: ''
      });
    }
  }, [job, vendors]);

  // Update location when vendor changes
  useEffect(() => {
    if (formData?.vendor_id !== (job?.vendor_id || '')) {
      setFormData(prev => ({
        ...prev,
        location: getDefaultLocation(formData?.vendor_id, vendors)
      }));
    }
  }, [formData?.vendor_id, vendors, job?.vendor_id]);

  // Enhanced conflict checking with detailed conflict information
  useEffect(() => {
    if (formData?.vendor_id && formData?.scheduled_start_time && formData?.scheduled_end_time) {
      checkSchedulingConflict();
    }
  }, [formData?.vendor_id, formData?.scheduled_start_time, formData?.scheduled_end_time]);

  const checkSchedulingConflict = async () => {
    if (!formData?.vendor_id || !formData?.scheduled_start_time || !formData?.scheduled_end_time) {
      setHasConflict(false);
      setConflictDetails(null);
      return;
    }

    try {
      const startUtc = new Date(formData.scheduled_start_time)?.toISOString();
      const endUtc = new Date(formData.scheduled_end_time)?.toISOString();

      // Enhanced conflict check with detailed information
      const { data: conflicts, error } = await supabase?.from('jobs')?.select(`
          id,
          title,
          scheduled_start_time,
          scheduled_end_time,
          transactions!inner(customer_name)
        `)?.eq('vendor_id', formData?.vendor_id)?.neq('id', job?.id || '')?.lt('scheduled_start_time', endUtc)?.gt('scheduled_end_time', startUtc)?.limit(1);

      if (error) {
        console.error('Error checking conflicts:', error);
        return;
      }

      if (conflicts?.length > 0) {
        setHasConflict(true);
        const conflict = conflicts?.[0];
        
        // Format conflict details nicely
        const startLocal = new Date(conflict.scheduled_start_time)?.toLocaleString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });
        
        const endLocal = new Date(conflict.scheduled_end_time)?.toLocaleString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        setConflictDetails({
          id: conflict?.id,
          customer_name: conflict?.transactions?.[0]?.customer_name || 'Other job',
          start_local: startLocal,
          end_local: endLocal,
          timeRange: `${startLocal}–${endLocal}`
        });
      } else {
        setHasConflict(false);
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
    
    // Auto-adjust end time if start time changes (maintain 120-minute duration)
    if (field === 'scheduled_start_time' && value) {
      const startDate = new Date(value);
      const endDate = new Date(startDate.getTime() + (120 * 60 * 1000)); // 120 minutes default
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
            {job ? `Schedule Job: ${job?.title}` : 'Schedule New Job'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Enhanced Conflict Warning */}
        {hasConflict && conflictDetails && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-4" role="alert" aria-live="polite">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-medium text-red-800">
                  Scheduling Conflict Detected
                </h3>
                <p className="text-sm text-red-700 mt-1">
                  The selected vendor already has a job scheduled during this time.
                </p>
                <div className="mt-2 p-2 bg-red-100 rounded text-xs text-red-800">
                  <strong>Conflict with:</strong> {conflictDetails?.customer_name}<br />
                  <strong>Time:</strong> {conflictDetails?.timeRange}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Title */}
            <div className="md:col-span-2">
              <label htmlFor="job-title" className="block text-sm font-medium text-gray-700 mb-2">
                Job Title *
              </label>
              <input
                id="job-title"
                type="text"
                value={formData?.title}
                onChange={(e) => handleInputChange('title', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation
                  ${errors?.title ? 'border-red-300' : 'border-gray-300'}
                `}
                placeholder="Enter job title"
                aria-describedby={errors?.title ? "job-title-error" : undefined}
                aria-invalid={errors?.title ? 'true' : 'false'}
              />
              {errors?.title && (
                <p id="job-title-error" className="text-red-600 text-sm mt-1" role="alert">{errors?.title}</p>
              )}
            </div>

            {/* Description */}
            <div className="md:col-span-2">
              <label htmlFor="job-description" className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                id="job-description"
                value={formData?.description}
                onChange={(e) => handleInputChange('description', e?.target?.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation"
                placeholder="Enter job description"
              />
            </div>

            {/* Vendor (moved up for better flow) */}
            <div className="md:col-span-2">
              <label htmlFor="vendor-select" className="block text-sm font-medium text-gray-700 mb-2">
                <User className="inline h-4 w-4 mr-1" aria-hidden="true" />
                Vendor *
              </label>
              <select
                id="vendor-select"
                value={formData?.vendor_id}
                onChange={(e) => handleInputChange('vendor_id', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation
                  ${errors?.vendor_id ? 'border-red-300' : 'border-gray-300'}
                `}
                aria-describedby={errors?.vendor_id ? "vendor-select-error" : undefined}
                aria-invalid={errors?.vendor_id ? 'true' : 'false'}
              >
                <option value="">Select vendor</option>
                {vendors?.map(vendor => (
                  <option key={vendor?.id} value={vendor?.id}>
                    {vendor?.name}
                  </option>
                ))}
              </select>
              {errors?.vendor_id && (
                <p id="vendor-select-error" className="text-red-600 text-sm mt-1" role="alert">{errors?.vendor_id}</p>
              )}
            </div>

            {/* Start Time */}
            <div>
              <label htmlFor="start-time" className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" aria-hidden="true" />
                Start Time *
              </label>
              <input
                id="start-time"
                type="datetime-local"
                value={formData?.scheduled_start_time}
                onChange={(e) => handleTimeChange('scheduled_start_time', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation
                  ${errors?.scheduled_start_time ? 'border-red-300' : 'border-gray-300'}
                `}
                aria-describedby={errors?.scheduled_start_time ? "start-time-error" : undefined}
                aria-invalid={errors?.scheduled_start_time ? 'true' : 'false'}
              />
              {errors?.scheduled_start_time && (
                <p id="start-time-error" className="text-red-600 text-sm mt-1" role="alert">{errors?.scheduled_start_time}</p>
              )}
            </div>

            {/* End Time */}
            <div>
              <label htmlFor="end-time" className="block text-sm font-medium text-gray-700 mb-2">
                <Clock className="inline h-4 w-4 mr-1" aria-hidden="true" />
                End Time *
              </label>
              <input
                id="end-time"
                type="datetime-local"
                value={formData?.scheduled_end_time}
                onChange={(e) => handleInputChange('scheduled_end_time', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation
                  ${errors?.scheduled_end_time ? 'border-red-300' : 'border-gray-300'}
                `}
                aria-describedby={errors?.scheduled_end_time ? "end-time-error" : "duration-info"}
                aria-invalid={errors?.scheduled_end_time ? 'true' : 'false'}
              />
              {errors?.scheduled_end_time && (
                <p id="end-time-error" className="text-red-600 text-sm mt-1" role="alert">{errors?.scheduled_end_time}</p>
              )}
              <p id="duration-info" className="text-xs text-gray-500 mt-1">
                Duration: {formData?.scheduled_start_time && formData?.scheduled_end_time ? 
                  Math.round((new Date(formData.scheduled_end_time) - new Date(formData.scheduled_start_time)) / (1000 * 60)) + ' minutes' : '—'
                }
              </p>
            </div>

            {/* Location (auto-populated) */}
            <div className="md:col-span-2">
              <label htmlFor="job-location" className="block text-sm font-medium text-gray-700 mb-2">
                <MapPin className="inline h-4 w-4 mr-1" aria-hidden="true" />
                Location
              </label>
              <input
                id="job-location"
                type="text"
                value={formData?.location}
                onChange={(e) => handleInputChange('location', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation"
                placeholder="Service location"
                aria-describedby="location-help"
              />
              <p id="location-help" className="text-xs text-gray-500 mt-1">
                Location is auto-populated based on vendor selection
              </p>
            </div>

            {/* Status */}
            <div>
              <label htmlFor="job-status" className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <select
                id="job-status"
                value={formData?.job_status}
                onChange={(e) => handleInputChange('job_status', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation"
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
              <label htmlFor="job-priority" className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <select
                id="job-priority"
                value={formData?.priority}
                onChange={(e) => handleInputChange('priority', e?.target?.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation"
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
              <label htmlFor="calendar-color" className="block text-sm font-medium text-gray-700 mb-2">
                Calendar Color
              </label>
              <div className="flex items-center space-x-3">
                <input
                  id="calendar-color"
                  type="color"
                  value={formData?.color_code}
                  onChange={(e) => handleInputChange('color_code', e?.target?.value)}
                  className="h-10 w-16 border border-gray-300 rounded cursor-pointer min-h-[44px] touch-manipulation"
                  aria-describedby="color-help"
                />
                <span id="color-help" className="text-sm text-gray-600">
                  Choose a color for calendar display
                </span>
              </div>
            </div>

            {/* Calendar Notes */}
            <div className="md:col-span-2">
              <label htmlFor="calendar-notes" className="block text-sm font-medium text-gray-700 mb-2">
                Calendar Notes
              </label>
              <textarea
                id="calendar-notes"
                value={formData?.calendar_notes}
                onChange={(e) => handleInputChange('calendar_notes', e?.target?.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 min-h-[44px] touch-manipulation"
                placeholder="Internal notes for scheduling..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-6 border-t border-gray-200 mt-6">
            {job && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center space-x-2 px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors min-h-[44px] touch-manipulation"
                disabled={loading}
                aria-label="Delete this job permanently"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                <span>Delete Job</span>
              </button>
            )}

            <div className={`flex space-x-3 ${!job ? 'ml-auto' : ''}`}>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors min-h-[44px] touch-manipulation"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 min-h-[44px] touch-manipulation"
                aria-describedby={loading ? "save-status" : undefined}
              >
                <Save className="h-4 w-4" aria-hidden="true" />
                <span id="save-status">{loading ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobScheduleModal;