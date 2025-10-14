// Simple utility to suppress annoying ResizeObserver loop limit exceeded errors
// These are harmless but spam the console during development

let isSuppressionActive = false;

export const suppressResizeObserverLoopError = () => {
  if (isSuppressionActive) return;
  
  isSuppressionActive = true;
  
  const originalError = console.error;
  
  console.error = (...args) => {
    const message = args?.[0]?.toString?.() || '';
    if (message?.includes?.('ResizeObserver loop limit exceeded') || 
        message?.includes?.('ResizeObserver loop completed with undelivered notifications')) {
      return; // Silently ignore these specific errors
    }
    originalError?.apply(console, args);
  };
  
  // Return cleanup function
  return () => {
    if (isSuppressionActive) {
      console.error = originalError;
      isSuppressionActive = false;
    }
  };
};

// Global error handler that suppresses ALL ResizeObserver errors
export const initGlobalErrorSuppression = () => {
  const errorHandler = (event) => {
    const message = event?.message || event?.error?.message || '';
    if (message?.includes?.('ResizeObserver') && message?.includes?.('loop')) {
      event?.stopImmediatePropagation?.();
      event?.preventDefault?.();
      return true;
    }
  };
  
  window.addEventListener('error', errorHandler, true);
  window.addEventListener('unhandledrejection', errorHandler, true);
  
  return () => {
    window.removeEventListener('error', errorHandler, true);
    window.removeEventListener('unhandledrejection', errorHandler, true);
  };
};

// Auto-initialize on import (for immediate protection)
if (typeof window !== 'undefined') {
  suppressResizeObserverLoopError();
}