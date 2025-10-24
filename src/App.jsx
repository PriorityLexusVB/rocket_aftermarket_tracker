import React, { useEffect } from 'react'
import {
  suppressResizeObserverLoopError,
  initGlobalErrorSuppression,
} from './utils/resizeObserverHelper'
import Routes from './Routes'
import { ToastProvider } from './components/ui/ToastProvider'
import { prefetchDropdowns } from './services/dropdownService'

function App() {
  // Lightweight ResizeObserver error suppression
  useEffect(() => {
    // Initialize basic error suppression
    const cleanup1 = suppressResizeObserverLoopError()
    const cleanup2 = initGlobalErrorSuppression()

    // Warm dropdown caches in the background (non-blocking)
    prefetchDropdowns()?.catch?.(() => {})

    return () => {
      cleanup1?.()
      cleanup2?.()
    }
  }, [])

  return (
    <ToastProvider>
      <Routes />
    </ToastProvider>
  )
}

export default App
