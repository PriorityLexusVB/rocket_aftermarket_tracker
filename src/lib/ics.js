/**
 * Build ICS calendar file content
 * @param {Object} params - Calendar event parameters
 * @param {string} params.uid - Unique identifier for the event
 * @param {string} params.title - Event title
 * @param {string} params.startUtcISO - Start time in UTC ISO format
 * @param {string} params.endUtcISO - End time in UTC ISO format  
 * @param {string} params.description - Event description
 * @param {string} params.location - Event location
 * @returns {string} - ICS file content
 */
export const buildICS = ({ uid, title, startUtcISO, endUtcISO, description = '', location = '' }) => {
  try {
    // Convert ISO strings to ICS format (YYYYMMDDTHHMMSSZ)
    const formatICSDate = (isoString) => {
      return new Date(isoString)?.toISOString()?.replace(/[-:]/g, '')?.replace(/\.\d{3}Z$/, 'Z');
    };

    const dtStart = formatICSDate(startUtcISO);
    const dtEnd = formatICSDate(endUtcISO);
    const dtStamp = formatICSDate(new Date()?.toISOString());

    // Escape special characters in ICS format
    const escapeICS = (str) => {
      return str?.replace(/\\/g, '\\\\')?.replace(/,/g, '\\,')?.replace(/;/g, '\\;')?.replace(/\n/g, '\\n')?.replace(/\r/g, '');
    };

    // Build ICS content
    const icsLines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Priority Lexus//Calendar Hub//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
      `UID:${uid}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `DTSTAMP:${dtStamp}`,
      `SUMMARY:${escapeICS(title)}`,
      description ? `DESCRIPTION:${escapeICS(description)}` : '',
      location ? `LOCATION:${escapeICS(location)}` : '',
      'STATUS:CONFIRMED',
      'TRANSP:OPAQUE',
      'BEGIN:VALARM',
      'TRIGGER:-PT15M',
      'ACTION:DISPLAY',
      'DESCRIPTION:Reminder: Appointment in 15 minutes',
      'END:VALARM',
      'END:VEVENT',
      'END:VCALENDAR'
    ];

    // Filter out empty lines and join
    return icsLines?.filter(line => line !== '')?.join('\r\n');
      
  } catch (error) {
    console.error('ICS build error:', error);
    
    // Return minimal valid ICS on error
    return [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Priority Lexus//Calendar Hub//EN',
      'BEGIN:VEVENT',
      `UID:${uid || 'error-' + Date.now()}`,
      `DTSTART:${new Date()?.toISOString()?.replace(/[-:]/g, '')?.replace(/\.\d{3}Z$/, 'Z')}`,
      `SUMMARY:${title || 'Calendar Event'}`,
      'END:VEVENT',
      'END:VCALENDAR'
    ]?.join('\r\n');
  }
};

/**
 * Download ICS file
 * @param {string} icsContent - ICS file content
 * @param {string} filename - Filename without extension
 */
export const downloadICS = (icsContent, filename = 'appointment') => {
  try {
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `${filename}.ics`;
    document.body?.appendChild(link);
    link?.click();
    document.body?.removeChild(link);
    
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('ICS download error:', error);
  }
};

/**
 * Generate ICS for recurring events
 * @param {Object} params - Base event parameters
 * @param {string} recurrence - Recurrence rule (RRULE format)
 * @returns {string} - ICS content with recurrence
 */
export const buildRecurringICS = (params, recurrence) => {
  try {
    const baseICS = buildICS(params);
    
    // Insert RRULE before END:VEVENT
    const icsLines = baseICS?.split('\r\n');
    const endEventIndex = icsLines?.findIndex(line => line === 'END:VEVENT');
    
    if (endEventIndex !== -1 && recurrence) {
      icsLines?.splice(endEventIndex, 0, `RRULE:${recurrence}`);
    }
    
    return icsLines?.join('\r\n');
  } catch (error) {
    console.error('Recurring ICS build error:', error);
    return buildICS(params); // Fallback to non-recurring
  }
};

// Common recurrence patterns
export const RECURRENCE_PATTERNS = {
  DAILY: 'FREQ=DAILY',
  WEEKLY: 'FREQ=WEEKLY',
  MONTHLY: 'FREQ=MONTHLY',
  YEARLY: 'FREQ=YEARLY',
  WEEKDAYS: 'FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR',
  BIWEEKLY: 'FREQ=WEEKLY;INTERVAL=2'
};