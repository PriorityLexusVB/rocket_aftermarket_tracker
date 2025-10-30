import { fromZonedTime, toZonedTime, format } from 'date-fns-tz';

const EST_TIMEZONE = 'America/New_York';

// Safe date creation utility
const safeCreateDate = (input) => {
  if (!input) return null;
  
  // Handle various input types
  if (input instanceof Date) {
    return isNaN(input?.getTime()) ? null : input;
  }
  
  if (typeof input === 'string') {
    if (input?.trim() === '') return null;
    try {
      const date = new Date(input);
      return isNaN(date?.getTime()) ? null : date;
    } catch (error) {
      console.warn('Date parsing error:', input, error);
      return null;
    }
  }
  
  if (typeof input === 'number') {
    try {
      const date = new Date(input);
      return isNaN(date?.getTime()) ? null : date;
    } catch (error) {
      console.warn('Date creation from number error:', input, error);
      return null;
    }
  }
  
  return null;
};

/**
 * Convert input time to UTC timestamp
 * @param {Date|string} input - Date object or ISO string
 * @returns {string} - UTC ISO string
 */
export const toUTC = (input) => {
  try {
    const date = safeCreateDate(input);
    if (!date) {
      console.warn('toUTC: Invalid input date, returning current time');
      return new Date()?.toISOString();
    }
    
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
    if (!iso || typeof iso !== 'string' || iso?.trim() === '') {
      return 'Invalid Date';
    }
    
    const date = safeCreateDate(iso);
    if (!date) {
      console.warn('estLabel: Invalid date input:', iso);
      return 'Invalid Date';
    }
    
    const estTime = toZonedTime(date, EST_TIMEZONE);
    if (!estTime || isNaN(estTime?.getTime())) {
      console.warn('estLabel: Invalid timezone conversion:', iso);
      return 'Invalid Date';
    }
    
    return format(estTime, fmt, { timeZone: EST_TIMEZONE });
  } catch (error) {
    console.error('estLabel formatting error:', error, 'for input:', iso);
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

// Time formatting utilities with enhanced safety
export const formatTime = (timeString) => {
  if (!timeString) return '';
  
  const date = safeCreateDate(timeString);
  if (!date) {
    console.warn('formatTime: Invalid date input:', timeString);
    return 'Invalid Time';
  }
  
  try {
    return date?.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  } catch (error) {
    console.error('formatTime error:', error);
    return 'Invalid Time';
  }
};

// Check if a promise date is overdue with safe date handling
export const isOverdue = (promiseDate) => {
  if (!promiseDate) return false;
  
  const promise = safeCreateDate(promiseDate);
  if (!promise) return false;
  
  const now = new Date();
  
  try {
    return promise < now;
  } catch (error) {
    console.error('isOverdue comparison error:', error);
    return false;
  }
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

// Enhanced date range calculation with safety
export const getDateRange = (date, viewMode) => {
  const inputDate = safeCreateDate(date);
  if (!inputDate) {
    console.warn('getDateRange: Invalid input date, using current date');
    const now = new Date();
    return getDateRange(now, viewMode);
  }

  const start = new Date(inputDate);
  const end = new Date(inputDate);

  try {
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
  } catch (error) {
    console.error('getDateRange calculation error:', error);
    // Return safe defaults
    const safeStart = new Date();
    const safeEnd = new Date();
    safeStart?.setHours(0, 0, 0, 0);
    safeEnd?.setHours(23, 59, 59, 999);
    return { start: safeStart, end: safeEnd };
  }

  return { start, end };
};

// Calculate business hours array
export const getBusinessHours = () => {
  return Array.from({ length: 10 }, (_, i) => 8 + i); // 8AM to 6PM
};

// Safe time slot conflict checking
export const hasTimeConflict = (newStart, newEnd, existingJobs) => {
  const newStartTime = safeCreateDate(newStart);
  const newEndTime = safeCreateDate(newEnd);
  
  if (!newStartTime || !newEndTime) {
    console.warn('hasTimeConflict: Invalid time range provided');
    return false;
  }

  return existingJobs?.some(job => {
    if (!job?.scheduled_start_time || !job?.scheduled_end_time) return false;
    
    const jobStart = safeCreateDate(job?.scheduled_start_time);
    const jobEnd = safeCreateDate(job?.scheduled_end_time);
    
    if (!jobStart || !jobEnd) return false;
    
    try {
      return (
        (newStartTime <= jobStart && newEndTime > jobStart) ||
        (newStartTime < jobEnd && newEndTime >= jobEnd) ||
        (newStartTime >= jobStart && newEndTime <= jobEnd)
      );
    } catch (error) {
      console.error('hasTimeConflict comparison error:', error);
      return false;
    }
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

// Safe duration calculation
export const calculateDuration = (startTime, endTime) => {
  if (!startTime || !endTime) return 0;
  
  const start = safeCreateDate(startTime);
  const end = safeCreateDate(endTime);
  
  if (!start || !end) {
    console.warn('calculateDuration: Invalid date inputs');
    return 0;
  }
  
  try {
    const diffMs = end - start;
    return Math.round(diffMs / (1000 * 60 * 60)); // Hours
  } catch (error) {
    console.error('calculateDuration error:', error);
    return 0;
  }
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