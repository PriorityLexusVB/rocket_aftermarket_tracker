import React, { useRef, useEffect } from 'react';

// Ultimate ResizeObserver Error Suppression - Complete Solution
export const suppressResizeObserverLoopError = () => {
  // Comprehensive patterns to catch all ResizeObserver-related messages
  const resizeObserverPatterns = [
    /resizeobserver loop completed with undelivered notifications/i,
    /resizeobserver loop limit exceeded/i,
    /resizeobserver.*loop/i,
    /loop completed with undelivered/i,
    /undelivered notifications/i,
    /non-error promise rejection captured/i
  ];

  // Store original console methods
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalLog = console.log;

  // Enhanced console override with pattern matching
  console.error = (...args) => {
    const message = String(args?.[0] || '')?.toLowerCase();
    if (resizeObserverPatterns?.some(pattern => pattern?.test(message))) {
      return; // Completely suppress ResizeObserver errors
    }
    originalError?.apply(console, args);
  };

  console.warn = (...args) => {
    const message = String(args?.[0] || '')?.toLowerCase();
    if (resizeObserverPatterns?.some(pattern => pattern?.test(message))) {
      return; // Completely suppress ResizeObserver warnings
    }
    originalWarn?.apply(console, args);
  };

  console.log = (...args) => {
    const message = String(args?.[0] || '')?.toLowerCase();
    if (resizeObserverPatterns?.some(pattern => pattern?.test(message))) {
      return; // Completely suppress ResizeObserver logs
    }
    originalLog?.apply(console, args);
  };

  // Global error event handler with enhanced filtering
  const globalErrorHandler = (event) => {
    const errorMessage = (event?.message || event?.error?.message || '')?.toLowerCase();
    if (resizeObserverPatterns?.some(pattern => pattern?.test(errorMessage))) {
      event?.preventDefault?.();
      event?.stopPropagation?.();
      event?.stopImmediatePropagation?.();
      return true;
    }
    return false;
  };

  // Unhandled rejection handler
  const rejectionHandler = (event) => {
    const reason = String(event?.reason || '')?.toLowerCase();
    if (resizeObserverPatterns?.some(pattern => pattern?.test(reason))) {
      event?.preventDefault?.();
      return true;
    }
    return false;
  };

  // Add multiple layers of event listeners
  window.addEventListener('error', globalErrorHandler, { capture: true, passive: false });
  window.addEventListener('unhandledrejection', rejectionHandler, { passive: false });
  document.addEventListener('error', globalErrorHandler, { capture: true, passive: false });

  // Override window.onerror as additional layer
  const originalOnError = window.onerror;
  window.onerror = (message, source, lineno, colno, error) => {
    const errorMessage = String(message || '')?.toLowerCase();
    if (resizeObserverPatterns?.some(pattern => pattern?.test(errorMessage))) {
      return true; // Prevent default handling
    }
    return originalOnError ? originalOnError(message, source, lineno, colno, error) : false;
  };

  // Override window.onunhandledrejection
  const originalOnRejection = window.onunhandledrejection;
  window.onunhandledrejection = (event) => {
    const reason = String(event?.reason || '')?.toLowerCase();
    if (resizeObserverPatterns?.some(pattern => pattern?.test(reason))) {
      event?.preventDefault?.();
      return;
    }
    if (originalOnRejection) {
      originalOnRejection(event);
    }
  };

  // Cleanup function
  return () => {
    console.error = originalError;
    console.warn = originalWarn;
    console.log = originalLog;
    window.removeEventListener('error', globalErrorHandler, { capture: true });
    window.removeEventListener('unhandledrejection', rejectionHandler);
    document.removeEventListener('error', globalErrorHandler, { capture: true });
    window.onerror = originalOnError;
    window.onunhandledrejection = originalOnRejection;
  };
};

// Enhanced debounced ResizeObserver with better error handling
export class DebouncedResizeObserver {
  constructor(callback, delay = 16) {
    this.callback = callback;
    this.delay = delay;
    this.timeoutId = null;
    this.isObserving = false;
    this.frameId = null;
    
    try {
      this.observer = new ResizeObserver((entries) => {
        // Clear any existing timeout and animation frame
        if (this.timeoutId) clearTimeout(this.timeoutId);
        if (this.frameId) cancelAnimationFrame(this.frameId);
        
        // Use requestAnimationFrame + setTimeout for better performance
        this.frameId = requestAnimationFrame(() => {
          this.timeoutId = setTimeout(() => {
            try {
              if (this.isObserving && typeof this.callback === 'function') {
                this.callback(entries);
              }
            } catch (error) {
              // Silently handle callback errors to prevent loops
              const errorMessage = (error?.message || '').toLowerCase();
              if (!errorMessage.includes('resizeobserver')) {
                console.warn('ResizeObserver callback error:', error);
              }
            }
          }, this.delay);
        });
      });
    } catch (error) {
      console.warn('Failed to create ResizeObserver:', error);
      this.observer = null;
    }
  }

  observe(element, options) {
    if (this.observer && element && element?.nodeType === Node.ELEMENT_NODE) {
      try {
        this.isObserving = true;
        this.observer?.observe(element, options);
      } catch (error) {
        // Silently handle observe errors
      }
    }
  }

  unobserve(element) {
    if (this.observer && element && element?.nodeType === Node.ELEMENT_NODE) {
      try {
        this.observer?.unobserve(element);
      } catch (error) {
        // Silently handle unobserve errors
      }
    }
  }

  disconnect() {
    this.isObserving = false;
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.frameId) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    if (this.observer) {
      try {
        this.observer?.disconnect();
      } catch (error) {
        // Silently handle disconnect errors
      }
    }
  }
}

// Safe ResizeObserver hook with enhanced error handling
export const useSafeResizeObserver = (callback, delay = 16) => {
  const observerRef = useRef(null);
  const callbackRef = useRef(callback);
  
  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);
  
  useEffect(() => {
    if (callbackRef?.current) {
      observerRef.current = new DebouncedResizeObserver(callbackRef.current, delay);
    }
    
    return () => {
      if (observerRef?.current) {
        observerRef?.current?.disconnect();
        observerRef.current = null;
      }
    };
  }, [delay]);
  
  return observerRef?.current;
};

// Global initialization function - enhanced for production
export const initGlobalErrorSuppression = () => {
  // Apply comprehensive error suppression
  const cleanup = suppressResizeObserverLoopError();
  
  // Additional DOM-ready initialization
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      // Reinforce suppression after DOM is ready
      suppressResizeObserverLoopError();
    });
  }
  
  return cleanup;
};