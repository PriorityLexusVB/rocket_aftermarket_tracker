// src/components/modals/ReverseReasonModal.jsx
// Reusable modal for collecting a reversal reason before calling reverse_deal RPC.
// Replaces the 3 window.prompt() call sites (DealDrawer, deals/index, kanban-status-board).
// Wave XXX-Z item 2 — see DESIGN.md + multi-agent-protocol.md
import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Loader2 from 'lucide-react/dist/esm/icons/loader-2.js'
import Undo2 from 'lucide-react/dist/esm/icons/undo-2.js'

export default function ReverseReasonModal({
  isOpen,
  onClose,
  onConfirm,
  dealLabel,
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const textareaRef = useRef(null)
  const dialogRef = useRef(null)
  // Wave XXX-Z hotfix-1 (Codex finding #4): synchronous submit guard prevents
  // double-submit race when rapid Enter fires before React loading state
  // commits. useState alone has a stale-closure window — useRef is synchronous.
  const submitInFlightRef = useRef(false)

  // Fade-in transition (matches DealDrawer mounted pattern)
  useEffect(() => {
    if (!isOpen) {
      setMounted(false)
      setReason('')
      setError('')
      setLoading(false)
      submitInFlightRef.current = false
      return
    }
    const id = requestAnimationFrame(() => {
      setMounted(true)
      // Autofocus textarea after transition starts
      setTimeout(() => textareaRef.current?.focus(), 50)
    })
    return () => cancelAnimationFrame(id)
  }, [isOpen])

  // ESC key + Tab focus trap. Wave XXX-Z hotfix-1 (Codex findings #1 + #3):
  // - ESC now stopPropagation so the parent drawer's ESC handler doesn't ALSO
  //   fire and close the drawer behind the modal
  // - Tab cycles within the dialog (real focus trap) so focus can't escape
  //   into the drawer's elements behind the modal
  useEffect(() => {
    if (!isOpen) return
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && !loading) {
        e.preventDefault()
        e.stopPropagation() // hotfix-1: prevent parent drawer ESC handler from also firing
        onClose?.()
        return
      }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = Array.from(
          dialogRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          )
        ).filter((el) => !el.hasAttribute('disabled'))
        if (focusables.length === 0) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    // Capture phase so the modal handler runs BEFORE the drawer's bubble-phase listener
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [isOpen, loading, onClose])

  if (!isOpen) return null

  const trimmed = reason.trim()
  const isValid = trimmed.length >= 3

  const handleSubmit = async (e) => {
    e?.preventDefault()
    // Wave XXX-Z hotfix-1 (Codex finding #4): synchronous ref guard prevents
    // double-submit race. Rapid Enter could fire onConfirm twice before React's
    // `loading` state commits. Ref is synchronous.
    if (submitInFlightRef.current) return
    if (!isValid) {
      setError('Reason is required (at least 3 characters).')
      return
    }
    submitInFlightRef.current = true
    setError('')
    setLoading(true)
    try {
      await onConfirm(trimmed)
      // Parent is responsible for closing on success
    } catch (err) {
      setError(err?.message || 'Could not reverse this deal. Try again.')
      setLoading(false)
      submitInFlightRef.current = false
    }
  }

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget && !loading) {
      onClose?.()
    }
  }

  return createPortal(
    <div
      className={`fixed inset-0 z-[70] flex items-end justify-center sm:items-center transition-opacity duration-150 ${mounted ? 'opacity-100' : 'opacity-0'}`}
      aria-modal="true"
      role="dialog"
      aria-labelledby="reverse-reason-title"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={dialogRef}
        className={`relative z-10 w-full max-w-md rounded-t-2xl sm:rounded-xl shadow-2xl bg-white mx-0 sm:mx-4 transition-transform duration-150 ${mounted ? 'translate-y-0' : 'translate-y-4'}`}
      >
        {/* Header */}
        <div className="px-5 pt-5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2 mb-0.5">
            <Undo2 className="h-4 w-4 text-red-600 flex-shrink-0" />
            <h2 id="reverse-reason-title" className="text-base font-semibold text-slate-900">
              Reverse Deal
            </h2>
          </div>
          {dealLabel && (
            <p className="text-[11px] text-slate-500 mt-0.5 truncate pl-6">{dealLabel}</p>
          )}
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3">
          <div>
            <label
              htmlFor="reverse-reason-input"
              className="block text-xs font-medium text-slate-700 mb-1.5"
            >
              Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              ref={textareaRef}
              id="reverse-reason-input"
              rows={3}
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (error) setError('')
              }}
              disabled={loading}
              placeholder="Why is this deal being reversed?"
              className="w-full resize-none rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-red-400 disabled:opacity-60 disabled:cursor-not-allowed"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              e.g. Customer changed mind · Financing fell through · Customer no-show · Vehicle pulled
            </p>
          </div>

          {/* Inline validation error */}
          {error && (
            <div
              className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-[11px] font-medium text-red-700"
              role="alert"
            >
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between gap-3 pt-1">
            <button
              type="button"
              onClick={() => !loading && onClose?.()}
              disabled={loading}
              className="flex-1 sm:flex-none rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !isValid}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {loading ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Reversing…
                </>
              ) : (
                <>
                  <Undo2 className="h-3.5 w-3.5" />
                  Reverse Deal
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}
