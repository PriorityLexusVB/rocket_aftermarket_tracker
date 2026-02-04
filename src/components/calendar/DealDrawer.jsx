import React, { useEffect, useMemo, useRef } from 'react'
import { X } from 'lucide-react'

function getDealTitle(deal) {
  if (!deal) return 'Deal'
  const jobNumber = deal?.job_number?.split?.('-')?.pop?.() || ''
  const title = deal?.title || deal?.job_number || 'Deal'
  return jobNumber ? `${jobNumber} • ${title}` : title
}

function getFocusableElements(container) {
  if (!container) return []
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter((el) => !el.hasAttribute('disabled'))
}

export default function DealDrawer({ open, deal, onClose }) {
  const panelRef = useRef(null)
  const closeButtonRef = useRef(null)
  const title = useMemo(() => getDealTitle(deal), [deal])

  useEffect(() => {
    if (!open) return

    const previousActive = document.activeElement
    const focusTarget = closeButtonRef.current
    if (focusTarget) focusTarget.focus()

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose?.()
        return
      }

      if (event.key === 'Tab') {
        const focusables = getFocusableElements(panelRef.current)
        if (!focusables.length) return
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault()
          last.focus()
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      if (previousActive && typeof previousActive.focus === 'function') {
        previousActive.focus()
      }
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60]">
      <button
        type="button"
        aria-label="Close deal drawer"
        className="absolute inset-0 bg-black/40"
        onClick={() => onClose?.()}
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="deal-drawer-title"
        className="absolute right-0 top-0 h-full w-full max-w-xl overflow-y-auto bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="deal-drawer-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            <p className="text-xs text-slate-500">Deal Drawer (preview)</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => onClose?.()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-6 p-6 text-sm text-slate-700">
          <section className="space-y-1">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Summary</h3>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="font-medium text-slate-900">{deal?.title || 'Deal details'}</div>
              <div className="text-xs text-slate-500">
                {deal?.customer_name || deal?.vehicle?.owner_name || 'Customer'}
              </div>
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Line Items</h3>
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-500">
              Line item details coming soon.
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Schedule</h3>
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-500">
              Scheduling controls coming soon.
            </div>
          </section>

          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">History / Notes</h3>
            <div className="rounded-lg border border-dashed border-slate-200 p-3 text-slate-500">
              Activity history coming soon.
            </div>
          </section>
        </div>
      </aside>
    </div>
  )
}
