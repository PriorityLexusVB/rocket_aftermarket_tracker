import React, { useState } from 'react';
import { X, Car, Calendar, Clock, User, Phone, MapPin, Building2, Package, MessageSquare, Camera, Copy, Play, CheckCircle, XCircle, RotateCcw, AlertTriangle } from 'lucide-react';
import { formatTime, isOverdue, getStatusBadge } from '../../../lib/time';
import Icon from '../../../components/AppIcon';


const JobDrawer = ({ job, isOpen, onClose, onStatusUpdate }) => {
  const [activeTab, setActiveTab] = useState('details');
  const [notes, setNotes] = useState('');

  if (!isOpen || !job) return null;

  const statusBadge = getStatusBadge(job?.job_status);
  const overdue = isOverdue(job?.promised_date);

  const quickActions = [
    {
      id: 'start',
      label: 'Start',
      icon: Play,
      color: 'bg-green-600 hover:bg-green-700 text-white',
      action: () => onStatusUpdate?.(job?.id, 'in_progress')
    },
    {
      id: 'complete',
      label: 'Complete',
      icon: CheckCircle,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      action: () => onStatusUpdate?.(job?.id, 'completed')
    },
    {
      id: 'no_show',
      label: 'No-Show',
      icon: XCircle,
      color: 'bg-gray-600 hover:bg-gray-700 text-white',
      action: () => onStatusUpdate?.(job?.id, 'no_show')
    },
    {
      id: 'reschedule',
      label: 'Reschedule',
      icon: RotateCcw,
      color: 'bg-orange-600 hover:bg-orange-700 text-white',
      action: () => {
        // Open reschedule modal
        console.log('Open reschedule modal');
      }
    }
  ];

  const tabs = [
    { id: 'details', label: 'Details', icon: Package },
    { id: 'customer', label: 'Customer', icon: User },
    { id: 'timeline', label: 'Timeline/Notes', icon: MessageSquare },
    { id: 'photos', label: 'Photos', icon: Camera }
  ];

  const renderDetailsTab = () => (
    <div className="space-y-6">
      {/* Job Info */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Job Information</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Job Number
            </label>
            <div className="mt-1 flex items-center">
              <span className="text-sm font-mono">{job?.job_number}</span>
              <button className="ml-2 p-1 hover:bg-gray-100 rounded">
                <Copy className="h-3 w-3 text-gray-400" />
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Priority
            </label>
            <div className="mt-1">
              <span className={`
                inline-flex px-2 py-1 text-xs font-medium rounded-full
                ${job?.priority === 'high' ? 'bg-red-100 text-red-800' :
                  job?.priority === 'medium'? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                }
              `}>
                {job?.priority?.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Service Details */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Service Details</h4>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div>
            <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Service Type
            </label>
            <div className="mt-1 text-sm text-gray-900">{job?.title}</div>
          </div>
          {job?.description && (
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Description
              </label>
              <div className="mt-1 text-sm text-gray-900">{job?.description}</div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Estimated Hours
              </label>
              <div className="mt-1 text-sm text-gray-900">{job?.estimated_hours || 'N/A'}</div>
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                Estimated Cost
              </label>
              <div className="mt-1 text-sm text-gray-900">
                ${job?.estimated_cost ? Number(job?.estimated_cost)?.toFixed(2) : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Location & Scheduling */}
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Location & Scheduling</h4>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center">
            {job?.vendor_id ? (
              <>
                <Building2 className="h-4 w-4 text-orange-500 mr-2" />
                <span className="text-sm">Off-Site @ {job?.vendor_name}</span>
              </>
            ) : (
              <>
                <MapPin className="h-4 w-4 text-green-500 mr-2" />
                <span className="text-sm">On-Site</span>
              </>
            )}
          </div>
          
          {job?.scheduled_start_time && (
            <div className="flex items-center">
              <Clock className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-sm">
                {formatTime(job?.scheduled_start_time)} - {formatTime(job?.scheduled_end_time)}
              </span>
            </div>
          )}
          
          <div className={`flex items-center ${overdue ? 'text-red-600' : ''}`}>
            <Calendar className="h-4 w-4 mr-2" />
            <span className="text-sm">
              Promise Date: {new Date(job?.promised_date)?.toLocaleDateString()}
            </span>
            {overdue && (
              <AlertTriangle className="h-4 w-4 ml-2 text-red-500" />
            )}
          </div>
        </div>
      </div>
    </div>
  );

  const renderCustomerTab = () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Vehicle Information</h4>
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center mb-2">
            <Car className="h-4 w-4 text-gray-400 mr-2" />
            <span className="text-sm font-medium">{job?.vehicle_info}</span>
          </div>
          {/* Add more vehicle details from the vehicles table if needed */}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Customer Contact</h4>
        <div className="bg-gray-50 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-sm">Customer Name</span>
            </div>
            <span className="text-sm text-gray-600">Available in vehicle record</span>
          </div>
          
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Phone className="h-4 w-4 text-gray-400 mr-2" />
              <span className="text-sm">Phone</span>
            </div>
            <span className="text-sm text-gray-600">Available in vehicle record</span>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTimelineTab = () => (
    <div className="space-y-4">
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Recent Updates</h4>
        <div className="space-y-3">
          <div className="border-l-4 border-blue-400 pl-4 py-2">
            <div className="text-sm font-medium text-gray-900">Job Created</div>
            <div className="text-xs text-gray-500">
              {new Date(job?.created_at)?.toLocaleString()}
            </div>
          </div>
          
          {job?.updated_at && job?.updated_at !== job?.created_at && (
            <div className="border-l-4 border-yellow-400 pl-4 py-2">
              <div className="text-sm font-medium text-gray-900">Last Updated</div>
              <div className="text-xs text-gray-500">
                {new Date(job?.updated_at)?.toLocaleString()}
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <h4 className="font-medium text-gray-900 mb-3">Add Note</h4>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e?.target?.value)}
          placeholder="Add a note about this job..."
          className="w-full h-24 border border-gray-300 rounded-lg p-3 text-sm"
        />
        <button className="mt-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          Add Note
        </button>
      </div>
    </div>
  );

  const renderPhotosTab = () => (
    <div className="space-y-4">
      <div className="text-center py-8 text-gray-500">
        <Camera className="h-8 w-8 mx-auto mb-3 text-gray-400" />
        <div className="text-sm">No photos uploaded yet</div>
        <button className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
          Upload Photos
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className={`w-3 h-3 rounded-full mr-3 ${
                  job?.vendor_id ? 'bg-orange-500' : 'bg-green-500'
                }`}></div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">
                    {job?.job_number}
                  </h2>
                  <div className="text-sm text-gray-600 flex items-center mt-1">
                    {job?.vehicle_info}
                    <span className={`
                      ml-3 px-2 py-1 rounded-full text-xs font-medium
                      ${statusBadge?.bg || 'bg-gray-100'} 
                      ${statusBadge?.textColor || 'text-gray-800'}
                    `}>
                      {statusBadge?.label || job?.job_status?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center space-x-2 mt-4">
              {quickActions?.map(action => {
                const Icon = action?.icon;
                return (
                  <button
                    key={action?.id}
                    onClick={action?.action}
                    className={`
                      flex items-center px-3 py-2 rounded-lg text-sm font-medium
                      ${action?.color} transition-colors duration-200
                    `}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {action?.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Subheader */}
          <div className="px-6 py-3 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center text-sm text-gray-600 space-x-4">
              <div className="flex items-center">
                {job?.vendor_id ? (
                  <>
                    <Building2 className="h-4 w-4 mr-1" />
                    {job?.vendor_name}
                  </>
                ) : (
                  <>
                    <MapPin className="h-4 w-4 mr-1" />
                    On-Site
                  </>
                )}
              </div>
              <div className="flex items-center">
                <Calendar className="h-4 w-4 mr-1" />
                Promise: {new Date(job?.promised_date)?.toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-6 py-0 bg-white border-b border-gray-200">
            <div className="flex space-x-8">
              {tabs?.map(tab => {
                const Icon = tab?.icon;
                return (
                  <button
                    key={tab?.id}
                    onClick={() => setActiveTab(tab?.id)}
                    className={`
                      flex items-center py-3 border-b-2 text-sm font-medium
                      ${activeTab === tab?.id 
                        ? 'border-blue-500 text-blue-600' :'border-transparent text-gray-500 hover:text-gray-700'
                      }
                    `}
                  >
                    <Icon className="h-4 w-4 mr-2" />
                    {tab?.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {activeTab === 'details' && renderDetailsTab()}
            {activeTab === 'customer' && renderCustomerTab()}
            {activeTab === 'timeline' && renderTimelineTab()}
            {activeTab === 'photos' && renderPhotosTab()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JobDrawer;