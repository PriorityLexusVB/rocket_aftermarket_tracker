import React, { useEffect } from 'react';
import { suppressResizeObserverLoopError } from './utils/resizeObserverHelper';
import Routes from './Routes';

function App() {
  // Suppress ResizeObserver loop errors on app initialization
  useEffect(() => {
    const cleanup = suppressResizeObserverLoopError();
    
    return cleanup;
  }, []);

  return <Routes />;
}

export default App;