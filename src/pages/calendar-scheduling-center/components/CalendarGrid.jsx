import React, { useState, useRef, useEffect } from 'react';
import { User, AlertCircle, Wrench } from 'lucide-react';

const CalendarGrid = ({ 
  jobs = [], 
  currentDate, 
  viewType, 
  onJobClick, 
  onJobDragDrop,
  loading 
}) => {
  const [draggedJob, setDraggedJob] = useState(null);
  const [dragPosition, setDragPosition] = useState(null);
  const [dropZone, setDropZone] = useState(null);
  const gridRef = useRef(null);

  // Time slots for day/week view (9 AM to 6 PM)
  const timeSlots = Array.from({ length: 18 }, (_, i) => {
    const hour = Math.floor(i / 2) + 8; // Start at 8 AM
    const minute = (i % 2) * 30;
    return { hour, minute, label: `${hour}:${minute?.toString()?.padStart(2, '0')}` };
  });

  // Get days to display based on view type
  const getDaysToDisplay = () => {
    const days = [];
    const start = new Date(currentDate);
    
    switch (viewType) {
      case 'day':
        days?.push(new Date(start));
        break;
      case 'week':
        const startOfWeek = new Date(start);
        startOfWeek?.setDate(start?.getDate() - start?.getDay()); // Start on Sunday
        for (let i = 0; i < 7; i++) {
          const day = new Date(startOfWeek);
          day?.setDate(startOfWeek?.getDate() + i);
          days?.push(day);
        }
        break;
      case 'month':
        const startOfMonth = new Date(start.getFullYear(), start.getMonth(), 1);
        const startOfGrid = new Date(startOfMonth);
        startOfGrid?.setDate(startOfGrid?.getDate() - startOfMonth?.getDay());
        
        for (let i = 0; i < 42; i++) { // 6 weeks × 7 days
          const day = new Date(startOfGrid);
          day?.setDate(startOfGrid?.getDate() + i);
          days?.push(day);
        }
        break;
    }
    
    return days;
  };

  const daysToDisplay = getDaysToDisplay();

  // Filter jobs for specific day
  const getJobsForDay = (date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000 - 1);
    
    return jobs?.filter(job => {
      if (!job?.scheduled_start_time) return false;
      const jobDate = new Date(job.scheduled_start_time);
      return jobDate >= dayStart && jobDate <= dayEnd;
    }) || [];
  };

  // Calculate job position and duration for time-based views
  const getJobTimePosition = (job) => {
    if (!job?.scheduled_start_time || !job?.scheduled_end_time) return null;
    
    const startTime = new Date(job.scheduled_start_time);
    const endTime = new Date(job.scheduled_end_time);
    
    const startHour = startTime?.getHours();
    const startMinute = startTime?.getMinutes();
    const endHour = endTime?.getHours();
    const endMinute = endTime?.getMinutes();
    
    // Calculate position from 8 AM start
    const startOffset = (startHour - 8) * 2 + (startMinute / 30);
    const duration = (endHour - startHour) * 2 + ((endMinute - startMinute) / 30);
    
    return {
      top: `${startOffset * 3}rem`, // 3rem per 30-minute slot
      height: `${Math.max(duration * 3, 1.5)}rem`,
      startTime: `${startHour}:${startMinute?.toString()?.padStart(2, '0')}`,
      endTime: `${endHour}:${endMinute?.toString()?.padStart(2, '0')}`
    };
  };

  // Status color mapping
  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-gray-100 border-gray-300 text-gray-700',
      'scheduled': 'bg-blue-100 border-blue-300 text-blue-700',
      'in_progress': 'bg-yellow-100 border-yellow-300 text-yellow-700',
      'quality_check': 'bg-purple-100 border-purple-300 text-purple-700',
      'delivered': 'bg-green-100 border-green-300 text-green-700',
      'completed': 'bg-green-200 border-green-400 text-green-800',
      'cancelled': 'bg-red-100 border-red-300 text-red-700'
    };
    return colors?.[status] || colors?.pending;
  };

  // Priority indicators
  const getPriorityColor = (priority) => {
    const colors = {
      'low': 'bg-green-500',
      'medium': 'bg-yellow-500',
      'high': 'bg-orange-500',
      'urgent': 'bg-red-500'
    };
    return colors?.[priority] || colors?.medium;
  };

  // Drag handlers
  const handleDragStart = (e, job) => {
    setDraggedJob(job);
    e.dataTransfer.effectAllowed = 'move';
    e?.dataTransfer?.setData('text/html', e?.target?.outerHTML);
    e.target.style.opacity = '0.5';
  };

  const handleDragEnd = (e) => {
    e.target.style.opacity = '1';
    setDraggedJob(null);
    setDropZone(null);
  };

  const handleDragOver = (e) => {
    e?.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetDate, timeSlot = null) => {
    e?.preventDefault();
    
    if (!draggedJob || !onJobDragDrop) return;

    // Calculate new start and end times
    const newStartDate = new Date(targetDate);
    
    if (timeSlot && viewType !== 'month') {
      newStartDate?.setHours(timeSlot?.hour, timeSlot?.minute, 0, 0);
    } else {
      // For month view, keep original time or default to 9 AM
      const originalStart = new Date(draggedJob.scheduled_start_time || newStartDate);
      newStartDate?.setHours(originalStart?.getHours(), originalStart?.getMinutes(), 0, 0);
    }
    
    // Calculate duration
    const originalStart = new Date(draggedJob.scheduled_start_time);
    const originalEnd = new Date(draggedJob.scheduled_end_time);
    const durationMs = originalEnd?.getTime() - originalStart?.getTime();
    
    const newEndDate = new Date(newStartDate.getTime() + durationMs);

    // Call the update handler
    onJobDragDrop?.(draggedJob?.id, newStartDate, newEndDate);
  };

  // Job card component
  const JobCard = ({ job, style = {}, isDraggable = true }) => {
    const timePosition = getJobTimePosition(job);
    const statusColor = getStatusColor(job?.job_status);
    const priorityColor = getPriorityColor(job?.priority);

    return (
      <div
        className={`
          absolute left-1 right-1 rounded-lg border-2 p-2 cursor-pointer
          hover:shadow-md transition-all duration-200 z-10
          ${statusColor}
          ${isDraggable ? 'cursor-grab active:cursor-grabbing' : ''}
        `}
        style={{
          ...style,
          ...(timePosition && viewType !== 'month' ? {
            top: timePosition?.top,
            height: timePosition?.height
          } : {})
        }}
        draggable={isDraggable}
        onDragStart={(e) => handleDragStart(e, job)}
        onDragEnd={handleDragEnd}
        onClick={() => onJobClick?.(job)}
        title={`${job?.title} - ${job?.vendor_name || 'No Vendor'}`}
      >
        {/* Priority indicator */}
        <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${priorityColor}`} />
        {/* Job content */}
        <div className="text-xs font-medium truncate pr-4">
          {job?.title}
        </div>
        {viewType !== 'month' && timePosition && (
          <div className="text-xs text-gray-600 mt-1">
            {timePosition?.startTime} - {timePosition?.endTime}
          </div>
        )}
        <div className="flex items-center justify-between text-xs mt-1">
          <div className="flex items-center space-x-1">
            <User className="h-3 w-3" />
            <span className="truncate max-w-16">
              {job?.vendor_name || 'Unassigned'}
            </span>
          </div>
          
          {job?.vehicle_info && (
            <div className="flex items-center space-x-1">
              <Wrench className="h-3 w-3" />
              <span className="truncate max-w-20">
                {job?.vehicle_info}
              </span>
            </div>
          )}
        </div>
        {/* Overdue indicator */}
        {job?.due_date && new Date(job.due_date) < new Date() && job?.job_status !== 'completed' && (
          <div className="absolute -top-1 -right-1">
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="text-gray-600 mt-2">Loading calendar...</p>
        </div>
      </div>
    );
  }

  // Month View
  if (viewType === 'month') {
    return (
      <div className="h-full p-6 overflow-auto">
        <div className="grid grid-cols-7 gap-px bg-gray-200 rounded-lg overflow-hidden">
          {/* Day headers */}
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']?.map(day => (
            <div key={day} className="bg-gray-50 p-3 text-center text-sm font-medium text-gray-700">
              {day}
            </div>
          ))}
          
          {/* Calendar days */}
          {daysToDisplay?.map((date, index) => {
            const dayJobs = getJobsForDay(date);
            const isCurrentMonth = date?.getMonth() === currentDate?.getMonth();
            const isToday = date?.toDateString() === new Date()?.toDateString();
            
            return (
              <div
                key={index}
                className={`
                  bg-white min-h-32 p-2 relative
                  ${!isCurrentMonth ? 'text-gray-400 bg-gray-50' : ''}
                  ${isToday ? 'bg-blue-50 border-2 border-blue-200' : ''}
                `}
                onDragOver={handleDragOver}
                onDrop={(e) => handleDrop(e, date)}
              >
                <div className="text-sm font-medium mb-1">
                  {date?.getDate()}
                </div>
                <div className="space-y-1">
                  {dayJobs?.slice(0, 3)?.map((job, jobIndex) => (
                    <div
                      key={job?.id || jobIndex}
                      className={`
                        text-xs p-1 rounded truncate cursor-pointer
                        ${getStatusColor(job?.job_status)}
                        hover:shadow-sm transition-shadow
                      `}
                      onClick={() => onJobClick?.(job)}
                      title={`${job?.title} - ${job?.vendor_name || 'No Vendor'}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate flex-1">
                          {job?.title}
                        </span>
                        <div className={`w-2 h-2 rounded-full ml-1 ${getPriorityColor(job?.priority)}`} />
                      </div>
                    </div>
                  ))}
                  
                  {dayJobs?.length > 3 && (
                    <div className="text-xs text-gray-500 text-center">
                      +{dayJobs?.length - 3} more
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Day/Week View
  return (
    <div className="h-full flex flex-col" ref={gridRef}>
      {/* Time column and day headers */}
      <div className="flex border-b border-gray-200 bg-white sticky top-0 z-20">
        <div className="w-20 border-r border-gray-200 bg-gray-50"></div>
        {daysToDisplay?.map((date, index) => {
          const isToday = date?.toDateString() === new Date()?.toDateString();
          
          return (
            <div
              key={index}
              className={`
                flex-1 p-3 text-center border-r border-gray-200 min-w-0
                ${isToday ? 'bg-blue-50 text-blue-900 font-semibold' : 'text-gray-700'}
              `}
            >
              <div className="text-sm">
                {date?.toLocaleDateString('en-US', { weekday: 'short' })}
              </div>
              <div className={`text-lg ${isToday ? 'text-blue-600' : ''}`}>
                {date?.getDate()}
              </div>
            </div>
          );
        })}
      </div>
      {/* Time grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex">
          {/* Time labels */}
          <div className="w-20 border-r border-gray-200 bg-gray-50">
            {timeSlots?.map((slot, index) => (
              <div
                key={index}
                className="h-12 border-b border-gray-100 px-2 py-1 text-xs text-gray-600 text-right"
              >
                {slot?.label}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {daysToDisplay?.map((date, dayIndex) => {
            const dayJobs = getJobsForDay(date);
            
            return (
              <div
                key={dayIndex}
                className="flex-1 border-r border-gray-200 relative min-w-0"
              >
                {/* Time slot backgrounds */}
                {timeSlots?.map((slot, slotIndex) => (
                  <div
                    key={slotIndex}
                    className="h-12 border-b border-gray-100 hover:bg-gray-50 transition-colors"
                    onDragOver={handleDragOver}
                    onDrop={(e) => handleDrop(e, date, slot)}
                  />
                ))}
                {/* Jobs */}
                {dayJobs?.map((job, jobIndex) => (
                  <JobCard
                    key={job?.id || jobIndex}
                    job={job}
                    isDraggable={true}
                  />
                ))}
                {/* Current time indicator for today */}
                {date?.toDateString() === new Date()?.toDateString() && (
                  (() => {
                    const now = new Date();
                    const currentHour = now?.getHours();
                    const currentMinute = now?.getMinutes();
                    
                    if (currentHour >= 8 && currentHour <= 18) {
                      const position = (currentHour - 8) * 48 + (currentMinute * 48 / 60);
                      
                      return (
                        <div
                          className="absolute left-0 right-0 h-0.5 bg-red-500 z-30"
                          style={{ top: `${position}px` }}
                        >
                          <div className="w-3 h-3 bg-red-500 rounded-full -ml-1.5 -mt-1"></div>
                        </div>
                      );
                    }
                    return null;
                  })()
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default CalendarGrid;