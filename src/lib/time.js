import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';

const EST_TIMEZONE = 'America/New_York';

/**
 * Convert input time to UTC timestamp
 * @param {Date|string} input - Date object or ISO string
 * @returns {string} - UTC ISO string
 */
export const toUTC = (input) => {
  try {
    const date = typeof input === 'string' ? new Date(input) : input;
    
    // If input is already in local time, convert assuming EST
    const estTime = fromZonedTime(date, EST_TIMEZONE);
    return estTime?.toISOString();
  } catch (error) {
    console.error('toUTC conversion error:', error);
    return new Date()?.toISOString();
  }
};

/**
 * Format UTC timestamp as EST label
 * @param {string} iso - UTC ISO string
 * @param {string} fmt - Date format string (default: 'MMM d, h:mma')
 * @returns {string} - Formatted EST time string
 */
export const estLabel = (iso, fmt = 'MMM d, h:mma') => {
  try {
    if (!iso) return '';
    
    const date = new Date(iso);
    const estTime = toZonedTime(date, EST_TIMEZONE);
    return format(estTime, fmt, { timeZone: EST_TIMEZONE });
  } catch (error) {
    console.error('estLabel formatting error:', error);
    return 'Invalid Date';
  }
};

/**
 * Get current EST time
 * @returns {Date} - Current time in EST timezone
 */
export const getCurrentEST = () => {
  return toZonedTime(new Date(), EST_TIMEZONE);
};

/**
 * Check if time is within EST business hours (8 AM - 6 PM)
 * @param {string} iso - UTC ISO string
 * @returns {boolean}
 */
export const isBusinessHours = (iso) => {
  try {
    const estTime = toZonedTime(new Date(iso), EST_TIMEZONE);
    const hour = estTime?.getHours();
    return hour >= 8 && hour < 18; // 8 AM to 6 PM EST
  } catch (error) {
    console.error('isBusinessHours check error:', error);
    return false;
  }
};

/**
 * Convert EST time to UTC for database storage
 * @param {Date} estDate - Date in EST
 * @returns {string} - UTC ISO string
 */
export const estToUTC = (estDate) => {
  try {
    return fromZonedTime(estDate, EST_TIMEZONE)?.toISOString();
  } catch (error) {
    console.error('estToUTC conversion error:', error);
    return new Date()?.toISOString();
  }
};

// Time formatting utilities
export const formatTime = (timeString) => {
  if (!timeString) return '';
  
  const date = new Date(timeString);
  if (isNaN(date?.getTime())) return '';
  
  return date?.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// Check if a promise date is overdue
export const isOverdue = (promiseDate) => {
  if (!promiseDate) return false;
  
  const promise = new Date(promiseDate);
  const now = new Date();
  
  return promise < now;
};

// Get status badge configuration
export const getStatusBadge = (status) => {
  const statusMap = {
    'pending': {
      label: 'PENDING',
      bg: 'bg-gray-100',
      textColor: 'text-gray-800',
      color: 'bg-gray-500'
    },
    'scheduled': {
      label: 'BOOKED',
      bg: 'bg-blue-100',
      textColor: 'text-blue-800',
      color: 'bg-blue-500'
    },
    'in_progress': {
      label: 'IP',
      bg: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      color: 'bg-yellow-500'
    },
    'quality_check': {
      label: 'W/P',
      bg: 'bg-purple-100',
      textColor: 'text-purple-800',
      color: 'bg-purple-500'
    },
    'completed': {
      label: 'DONE',
      bg: 'bg-green-100',
      textColor: 'text-green-800',
      color: 'bg-green-500'
    },
    'delivered': {
      label: 'DONE',
      bg: 'bg-teal-100',
      textColor: 'text-teal-800',
      color: 'bg-teal-500'
    },
    'cancelled': {
      label: 'CANCELED',
      bg: 'bg-red-100',
      textColor: 'text-red-800',
      color: 'bg-red-500'
    },
    'no_show': {
      label: 'NS',
      bg: 'bg-gray-100',
      textColor: 'text-gray-800',
      color: 'bg-gray-400'
    }
  };

  return statusMap?.[status] || statusMap?.['pending'];
};

// Get location-based colors
export const getLocationColor = (isOnSite) => {
  return isOnSite ? 'bg-green-500' : 'bg-orange-500';
};

// Format date ranges for calendar views
export const getDateRange = (date, viewMode) => {
  const start = new Date(date);
  const end = new Date(date);

  switch (viewMode) {
    case 'day':
      start?.setHours(0, 0, 0, 0);
      end?.setHours(23, 59, 59, 999);
      break;
    case 'week':
      // Start on Monday
      const dayOfWeek = start?.getDay();
      const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      start?.setDate(start?.getDate() - daysToMonday);
      start?.setHours(0, 0, 0, 0);
      end?.setDate(start?.getDate() + 5); // Monday to Saturday
      end?.setHours(23, 59, 59, 999);
      break;
    default:
      break;
  }

  return { start, end };
};

// Calculate business hours array
export const getBusinessHours = () => {
  return Array.from({ length: 10 }, (_, i) => 8 + i); // 8AM to 6PM
};

// Check if time slot conflicts with existing job
export const hasTimeConflict = (newStart, newEnd, existingJobs) => {
  const newStartTime = new Date(newStart);
  const newEndTime = new Date(newEnd);

  return existingJobs?.some(job => {
    if (!job?.scheduled_start_time || !job?.scheduled_end_time) return false;
    
    const jobStart = new Date(job.scheduled_start_time);
    const jobEnd = new Date(job.scheduled_end_time);
    
    return (
      (newStartTime <= jobStart && newEndTime > jobStart) ||
      (newStartTime < jobEnd && newEndTime >= jobEnd) ||
      (newStartTime >= jobStart && newEndTime <= jobEnd)
    );
  });
};

// Get day name from date
export const getDayName = (date) => {
  return date?.toLocaleDateString('en-US', { weekday: 'long' });
};

// Get short day name from date
export const getShortDayName = (date) => {
  return date?.toLocaleDateString('en-US', { weekday: 'short' });
};

// Calculate duration between two times
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  const start = new Date(startTime);
  const end = new Date(endTime);
  
  return Math.round((end - start) / (1000 * 60 * 60)); // Hours
};

// Format duration as readable string
export const formatDuration = (hours) => {
  if (!hours) return '';
  
  if (hours < 1) {
    const minutes = Math.round(hours * 60);
    return `${minutes}min`;
  }
  
  const wholeHours = Math.floor(hours);
  const remainingMinutes = Math.round((hours - wholeHours) * 60);
  
  if (remainingMinutes === 0) {
    return `${wholeHours}h`;
  }
  
  return `${wholeHours}h ${remainingMinutes}min`;
};