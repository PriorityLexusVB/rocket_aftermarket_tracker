import { useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import logger, { ACTION_TYPES, ENTITY_TYPES, LOG_LEVELS } from '../utils/logger';

/**
 * Custom hook for component-level logging with automatic user context
 * Provides easy-to-use logging methods that automatically include user info
 */
export const useLogger = () => {
  const { user } = useAuth();

  // Automatic user context logging
  const logWithUser = useCallback(async (level, action, entityType, entityId, description, additionalData = {}) => {
    const enhancedData = {
      ...additionalData,
      userId: user?.id,
      userEmail: user?.email
    };

    return logger?.log(level, action, entityType, entityId, description, enhancedData);
  }, [user]);

  // Component-specific logging methods
  const logComponentAction = useCallback(async (componentName, action, details = {}) => {
    return logWithUser(
      LOG_LEVELS?.INFO,
      action,
      ENTITY_TYPES?.SYSTEM,
      null, // Use null instead of componentName to skip database logging
      `Component action: ${componentName} - ${action}`,
      { componentName, ...details }
    );
  }, [logWithUser]);

  const logUserInteraction = useCallback(async (element, action, details = {}) => {
    return logWithUser(
      LOG_LEVELS?.INFO,
      action,
      ENTITY_TYPES?.USER,
      user?.id || null, // Use null instead of 'anonymous'
      `User clicked ${element}`,
      { element, ...details }
    );
  }, [logWithUser, user]);

  const logFormSubmission = useCallback(async (formName, formData, isSuccess = true) => {
    return logWithUser(
      isSuccess ? LOG_LEVELS?.SUCCESS : LOG_LEVELS?.ERROR,
      'form_submit',
      ENTITY_TYPES?.SYSTEM,
      null, // Use null instead of formName to skip database logging
      `Form ${formName} ${isSuccess ? 'submitted successfully' : 'submission failed'}`,
      { formName, formData: formData, success: isSuccess }
    );
  }, [logWithUser]);

  const logPageView = useCallback(async (pageName, additionalContext = {}) => {
    return logWithUser(
      LOG_LEVELS?.INFO,
      ACTION_TYPES?.PAGE_LOAD,
      ENTITY_TYPES?.SYSTEM,
      null, // Use null instead of pageName to skip database logging
      `Page viewed: ${pageName}`,
      { pageName, ...additionalContext }
    );
  }, [logWithUser]);

  const logBusinessAction = useCallback(async (action, entityType, entityId, description, data = {}) => {
    return logWithUser(
      LOG_LEVELS?.INFO,
      action,
      entityType,
      entityId,
      description,
      data
    );
  }, [logWithUser]);

  // Error logging with automatic error handling
  const logError = useCallback(async (error, context = {}) => {
    return logWithUser(
      LOG_LEVELS?.ERROR,
      ACTION_TYPES?.SYSTEM_ERROR,
      ENTITY_TYPES?.SYSTEM,
      null, // Use null instead of 'error' string
      `Error occurred: ${error?.message || 'Unknown error'}`,
      {
        errorMessage: error?.message,
        errorStack: error?.stack,
        context
      }
    );
  }, [logWithUser]);

  // Sales-specific logging methods
  const logSalesAction = useCallback(async (action, saleId, description, data = {}) => {
    return logWithUser(
      LOG_LEVELS?.INFO,
      action,
      ENTITY_TYPES?.SALE,
      saleId,
      description,
      data
    );
  }, [logWithUser]);

  const logVehicleAction = useCallback(async (action, vehicleId, description, data = {}) => {
    return logWithUser(
      LOG_LEVELS?.INFO,
      action,
      ENTITY_TYPES?.VEHICLE,
      vehicleId,
      description,
      data
    );
  }, [logWithUser]);

  const logJobAction = useCallback(async (action, jobId, description, data = {}) => {
    return logWithUser(
      LOG_LEVELS?.INFO,
      action,
      ENTITY_TYPES?.JOB,
      jobId,
      description,
      data
    );
  }, [logWithUser]);

  return {
    // Core logging methods
    logComponentAction,
    logUserInteraction,
    logFormSubmission,
    logPageView,
    logBusinessAction,
    logError,
    
    // Domain-specific logging
    logSalesAction,
    logVehicleAction,
    logJobAction,
    
    // Direct access to logger for advanced usage
    logger,
    
    // Utility methods
    logInfo: useCallback((action, entityType, entityId, description, data) => 
      logWithUser(LOG_LEVELS?.INFO, action, entityType, entityId, description, data), [logWithUser]),
    logWarning: useCallback((action, entityType, entityId, description, data) => 
      logWithUser(LOG_LEVELS?.WARN, action, entityType, entityId, description, data), [logWithUser]),
    logSuccess: useCallback((action, entityType, entityId, description, data) => 
      logWithUser(LOG_LEVELS?.SUCCESS, action, entityType, entityId, description, data), [logWithUser])
  };
};

export default useLogger;