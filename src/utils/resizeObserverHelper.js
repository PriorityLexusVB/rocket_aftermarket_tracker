import React, { useRef, useEffect } from 'react';
// ResizeObserver Error Handler - Prevents "loop completed" warnings
export const suppressResizeObserverLoopError = () => {
  // Catch ResizeObserver loop errors and prevent them from bubbling up
  const resizeObserverErrorHandler = (event) => {
    if (
      event?.message === 'ResizeObserver loop completed with undelivered notifications.' ||
      event?.message === 'ResizeObserver loop limit exceeded'
    ) {
      event?.stopImmediatePropagation();
      event?.preventDefault();
      return true;
    }
    return false;
  };

  // Add error event listener
  window.addEventListener('error', resizeObserverErrorHandler);
  
  // Return cleanup function
  return () => {
    window.removeEventListener('error', resizeObserverErrorHandler);
  };
};

// Debounced ResizeObserver wrapper to prevent loops
export class DebouncedResizeObserver {
  constructor(callback, delay = 16) {
    this.callback = callback;
    this.delay = delay;
    this.timeoutId = null;
    this.observer = new ResizeObserver((entries) => {
      if (this.timeoutId) {
        clearTimeout(this.timeoutId);
      }
      this.timeoutId = setTimeout(() => {
        try {
          this.callback(entries);
        } catch (error) {
          // Suppress ResizeObserver errors
          if (!error.message?.includes('ResizeObserver loop')) {
            console.warn('ResizeObserver callback error:', error);
          }
        }
      }, this.delay);
    });
  }

  observe(element, options) {
    this.observer?.observe(element, options);
  }

  unobserve(element) {
    this.observer?.unobserve(element);
  }

  disconnect() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }
    this.observer?.disconnect();
  }
}

// Hook for safe ResizeObserver usage
export const useSafeResizeObserver = (callback, delay = 16) => {
  const observerRef = React.useRef(null);
  
  React.useEffect(() => {
    if (callback) {
      observerRef.current = new DebouncedResizeObserver(callback, delay);
    }
    
    return () => {
      if (observerRef?.current) {
        observerRef?.current?.disconnect();
      }
    };
  }, [callback, delay]);
  
  return observerRef?.current;
};