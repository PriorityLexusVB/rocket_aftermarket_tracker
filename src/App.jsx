import React, { useEffect } from 'react'
import {
  suppressResizeObserverLoopError,
  initGlobalErrorSuppression,
} from './utils/resizeObserverHelper'
import Routes from './Routes'
import { ToastProvider } from './components/ui/ToastProvider'
import { prefetchDropdowns } from './services/dropdownService'
import { preflightCapabilities } from './services/healthService'
import useTenant from './hooks/useTenant'
import { initDropdownCacheRealtime } from './services/realtimeService'

function App() {
  const { orgId } = useTenant()
  // Lightweight ResizeObserver error suppression
  useEffect(() => {
    // Initialize basic error suppression
    const cleanup1 = suppressResizeObserverLoopError()
    const cleanup2 = initGlobalErrorSuppression()

    // Warm dropdown caches in the background (non-blocking)
    prefetchDropdowns()?.catch?.(() => {})

    // Proactively align capability flags (vendor rel, profile columns) before first heavy queries
    preflightCapabilities()?.catch?.(() => {})

    return () => {
      cleanup1?.()
      cleanup2?.()
    }
  }, [])

  // Realtime cache busting for dropdowns (products/vendors/staff)
  useEffect(() => {
    const cleanup = initDropdownCacheRealtime(orgId)
    return () => cleanup?.()
  }, [orgId])

  return (
    <ToastProvider>
      <Routes />
    </ToastProvider>
  )
}

export default App
