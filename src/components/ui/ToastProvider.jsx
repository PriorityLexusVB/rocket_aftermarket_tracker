import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

const ToastCtx = createContext(null)

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const MAX_TOASTS = 5
  const push = useCallback(
    (message, variant = 'success', timeout = 3000, action = null) => {
      const id = Math.random().toString(36).slice(2)
      setToasts((prev) => {
        const next = [...prev, { id, message, variant, action }]
        return next.length > MAX_TOASTS ? next.slice(next.length - MAX_TOASTS) : next
      })
      if (timeout > 0) setTimeout(() => remove(id), timeout)
    },
    [remove]
  )

  const api = useMemo(
    () => ({
      show: (opts) => {
        const timeout = opts?.timeout ?? opts?.duration ?? 3000
        return push(opts?.message, opts?.variant, timeout, opts?.action ?? null)
      },
      success: (msgOrOpts) => {
        if (typeof msgOrOpts === 'string') return push(msgOrOpts, 'success', 2500)
        const timeout = msgOrOpts?.timeout ?? msgOrOpts?.duration ?? 2500
        return push(msgOrOpts?.message, 'success', timeout, msgOrOpts?.action ?? null)
      },
      error: (msgOrOpts) => {
        if (typeof msgOrOpts === 'string') return push(msgOrOpts, 'error', 7000)
        const timeout = msgOrOpts?.timeout ?? msgOrOpts?.duration ?? 7000
        return push(msgOrOpts?.message, 'error', timeout, msgOrOpts?.action ?? null)
      },
      info: (msgOrOpts) => {
        if (typeof msgOrOpts === 'string') return push(msgOrOpts, 'info', 3000)
        const timeout = msgOrOpts?.timeout ?? msgOrOpts?.duration ?? 3000
        return push(msgOrOpts?.message, 'info', timeout, msgOrOpts?.action ?? null)
      },
    }),
    [push]
  )

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="fixed top-3 right-3 z-[90] space-y-2 max-h-[calc(100vh-1.5rem)] overflow-y-auto">
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
            role={t.variant === 'error' ? 'alert' : 'status'}
            aria-live={t.variant === 'error' ? 'assertive' : 'polite'}
          >
            <div className="flex items-center gap-3">
              <div className="flex-1">{t.message}</div>
              {t?.action?.label && typeof t?.action?.onClick === 'function' ? (
                <button
                  type="button"
                  className="shrink-0 rounded bg-white/15 px-2 py-1 text-xs font-semibold text-white hover:bg-white/25"
                  onClick={() => {
                    try {
                      t.action.onClick()
                    } finally {
                      remove(t.id)
                    }
                  }}
                >
                  {t.action.label}
                </button>
              ) : null}
              {t.variant === 'error' ? (
                <button
                  type="button"
                  className="shrink-0 rounded p-1 text-white/80 hover:bg-white/20 hover:text-white"
                  onClick={() => remove(t.id)}
                  aria-label="Dismiss notification"
                  title="Dismiss"
                >
                  <span aria-hidden="true">×</span>
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

export function useToast() {
  return useContext(ToastCtx)
}
