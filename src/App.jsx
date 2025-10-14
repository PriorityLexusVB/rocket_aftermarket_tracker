import React, { useEffect } from 'react';
import { suppressResizeObserverLoopError, initGlobalErrorSuppression } from './utils/resizeObserverHelper';
import Routes from './Routes';

function App() {
  // Lightweight ResizeObserver error suppression
  useEffect(() => {
    // Initialize basic error suppression
    const cleanup1 = suppressResizeObserverLoopError();
    const cleanup2 = initGlobalErrorSuppression();
    
    return () => {
      cleanup1?.();
      cleanup2?.();
    };
  }, []);

  return <Routes />;
}

export default App;