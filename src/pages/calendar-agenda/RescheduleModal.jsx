// src/pages/calendar-agenda/RescheduleModal.jsx
// Minimal modal component for future enhancement. Currently unused; reserved for richer reschedule UI.
import React, { useEffect, useRef } from 'react'

export default function RescheduleModal({ open, onClose, onSubmit, initialStart, initialEnd }) {
  const dialogRef = useRef(null)

  // Handle ESC key
  useEffect(() => {
    if (!open) return
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Reschedule appointment"
      onClick={(e) => {
        // Click outside to close
        if (e.target === e.currentTarget) onClose?.()
      }}
    >
      <div ref={dialogRef} className="bg-white rounded shadow p-4 w-full max-w-sm">
        <h2 className="text-lg font-semibold mb-3">Reschedule</h2>
        <p className="text-sm text-gray-600">
          This simplified modal is a placeholder for richer scheduling.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button className="px-3 py-1 border rounded" onClick={onClose} aria-label="Cancel">
            Cancel
          </button>
          <button
            className="px-3 py-1 bg-indigo-600 text-white rounded"
            onClick={() => onSubmit?.()}
            aria-label="Confirm reschedule"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  )
}
