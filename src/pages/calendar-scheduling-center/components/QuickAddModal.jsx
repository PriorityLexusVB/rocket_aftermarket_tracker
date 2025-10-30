import React, { useState, useEffect } from 'react';
import { X, Clock, User, Plus } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';

const QuickAddModal = ({ 
  vendors = [], 
  onClose, 
  onSuccess 
}) => {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduled_start_time: '',
    scheduled_end_time: '',
    vendor_id: '',
    vehicle_id: '',
    location: 'Service Bay 1',
    priority: 'medium',
    estimated_hours: 2
  });
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  // Load vehicles for selection
  useEffect(() => {
    loadVehicles();
    
    // Set default start time to next hour
    const now = new Date();
    const nextHour = new Date(now);
    nextHour?.setHours(nextHour?.getHours() + 1, 0, 0, 0);
    
    const endTime = new Date(nextHour);
    endTime?.setHours(endTime?.getHours() + 2); // Default 2-hour duration
    
    setFormData(prev => ({
      ...prev,
      scheduled_start_time: nextHour?.toISOString()?.slice(0, 16),
      scheduled_end_time: endTime?.toISOString()?.slice(0, 16)
    }));
  }, []);

  const loadVehicles = async () => {
    try {
      const { data, error } = await supabase?.from('vehicles')?.select('id, make, model, year, owner_name, stock_number')?.eq('vehicle_status', 'active')?.order('make', { ascending: true });

      if (error) {
        console.error('Error loading vehicles:', error);
        return;
      }

      setVehicles(data || []);
    } catch (error) {
      console.error('Error in loadVehicles:', error);
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

    if (!formData?.vehicle_id) {
      newErrors.vehicle_id = 'Please select a vehicle';
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
    
    // Auto-adjust end time based on estimated hours
    if (field === 'scheduled_start_time' && value) {
      const startDate = new Date(value);
      const endDate = new Date(startDate.getTime() + (formData.estimated_hours * 60 * 60 * 1000));
      handleInputChange('scheduled_end_time', endDate?.toISOString()?.slice(0, 16));
    }
  };

  const handleEstimatedHoursChange = (hours) => {
    handleInputChange('estimated_hours', hours);
    
    // Update end time based on new duration
    if (formData?.scheduled_start_time) {
      const startDate = new Date(formData.scheduled_start_time);
      const endDate = new Date(startDate.getTime() + (hours * 60 * 60 * 1000));
      handleInputChange('scheduled_end_time', endDate?.toISOString()?.slice(0, 16));
    }
  };

  const handleSubmit = async (e) => {
    e?.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setLoading(true);
    try {
      // Generate job number
      const { data: jobNumber, error: jobNumberError } = await supabase?.rpc('generate_job_number');

      if (jobNumberError) {
        throw jobNumberError;
      }

      // Create the job
      const jobData = {
        job_number: jobNumber,
        title: formData?.title,
        description: formData?.description,
        vehicle_id: formData?.vehicle_id,
        vendor_id: formData?.vendor_id,
        scheduled_start_time: new Date(formData.scheduled_start_time)?.toISOString(),
        scheduled_end_time: new Date(formData.scheduled_end_time)?.toISOString(),
        estimated_hours: formData?.estimated_hours,
        location: formData?.location,
        priority: formData?.priority,
        job_status: 'scheduled',
        color_code: '#3b82f6', // Default blue
        created_by: user?.id
      };

      const { data, error } = await supabase?.from('jobs')?.insert([jobData])?.select()?.single();

      if (error) {
        throw error;
      }

      // Log activity
      await supabase?.rpc('log_activity', {
        entity_type: 'job',
        entity_id: data?.id,
        action: 'created',
        description: `Job "${formData?.title}" scheduled for ${new Date(formData.scheduled_start_time)?.toLocaleDateString()}`
      });

      onSuccess?.();
      onClose?.();

    } catch (error) {
      console.error('Error creating job:', error);
      alert('Failed to create job. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const getPriorityOptions = () => [
    { value: 'low', label: 'Low', color: 'text-green-600' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-600' },
    { value: 'high', label: 'High', color: 'text-orange-600' },
    { value: 'urgent', label: 'Urgent', color: 'text-red-600' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-xl w-full max-h-screen overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900 flex items-center">
            <Plus className="h-5 w-5 mr-2" />
            Quick Schedule Job
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-4">
            {/* Title */}
            <div>
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
                placeholder="e.g., Oil Change, Brake Inspection"
              />
              {errors?.title && (
                <p className="text-red-600 text-sm mt-1">{errors?.title}</p>
              )}
            </div>

            {/* Vehicle */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vehicle *
              </label>
              <select
                value={formData?.vehicle_id}
                onChange={(e) => handleInputChange('vehicle_id', e?.target?.value)}
                className={`
                  w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500
                  ${errors?.vehicle_id ? 'border-red-300' : 'border-gray-300'}
                `}
              >
                <option value="">Select vehicle</option>
                {vehicles?.map(vehicle => (
                  <option key={vehicle?.id} value={vehicle?.id}>
                    {vehicle?.year} {vehicle?.make} {vehicle?.model} 
                    {vehicle?.stock_number && ` (${vehicle?.stock_number})`}
                    {vehicle?.owner_name && ` - ${vehicle?.owner_name}`}
                  </option>
                ))}
              </select>
              {errors?.vehicle_id && (
                <p className="text-red-600 text-sm mt-1">{errors?.vehicle_id}</p>
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
                    {vendor?.specialty && ` - ${vendor?.specialty}`}
                  </option>
                ))}
              </select>
              {errors?.vendor_id && (
                <p className="text-red-600 text-sm mt-1">{errors?.vendor_id}</p>
              )}
            </div>

            {/* Time Scheduling */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {/* Estimated Hours */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Estimated Duration (Hours)
              </label>
              <div className="flex space-x-2">
                {[0.5, 1, 2, 4, 8]?.map(hours => (
                  <button
                    key={hours}
                    type="button"
                    onClick={() => handleEstimatedHoursChange(hours)}
                    className={`
                      px-3 py-1 text-sm border rounded-lg transition-colors
                      ${formData?.estimated_hours === hours
                        ? 'bg-blue-100 border-blue-300 text-blue-700' :'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                      }
                    `}
                  >
                    {hours}h
                  </button>
                ))}
                <input
                  type="number"
                  min="0.5"
                  max="24"
                  step="0.5"
                  value={formData?.estimated_hours}
                  onChange={(e) => handleEstimatedHoursChange(parseFloat(e?.target?.value) || 1)}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            {/* Priority & Location */}
            <div className="grid grid-cols-2 gap-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData?.description}
                onChange={(e) => handleInputChange('description', e?.target?.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter job description or special instructions..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200 mt-6">
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
              <Plus className="h-4 w-4" />
              <span>{loading ? 'Creating...' : 'Schedule Job'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuickAddModal;