import React, { useState, useMemo } from 'react';
import { 
  X, 
  Download, 
  Copy, 
  FileText, 
  Calendar,
  Clock,
  Car,
  Building2,
  MapPin,
  Play,
  CheckCircle,
  XCircle,
  RotateCcw
} from 'lucide-react';
import { formatTime, getStatusBadge } from '../../../lib/time';

const RoundUpModal = ({ isOpen, onClose, jobs, type, onTypeChange }) => {
  const [selectedJobs, setSelectedJobs] = useState(new Set());

  const groupedJobs = useMemo(() => {
    if (!jobs?.length) return {};

    switch (type) {
      case 'daily':
        return groupJobsByDay(jobs);
      case 'weekly':
        return groupJobsByWeek(jobs);
      case 'monthly':
        return groupJobsByMonth(jobs);
      default:
        return groupJobsByDay(jobs);
    }
  }, [jobs, type]);

  const groupJobsByDay = (jobList) => {
    const today = new Date();
    today?.setHours(0, 0, 0, 0);
    
    const todayJobs = jobList?.filter(job => {
      const jobDate = new Date(job?.scheduled_start_time);
      return jobDate?.toDateString() === today?.toDateString();
    });

    return {
      'Today': {
        onSite: todayJobs?.filter(job => !job?.vendor_id),
        vendors: groupByVendor(todayJobs?.filter(job => job?.vendor_id))
      }
    };
  };

  const groupJobsByWeek = (jobList) => {
    const weekDays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const result = {};

    weekDays?.forEach(day => {
      const dayJobs = jobList?.filter(job => {
        const jobDate = new Date(job?.scheduled_start_time);
        const dayOfWeek = jobDate?.getDay();
        const dayIndex = weekDays?.indexOf(day);
        return dayOfWeek === (dayIndex + 1) % 7; // Adjust for Monday start
      });

      if (dayJobs?.length > 0) {
        result[day] = {
          onSite: dayJobs?.filter(job => !job?.vendor_id),
          vendors: groupByVendor(dayJobs?.filter(job => job?.vendor_id))
        };
      }
    });

    return result;
  };

  const groupJobsByMonth = (jobList) => {
    const weeks = {};
    jobList?.forEach(job => {
      const jobDate = new Date(job?.scheduled_start_time);
      const weekNumber = Math.ceil(jobDate?.getDate() / 7);
      const weekKey = `Week ${weekNumber}`;
      
      if (!weeks?.[weekKey]) {
        weeks[weekKey] = {
          onSite: [],
          vendors: {}
        };
      }
      
      if (job?.vendor_id) {
        if (!weeks?.[weekKey]?.vendors?.[job?.vendor_name]) {
          weeks[weekKey].vendors[job?.vendor_name] = [];
        }
        weeks?.[weekKey]?.vendors?.[job?.vendor_name]?.push(job);
      } else {
        weeks?.[weekKey]?.onSite?.push(job);
      }
    });

    return weeks;
  };

  const groupByVendor = (jobList) => {
    return jobList?.reduce((acc, job) => {
      const vendorName = job?.vendor_name || 'Unassigned';
      if (!acc?.[vendorName]) {
        acc[vendorName] = [];
      }
      acc?.[vendorName]?.push(job);
      return acc;
    }, {});
  };

  const handleJobAction = (jobId, action) => {
    console.log(`${action} job ${jobId}`);
    // Implement job actions
  };

  const handleSelectJob = (jobId) => {
    const newSelected = new Set(selectedJobs);
    if (newSelected?.has(jobId)) {
      newSelected?.delete(jobId);
    } else {
      newSelected?.add(jobId);
    }
    setSelectedJobs(newSelected);
  };

  const handleExport = (format) => {
    console.log(`Export ${format} for selected jobs:`, Array.from(selectedJobs));
    // Implement export functionality
  };

  const renderJobRow = (job) => {
    const statusBadge = getStatusBadge(job?.job_status);
    
    return (
      <div key={job?.id} className="flex items-center py-3 border-b border-gray-100 last:border-b-0">
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={selectedJobs?.has(job?.id)}
          onChange={() => handleSelectJob(job?.id)}
          className="mr-3 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        {/* Job Info */}
        <div className="flex-1 grid grid-cols-6 gap-4 items-center text-sm">
          {/* Time */}
          <div className="flex items-center text-gray-900">
            <Clock className="h-3 w-3 mr-1 text-gray-400" />
            {job?.scheduled_start_time 
              ? `${formatTime(job?.scheduled_start_time)}–${formatTime(job?.scheduled_end_time)}`
              : 'Unscheduled'
            }
          </div>

          {/* Stock & Product */}
          <div className="flex items-center text-gray-900">
            <Car className="h-3 w-3 mr-1 text-gray-400" />
            {job?.job_number?.split('-')?.pop()} | {job?.title}
          </div>

          {/* Promise Date */}
          <div className="flex items-center text-gray-600">
            <Calendar className="h-3 w-3 mr-1 text-gray-400" />
            {new Date(job?.promised_date)?.toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric' 
            })}
          </div>

          {/* Location */}
          <div className="flex items-center text-gray-600">
            {job?.vendor_id ? (
              <>
                <Building2 className="h-3 w-3 mr-1 text-orange-500" />
                {job?.vendor_name}
              </>
            ) : (
              <>
                <MapPin className="h-3 w-3 mr-1 text-green-500" />
                On-Site
              </>
            )}
          </div>

          {/* Status */}
          <div className={`
            inline-flex px-2 py-1 rounded-full text-xs font-medium
            ${statusBadge?.bg || 'bg-gray-100'} 
            ${statusBadge?.textColor || 'text-gray-800'}
          `}>
            {statusBadge?.label || job?.job_status?.toUpperCase()}
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleJobAction(job?.id, 'start')}
              className="p-1 hover:bg-green-100 rounded text-green-600"
              title="Start"
            >
              <Play className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleJobAction(job?.id, 'complete')}
              className="p-1 hover:bg-blue-100 rounded text-blue-600"
              title="Complete"
            >
              <CheckCircle className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleJobAction(job?.id, 'no_show')}
              className="p-1 hover:bg-gray-100 rounded text-gray-600"
              title="No-Show"
            >
              <XCircle className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleJobAction(job?.id, 'reschedule')}
              className="p-1 hover:bg-orange-100 rounded text-orange-600"
              title="Reschedule"
            >
              <RotateCcw className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderJobGroup = (groupName, groupData) => {
    return (
      <div key={groupName} className="mb-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
          <Calendar className="h-5 w-5 mr-2 text-gray-600" />
          {groupName}
        </h3>

        {/* On-Site Jobs */}
        {groupData?.onSite?.length > 0 && (
          <div className="mb-6">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
              <h4 className="font-medium text-green-900">On-Site (PLV)</h4>
              <span className="ml-2 text-sm text-gray-600">
                ({groupData?.onSite?.length} jobs)
              </span>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              {groupData?.onSite?.map(renderJobRow)}
            </div>
          </div>
        )}

        {/* Vendor Jobs */}
        {Object.entries(groupData?.vendors || {})?.map(([vendorName, vendorJobs]) => (
          <div key={vendorName} className="mb-6">
            <div className="flex items-center mb-3">
              <div className="w-3 h-3 bg-orange-500 rounded-full mr-2"></div>
              <h4 className="font-medium text-orange-900">{vendorName}</h4>
              <span className="ml-2 text-sm text-gray-600">
                ({vendorJobs?.length} jobs)
              </span>
            </div>
            <div className="bg-orange-50 rounded-lg p-4">
              {vendorJobs?.map(renderJobRow)}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
      <div className="absolute right-0 top-0 h-full w-full max-w-6xl bg-white shadow-xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="px-6 py-4 border-b border-gray-200 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Download className="h-5 w-5 text-gray-600 mr-3" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">Round-Up View</h2>
                  <p className="text-sm text-gray-600">Export and manage scheduled jobs</p>
                </div>
              </div>
              
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <X className="h-5 w-5 text-gray-400" />
              </button>
            </div>

            {/* Controls */}
            <div className="flex items-center justify-between mt-4">
              {/* Type Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => onTypeChange?.('daily')}
                  className={`px-3 py-1 rounded text-sm ${type === 'daily' ? 'bg-white shadow-sm' : ''}`}
                >
                  Daily
                </button>
                <button
                  onClick={() => onTypeChange?.('weekly')}
                  className={`px-3 py-1 rounded text-sm ${type === 'weekly' ? 'bg-white shadow-sm' : ''}`}
                >
                  Weekly
                </button>
                <button
                  onClick={() => onTypeChange?.('monthly')}
                  className={`px-3 py-1 rounded text-sm ${type === 'monthly' ? 'bg-white shadow-sm' : ''}`}
                >
                  Monthly
                </button>
              </div>

              {/* Export Actions */}
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">
                  {selectedJobs?.size} selected
                </span>
                <button
                  onClick={() => handleExport('copy')}
                  className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <Copy className="h-4 w-4 mr-2" />
                  Copy
                </button>
                <button
                  onClick={() => handleExport('csv')}
                  className="flex items-center px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  CSV
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  className="flex items-center px-3 py-2 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            {Object.keys(groupedJobs)?.length > 0 ? (
              Object.entries(groupedJobs)?.map(([groupName, groupData]) => 
                renderJobGroup(groupName, groupData)
              )
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Calendar className="h-8 w-8 mx-auto mb-3 text-gray-400" />
                <div className="text-lg">No jobs scheduled</div>
                <div className="text-sm">for the selected {type} period</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoundUpModal;