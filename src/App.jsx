import React, { useEffect } from 'react';
import { suppressResizeObserverLoopError, initGlobalErrorSuppression } from './utils/resizeObserverHelper';
import Routes from './Routes';

function App() {
  // Ultimate ResizeObserver error suppression with multiple layers
  useEffect(() => {
    // Layer 1: Initialize global suppression immediately
    const cleanup1 = initGlobalErrorSuppression();
    
    // Layer 2: Additional comprehensive suppression
    const cleanup2 = suppressResizeObserverLoopError();
    
    // Layer 3: Runtime monitoring and suppression
    let suppressionActive = true;
    
    const runtimeErrorHandler = (event) => {
      if (!suppressionActive) return;
      
      const message = (event?.message || event?.error?.message || '')?.toLowerCase();
      if (message?.includes('resizeobserver') || message?.includes('undelivered')) {
        event?.preventDefault?.();
        event?.stopPropagation?.();
        event?.stopImmediatePropagation?.();
        return true;
      }
    };
    
    // Add runtime handlers with highest priority
    window.addEventListener('error', runtimeErrorHandler, { capture: true, passive: false });
    document.addEventListener('error', runtimeErrorHandler, { capture: true, passive: false });
    
    // Layer 4: Periodic reinforcement (for any dynamic content changes)
    const reinforceInterval = setInterval(() => {
      if (suppressionActive) {
        suppressResizeObserverLoopError();
      }
    }, 5000);
    
    return () => {
      suppressionActive = false;
      cleanup1?.();
      cleanup2?.();
      clearInterval(reinforceInterval);
      window.removeEventListener('error', runtimeErrorHandler, { capture: true });
      document.removeEventListener('error', runtimeErrorHandler, { capture: true });
    };
  }, []);

  return <Routes />;
}

export default App;