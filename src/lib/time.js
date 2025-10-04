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