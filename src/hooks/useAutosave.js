// src/hooks/useAutosave.js
// Debounced autosave utility. Call with a save function and deps; runs ~600ms after last change.
import { useEffect, useRef } from 'react'

export default function useAutosave(callback, deps = [], delay = 600) {
  const cbRef = useRef(callback)
  const timerRef = useRef(null)

  // Keep latest callback without retriggering effect
  useEffect(() => {
    cbRef.current = callback
  }, [callback])

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(
      () => {
        try {
          cbRef.current?.()
        } catch (e) {
          // non-fatal; autosave should not crash the UI
          console.warn('[useAutosave] save failed:', e?.message || e)
        }
      },
      Math.max(0, Number(delay) || 600)
    )

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
}
