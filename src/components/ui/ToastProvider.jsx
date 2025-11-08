import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = useCallback(
    (message, variant = 'success', timeout = 3000) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => [...prev, { id, message, variant }])
      if (timeout > 0) setTimeout(() => remove(id), timeout)
    },
    [remove]
  )

  const api = useMemo(
    () => ({
      show: (opts) => push(opts?.message, opts?.variant, opts?.timeout ?? 3000),
      success: (msg) => push(msg, 'success', 2500),
      error: (msg) => push(msg, 'error', 4000),
      info: (msg) => push(msg, 'info', 3000),
    }),
    [push]
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-3 right-3 z-50 space-y-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              'px-3 py-2 rounded shadow text-sm',
              t.variant === 'error' && 'bg-red-600 text-white',
              t.variant === 'success' && 'bg-emerald-600 text-white',
              t.variant === 'info' && 'bg-slate-800 text-white',
            ]
              .filter(Boolean)
              .join(' ')}
            role="status"
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
