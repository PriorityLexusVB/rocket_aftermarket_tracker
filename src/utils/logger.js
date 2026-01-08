// Application-wide logging utility for automotive aftermarket system
import { supabase } from '@/lib/supabase'

/**
 * Log levels for different types of events
 */
export const LOG_LEVELS = {
  INFO: 'info',
  WARN: 'warning',
  ERROR: 'error',
  DEBUG: 'debug',
  SUCCESS: 'success',
}

/**
 * Entity types for logging
 */
export const ENTITY_TYPES = {
  USER: 'user',
  VEHICLE: 'vehicle',
  JOB: 'job',
  TRANSACTION: 'transaction',
  VENDOR: 'vendor',
  PRODUCT: 'product',
  SALE: 'sale',
  SYSTEM: 'system',
}

/**
 * Action types for comprehensive tracking
 */
export const ACTION_TYPES = {
  // User actions
  LOGIN: 'login',
  LOGOUT: 'logout',

  // CRUD operations
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  VIEW: 'view',

  // Status changes
  STATUS_CHANGE: 'status_changed',

  // Sales tracking specific
  SALE_CREATED: 'sale_created',
  SALE_UPDATED: 'sale_updated',
  SALE_DELETED: 'sale_deleted',
  SERVICE_ADDED: 'service_added',
  SERVICE_REMOVED: 'service_removed',

  // Vehicle operations
  VEHICLE_ADDED: 'vehicle_added',
  VEHICLE_UPDATED: 'vehicle_updated',

  // Job operations
  JOB_ASSIGNED: 'job_assigned',
  JOB_STARTED: 'job_started',
  JOB_COMPLETED: 'job_completed',

  // System events
  SYSTEM_ERROR: 'system_error',
  API_CALL: 'api_call',
  PAGE_LOAD: 'page_load',
}

/**
 * Enhanced logging class for automotive aftermarket system
 */
class AppLogger {
  constructor() {
    this.isEnabled = true
    // Determine dev mode safely across Vite (browser) and Node (tests)
    let isDev = false
    let isVitest = false
    try {
      // Vite exposes import.meta.env.DEV in the browser
      // Guard in case import.meta is not available (older tooling)

      isDev = Boolean(typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.DEV)
      isVitest = Boolean(
        typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITEST
      )
    } catch {
      // no-op
    }
    this.consoleEnabled = Boolean(isDev || isVitest)
  }

  /**
   * Helper function to validate and convert entity ID to UUID format
   * @param {string} entityId - The entity ID to validate
   * @param {string} entityType - The entity type for context
   * @returns {string|null} - Valid UUID or null if invalid
   */
  validateEntityId(entityId, entityType) {
    if (!entityId) return null

    // Check if it's already a valid UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if (uuidRegex?.test(entityId)) {
      return entityId
    }

    // For system/string entities, return null to skip database logging
    // These will only be logged to console
    if (
      typeof entityId === 'string' &&
      (entityId === 'system' ||
        entityId === 'error' ||
        entityType === 'system' ||
        entityId?.includes('-api') ||
        entityId === 'anonymous' ||
        entityId === 'bulk')
    ) {
      return null
    }

    return null
  }

  /**
   * Main logging method that handles both console and database logging
   * @param {string} level - Log level (info, warning, error, etc.)
   * @param {string} action - Action type from ACTION_TYPES
   * @param {string} entityType - Entity type from ENTITY_TYPES
   * @param {string} entityId - ID of the entity being logged
   * @param {string} description - Human readable description
   * @param {Object} additionalData - Extra data to log
   */
  async log(level, action, entityType, entityId, description, additionalData = {}) {
    if (!this.isEnabled) return

    const logEntry = {
      level,
      action,
      entityType,
      entityId,
      description,
      timestamp: new Date()?.toISOString(),
      ...additionalData,
    }

    // Console logging for development
    if (this.consoleEnabled) {
      const consoleMethod = this.getConsoleMethod(level)
      consoleMethod(`[${level?.toUpperCase()}] ${action} on ${entityType}:`, logEntry)
    }

    // Database logging via activity_history table
    try {
      await this.logToDatabase(action, entityType, entityId, description, additionalData)
    } catch (error) {
      console.error('Failed to log to database:', error)
    }
  }

  /**
   * Log to Supabase activity_history table
   */
  async logToDatabase(action, entityType, entityId, description, additionalData = {}) {
    try {
      const validEntityId = this.validateEntityId(entityId, entityType)

      // Skip database logging for invalid entity IDs (system events, etc.)
      if (!validEntityId) {
        if (this.consoleEnabled) {
          console.debug('Skipping database logging for system event:', {
            action,
            entityType,
            entityId,
          })
        }
        return
      }

      const { data: userData } = await supabase?.auth?.getUser()

      const logData = {
        action,
        entity_type: entityType,
        entity_id: validEntityId,
        description,
        old_values: additionalData?.oldValues || null,
        new_values: additionalData?.newValues || null,
        performed_by: userData?.user?.id || null,
      }

      const { error } = await supabase?.from('activity_history')?.insert([logData])

      if (error) {
        console.error('Database logging error:', error)
      }
    } catch (error) {
      console.error('Database logging failed:', error)
    }
  }

  /**
   * Get appropriate console method based on log level
   */
  getConsoleMethod(level) {
    switch (level) {
      case LOG_LEVELS?.ERROR:
        return console.error
      case LOG_LEVELS?.WARN:
        return console.warn
      case LOG_LEVELS?.DEBUG:
        return console.debug
      default:
        return console.log
    }
  }

  // Convenience methods for different log levels
  async info(action, entityType, entityId, description, additionalData = {}) {
    return this.log(LOG_LEVELS?.INFO, action, entityType, entityId, description, additionalData)
  }

  async warn(action, entityType, entityId, description, additionalData = {}) {
    return this.log(LOG_LEVELS?.WARN, action, entityType, entityId, description, additionalData)
  }

  async error(action, entityType, entityId, description, additionalData = {}) {
    return this.log(LOG_LEVELS?.ERROR, action, entityType, entityId, description, additionalData)
  }

  async success(action, entityType, entityId, description, additionalData = {}) {
    return this.log(LOG_LEVELS?.SUCCESS, action, entityType, entityId, description, additionalData)
  }

  async debug(action, entityType, entityId, description, additionalData = {}) {
    return this.log(LOG_LEVELS?.DEBUG, action, entityType, entityId, description, additionalData)
  }

  // Specific business logic logging methods
  async logSaleCreation(saleId, saleData, userId) {
    return this.info(
      ACTION_TYPES?.SALE_CREATED,
      ENTITY_TYPES?.SALE,
      saleId,
      `New sale created for vehicle ${saleData?.stockNumber || 'Unknown'}`,
      {
        newValues: saleData,
        userId,
        vehicleInfo: {
          stockNumber: saleData?.stockNumber,
          year: saleData?.year,
          make: saleData?.make,
          model: saleData?.model,
        },
      }
    )
  }

  async logSaleUpdate(saleId, oldData, newData, userId) {
    return this.info(
      ACTION_TYPES?.SALE_UPDATED,
      ENTITY_TYPES?.SALE,
      saleId,
      `Sale updated for ${oldData?.stockNumber || 'Unknown vehicle'}`,
      {
        oldValues: oldData,
        newValues: newData,
        userId,
      }
    )
  }

  async logServiceChange(saleId, serviceName, action, userId) {
    const description =
      action === 'added'
        ? `Service "${serviceName}" added to sale`
        : `Service "${serviceName}" removed from sale`

    return this.info(
      action === 'added' ? ACTION_TYPES?.SERVICE_ADDED : ACTION_TYPES?.SERVICE_REMOVED,
      ENTITY_TYPES?.SALE,
      saleId,
      description,
      { serviceName, userId }
    )
  }

  async logUserAction(action, userId, details = {}) {
    return this.info(action, ENTITY_TYPES?.USER, userId, `User ${action}`, details)
  }

  async logPageLoad(pageName, userId) {
    return this.debug(
      ACTION_TYPES?.PAGE_LOAD,
      ENTITY_TYPES?.SYSTEM,
      'system',
      `User loaded ${pageName} page`,
      { pageName, userId }
    )
  }

  async logError(error, context = {}) {
    return this.error(
      ACTION_TYPES?.SYSTEM_ERROR,
      ENTITY_TYPES?.SYSTEM,
      'system',
      `System error: ${error?.message || 'Unknown error'}`,
      {
        errorStack: error?.stack,
        errorMessage: error?.message,
        context,
      }
    )
  }

  // Batch logging for multiple events
  async logBatch(logEntries) {
    const promises = logEntries?.map((entry) =>
      this.log(
        entry?.level,
        entry?.action,
        entry?.entityType,
        entry?.entityId,
        entry?.description,
        entry?.additionalData
      )
    )

    try {
      await Promise.allSettled(promises)
    } catch (error) {
      console.error('Batch logging failed:', error)
    }
  }
}

// Create singleton instance
const logger = new AppLogger()

// Export singleton and classes/constants
export default logger
export { AppLogger }
